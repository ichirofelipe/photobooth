import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { renderAdminDashboardPage, renderAdminLoginPage } from './admin-dashboard.js';
import { loadLocalEnv } from './load-env.js';
import {
  FEATURE_SUBSCRIPTION_AMOUNT_ENV,
  LICENSE_FEATURES,
  featureLabel,
  generateActivationKey,
  grantedFeaturesForLicense,
  isValidLicenseFeature,
  licenseGrantsFeature,
  SUBSCRIPTION_FEATURES,
  isSubscriptionFeature,
  isValidFeature,
} from './activation-constants.js';
import {
  bindLicenseToDevice,
  createManualLicense,
  createOrUpdateSubscriptionLicense,
  getDeviceLicense,
  getLatestSubscriptionLicenseForFeature,
  getLicenseByKey,
  getLicenseByLicenseId,
  getLicenseByProviderPlanId,
  initLicenseStore,
  isDatabaseBacked,
  listLicenses,
  saveLicense,
  unbindLicenseDevice,
  updateLicenseMetadata,
  updateLicenseStatus,
} from './license-store.js';

loadLocalEnv();

const PORT = Number(process.env.PORT || process.env.ACTIVATION_PORT || 3001);
const ADMIN_SECRET = requireEnv('ADMIN_SECRET');
const PRIVATE_KEY = loadPrivateKey(requireEnv('ACTIVATION_PRIVATE_KEY_BASE64'));
const BASE_APP_LEASE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const PREMIUM_LEASE_DURATION_MS = 24 * 60 * 60 * 1000;
const PREMIUM_LICENSE_DURATIONS = {
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
  '180d': 180 * 24 * 60 * 60 * 1000,
  '365d': 365 * 24 * 60 * 60 * 1000,
};
const MANAGEMENT_LINK_TTL_MS = 60 * 60 * 1000;
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ADMIN_SESSION_COOKIE = 'pb_admin_session';
const APP_PUBLIC_URL = (
  process.env.APP_PUBLIC_URL?.trim() || process.env.ACTIVATION_SERVER_URL?.trim() || `http://localhost:${PORT}`
).replace(/\/$/, '');
const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY?.trim() ?? '';
const XENDIT_WEBHOOK_TOKEN = process.env.XENDIT_WEBHOOK_TOKEN?.trim() ?? '';
const XENDIT_API_BASE = (process.env.XENDIT_API_BASE?.trim() || 'https://api.xendit.co').replace(/\/$/, '');
const XENDIT_API_VERSION = process.env.XENDIT_API_VERSION?.trim() || '2026-01-01';

const app = express();
app.use(cors());

app.post(
  '/billing/webhook',
  express.json(),
  async (req, res) => {
    if (!isBillingReady()) {
      return res.status(503).send('Xendit billing is not configured.');
    }

    const callbackToken = req.headers['x-callback-token'];
    if (typeof callbackToken !== 'string' || callbackToken !== XENDIT_WEBHOOK_TOKEN) {
      return res.status(401).send('Invalid callback token.');
    }

    try {
      await handleXenditEvent(req.body);
      return res.json({ received: true });
    } catch (error) {
      console.error('[billing] Xendit webhook processing error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Webhook processing failed.',
      });
    }
  }
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
  })
);

const activateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.body?.deviceId ?? ''}_${req.ip}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many activation attempts. Please wait before trying again.' },
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    ts: Date.now(),
    storage: isDatabaseBacked() ? 'postgres' : 'json',
    billingConfigured: isBillingReady(),
    billingProvider: 'xendit',
    licenseFeatures: LICENSE_FEATURES,
  });
});

app.get('/admin', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(401).send(renderAdminLoginPage());
  }

  return res.send(renderAdminDashboardPage());
});

app.post('/admin/login', (req, res) => {
  const provided = typeof req.body?.adminSecret === 'string' ? req.body.adminSecret : '';
  if (!safeEquals(provided, ADMIN_SECRET)) {
    return res.status(401).send(renderAdminLoginPage({ error: 'Invalid admin secret.' }));
  }

  setAdminSessionCookie(res);
  return res.redirect('/admin');
});

app.post('/admin/logout', (_req, res) => {
  clearAdminSessionCookie(res);
  return res.redirect('/admin');
});

app.get('/admin/api/licenses', requireAdminApi, async (req, res) => {
  const result = await listLicenses({
    query: req.query.query,
    feature: req.query.feature,
    status: req.query.status,
    source: req.query.source,
    boundState: req.query.boundState,
    activity: req.query.activity,
    limit: req.query.limit,
    offset: req.query.offset,
  });

  return res.json({
    ...result,
    licenses: result.licenses.map(decorateAdminLicense),
  });
});

app.post('/admin/api/licenses', requireAdminApi, async (req, res) => {
  const feature = typeof req.body?.feature === 'string' ? req.body.feature : '';
  const count = Math.min(Math.max(Number(req.body?.count) || 1, 1), 50);
  const providedKey = typeof req.body?.key === 'string' ? req.body.key.trim() : '';
  const duration = typeof req.body?.duration === 'string' ? req.body.duration.trim() : '';
  const customerEmail = optionalString(req.body?.customerEmail, 320);
  const adminNote = optionalString(req.body?.adminNote, 500);

  if (!isValidLicenseFeature(feature)) {
    return res.status(400).json({ error: 'Invalid feature.' });
  }
  if (providedKey && count !== 1) {
    return res.status(400).json({ error: 'A custom key can only be used when count is 1.' });
  }

  const durationResult = resolveManualLicenseExpiration(feature, duration);
  if (durationResult.error) {
    return res.status(400).json({ error: durationResult.error });
  }

  try {
    const licenses = [];
    const licenseOptions = {
      customerEmail,
      adminNote,
      currentPeriodEnd: durationResult.currentPeriodEnd,
    };
    for (let i = 0; i < count; i += 1) {
      const record = providedKey
        ? await createManualLicense(providedKey, feature, licenseOptions)
        : await createGeneratedManualLicense(feature, licenseOptions);
      licenses.push(decorateAdminLicense(record));
    }

    return res.json({ success: true, licenses });
  } catch (error) {
    return res.status(409).json({
      error: error instanceof Error ? error.message : 'Unable to create license.',
    });
  }
});

app.patch('/admin/api/licenses/:licenseKey', requireAdminApi, async (req, res) => {
  const licenseKey = req.params.licenseKey;
  const status = typeof req.body?.status === 'string' ? req.body.status : undefined;
  const customerEmail =
    typeof req.body?.customerEmail === 'undefined'
      ? undefined
      : optionalString(req.body.customerEmail, 320);
  const adminNote =
    typeof req.body?.adminNote === 'undefined' ? undefined : optionalString(req.body.adminNote, 500);

  let license = null;

  if (typeof status !== 'undefined') {
    if (!['active', 'canceled', 'expired'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    license = await updateLicenseStatus(licenseKey, status);
  }

  if (typeof customerEmail !== 'undefined' || typeof adminNote !== 'undefined') {
    license = await updateLicenseMetadata(licenseKey, { customerEmail, adminNote });
  }

  if (!license) {
    return res.status(404).json({ error: 'License not found.' });
  }

  return res.json({ success: true, license });
});

app.post('/admin/api/licenses/:licenseKey/unbind', requireAdminApi, async (req, res) => {
  const license = await unbindLicenseDevice(req.params.licenseKey);
  if (!license) {
    return res.status(404).json({ error: 'License not found.' });
  }

  return res.json({ success: true, license });
});

app.get('/billing/success', async (req, res) => {
  const licenseId = typeof req.query.license_id === 'string' ? req.query.license_id : '';
  if (!licenseId) {
    return res
      .status(400)
      .send(renderPage('Missing Subscription', '<p>Missing license reference from the checkout return URL.</p>'));
  }

  const license = await getLicenseByLicenseId(licenseId);
  if (!license || license.source !== 'subscription') {
    return res
      .status(404)
      .send(renderPage('Subscription Not Found', '<p>We could not find that subscription record.</p>'));
  }

  const manageUrl = createManagementUrl(license.licenseId);
  const body = `
    <p>Your add-on subscription request has been received.</p>
    <p><strong>Feature:</strong> ${escapeHtml(featureLabel(license.feature))}</p>
    <p><strong>Email:</strong> ${escapeHtml(license.customerEmail ?? 'Unknown')}</p>
    <p class="key-label">Activation key</p>
    <div class="key-box">${escapeHtml(license.licenseKey)}</div>
    <p class="hint">Return to the app and paste this key into the activation field.</p>
    <p class="hint">
      If the key does not activate immediately, wait a few seconds for the webhook to mark the
      subscription active, then try again.
    </p>
    <p><a class="action-btn secondary" href="${escapeHtml(manageUrl)}">Manage subscription</a></p>
  `;

  return res.send(renderPage('Subscription Ready', body));
});

app.get('/billing/cancel', (_req, res) => {
  res.send(
    renderPage(
      'Checkout Canceled',
      '<p>No changes were made. You can return to the app and try again whenever you are ready.</p>'
    )
  );
});

app.get('/billing/manage', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const payload = verifyManagementToken(token);
  if (!payload) {
    return res
      .status(400)
      .send(renderPage('Invalid Link', '<p>This subscription management link is invalid or has expired.</p>'));
  }

  const license = await getLicenseByLicenseId(payload.licenseId);
  if (!license || license.source !== 'subscription') {
    return res
      .status(404)
      .send(renderPage('Subscription Not Found', '<p>We could not find that subscription record.</p>'));
  }

  const statusLabel =
    license.status === 'active'
      ? 'Active'
      : license.status === 'past_due'
        ? 'Past Due'
        : license.status === 'canceled'
          ? 'Canceled'
          : license.status;

  const deactivateForm =
    license.status === 'active' && license.providerPlanId
      ? `
        <form method="post" action="${APP_PUBLIC_URL}/billing/manage/deactivate">
          <input type="hidden" name="token" value="${escapeHtml(token)}" />
          <button class="action-btn danger" type="submit">Cancel future billing</button>
        </form>
      `
      : '';

  const body = `
    <p><strong>Feature:</strong> ${escapeHtml(featureLabel(license.feature))}</p>
    <p><strong>Email:</strong> ${escapeHtml(license.customerEmail ?? 'Unknown')}</p>
    <p><strong>Status:</strong> ${escapeHtml(statusLabel)}</p>
    <p class="key-label">Activation key</p>
    <div class="key-box">${escapeHtml(license.licenseKey)}</div>
    <p class="hint">
      Canceling here stops future recurring billing for this add-on. The current device can keep
      working only until its cached entitlement lease expires.
    </p>
    ${deactivateForm || '<p class="hint">No further self-service billing action is available for this subscription right now.</p>'}
  `;

  return res.send(renderPage('Manage Subscription', body));
});

app.post('/billing/manage/deactivate', async (req, res) => {
  const token = typeof req.body.token === 'string' ? req.body.token : '';
  const payload = verifyManagementToken(token);
  if (!payload) {
    return res
      .status(400)
      .send(renderPage('Invalid Link', '<p>This subscription management link is invalid or has expired.</p>'));
  }

  const license = await getLicenseByLicenseId(payload.licenseId);
  if (!license || license.source !== 'subscription' || !license.providerPlanId) {
    return res
      .status(404)
      .send(renderPage('Subscription Not Found', '<p>We could not find that subscription record.</p>'));
  }

  try {
    await deactivateProviderSubscription(license.providerPlanId);
    const now = Date.now();
    await saveLicense({
      ...license,
      status: 'canceled',
      currentPeriodEnd: now,
      updatedAt: now,
    });

    return res.send(
      renderPage(
        'Subscription Canceled',
        `<p>Future recurring billing has been canceled for <strong>${escapeHtml(
          featureLabel(license.feature)
        )}</strong>.</p><p>You can close this page and return to the app.</p>`
      )
    );
  } catch (error) {
    return res.status(500).send(
      renderPage(
        'Cancellation Failed',
        `<p>${
          error instanceof Error ? escapeHtml(error.message) : 'Unable to cancel the subscription.'
        }</p>`
      )
    );
  }
});

app.post('/activate', activateLimiter, async (req, res) => {
  const { key, deviceId, feature } = req.body ?? {};

  if (!isValidString(key) || !isValidString(deviceId) || !isValidString(feature)) {
    return res.status(400).json({ error: 'Missing or invalid fields: key, deviceId, feature.' });
  }
  if (!isValidLicenseFeature(feature)) {
    return res.status(400).json({ error: 'Invalid feature.' });
  }

  const license = await getLicenseByKey(key);
  if (!license) {
    return res.status(404).json({ error: 'License key not found.' });
  }

  let grantedFeatures = [];
  if (feature === 'premium_bundle') {
    grantedFeatures = grantedFeaturesForLicense(license.feature).filter(
      (grantedFeature) => grantedFeature !== 'base_app'
    );
  } else if (licenseGrantsFeature(license.feature, feature)) {
    grantedFeatures = grantedFeaturesForLicense(license.feature).filter((grantedFeature) =>
      feature === 'base_app' ? grantedFeature === 'base_app' : grantedFeature !== 'base_app'
    );
  }

  if (grantedFeatures.length === 0) {
    return res.status(400).json({ error: 'This key is not valid for the requested feature.' });
  }
  if (!canIssueEntitlement(license)) {
    return res.status(402).json({
      error:
        isEffectivelyExpired(license)
          ? 'This activation key has expired.'
          : license.source === 'subscription'
          ? 'This subscription is not active. Complete checkout or update billing and try again.'
          : 'This license is no longer active.',
    });
  }

  const { license: boundLicense, transferred } = await bindLicenseToDevice(license, deviceId);
  const entitlements = grantedFeatures.map((grantedFeature) =>
    makeEntitlement(deviceId, boundLicense, grantedFeature)
  );

  return res.json({
    entitlement: entitlements[0],
    entitlements,
    activatedFeatures: grantedFeatures,
    transferred,
  });
});

app.post('/sync', async (req, res) => {
  const { deviceId, entitlements, features } = req.body ?? {};
  const requested = Array.isArray(entitlements)
    ? entitlements
    : Array.isArray(features)
      ? features.map((feature) => ({ feature }))
      : null;

  if (!isValidString(deviceId) || !Array.isArray(requested)) {
    return res.status(400).json({ error: 'Missing or invalid fields: deviceId, entitlements[].' });
  }

  const activeEntitlements = [];
  const revoked = [];

  for (const item of requested) {
    const feature = typeof item === 'string' ? item : item?.feature;
    const requestedLicenseId =
      typeof item === 'object' && item !== null ? item.licenseId ?? null : null;

    if (!isValidFeature(feature)) continue;

    const exactLicense = requestedLicenseId
      ? await getLicenseByLicenseId(requestedLicenseId)
      : null;
    const deviceLicense = await getDeviceLicense(feature, deviceId);

    const candidate = deviceLicense && canIssueEntitlement(deviceLicense) ? deviceLicense : null;
    if (candidate) {
      activeEntitlements.push(makeEntitlement(deviceId, candidate, feature));
      continue;
    }

    let reason = 'unknown';
    if (exactLicense?.boundDeviceId && exactLicense.boundDeviceId !== deviceId) {
      reason = 'transferred_to_another_device';
    } else if (
      (exactLicense && isEffectivelyExpired(exactLicense)) ||
      (deviceLicense && isEffectivelyExpired(deviceLicense))
    ) {
      reason = 'expired';
    } else if (
      (exactLicense && !canIssueEntitlement(exactLicense)) ||
      (deviceLicense && !canIssueEntitlement(deviceLicense))
    ) {
      reason = 'billing_inactive';
    } else if (exactLicense && !exactLicense.boundDeviceId) {
      reason = 'not_activated';
    }

    revoked.push({ feature, reason });
  }

  return res.json({ entitlements: activeEntitlements, revoked });
});

app.post('/admin/create-license', async (req, res) => {
  const provided = req.headers['x-admin-secret'];
  if (provided !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const { key, feature } = req.body ?? {};
  const duration = typeof req.body?.duration === 'string' ? req.body.duration.trim() : '';
  if (!isValidString(key) || !isValidString(feature)) {
    return res.status(400).json({ error: 'Missing or invalid fields: key, feature.' });
  }
  if (!isValidLicenseFeature(feature)) {
    return res.status(400).json({ error: 'Invalid feature.' });
  }

  const durationResult = resolveManualLicenseExpiration(feature, duration);
  if (durationResult.error) {
    return res.status(400).json({ error: durationResult.error });
  }

  try {
    const record = await createManualLicense(key, feature, {
      currentPeriodEnd: durationResult.currentPeriodEnd,
    });
    return res.json({
      success: true,
      key: record.licenseKey,
      feature: record.feature,
      source: record.source,
      status: record.status,
      currentPeriodEnd: record.currentPeriodEnd,
    });
  } catch (error) {
    return res.status(409).json({
      error: error instanceof Error ? error.message : 'License key already exists.',
    });
  }
});

app.post('/billing/create-checkout-session', async (req, res) => {
  if (!isBillingReady()) {
    return res.status(503).json({ error: 'Xendit billing is not configured.' });
  }

  const { feature, deviceId, email } = req.body ?? {};
  if (!isValidString(feature) || !isValidString(deviceId) || !isValidString(email, 320)) {
    return res.status(400).json({ error: 'Missing or invalid fields: feature, deviceId, email.' });
  }
  if (!isValidFeature(feature)) {
    return res.status(400).json({ error: 'Invalid feature.' });
  }
  if (!isSubscriptionFeature(feature)) {
    return res.status(400).json({
      error: 'Base app activation is manual only. Subscription checkout is only available for QR Download and Template Editor.',
    });
  }

  const amount = subscriptionAmountForFeature(feature);
  if (!amount) {
    return res.status(503).json({ error: `Missing Xendit amount configuration for ${feature}.` });
  }

  const existing = await getLatestSubscriptionLicenseForFeature(feature, email, null);
  if (existing?.providerPlanId && ['active', 'past_due', 'pending'].includes(existing.status)) {
    return res.json({
      url: createManagementUrl(existing.licenseId),
      mode: 'portal',
      message: 'This email already has a subscription record for this feature. Manage it here instead.',
    });
  }

  const license = await createOrUpdateSubscriptionLicense({
    feature,
    customerEmail: email,
    billingProvider: 'xendit',
    providerCustomerId: existing?.providerCustomerId ?? null,
    providerPlanId: existing?.providerPlanId ?? null,
    providerSessionId: existing?.providerSessionId ?? null,
    status: 'pending',
    currentPeriodEnd: existing?.currentPeriodEnd ?? null,
  });

  const session = await createXenditSubscriptionSession({
    license,
    feature,
    email,
    amount,
  });

  await saveLicense({
    ...license,
    billingProvider: 'xendit',
    providerCustomerId: session.customer_id ?? license.providerCustomerId,
    providerSessionId: session.payment_session_id ?? license.providerSessionId,
    status: 'pending',
    updatedAt: Date.now(),
  });

  const checkoutUrl = session.payment_link_url ?? null;
  if (!checkoutUrl) {
    return res.status(500).json({ error: 'Xendit did not return a checkout URL.' });
  }

  return res.json({
    url: checkoutUrl,
    mode: 'checkout',
    message: 'Checkout opened. Complete the Xendit subscription flow, then copy the activation key from the success page.',
  });
});

app.post('/billing/create-portal-session', async (req, res) => {
  const { feature, licenseId, deviceId } = req.body ?? {};
  if (!isValidString(feature) || !isValidString(licenseId) || !isValidString(deviceId)) {
    return res
      .status(400)
      .json({ error: 'Missing or invalid fields: feature, licenseId, deviceId.' });
  }
  if (!isValidFeature(feature)) {
    return res.status(400).json({ error: 'Invalid feature.' });
  }
  if (!isSubscriptionFeature(feature)) {
    return res.status(400).json({ error: 'Base app activation does not use subscription billing.' });
  }

  const license = await getLicenseByLicenseId(licenseId);
  if (!license || license.feature !== feature) {
    return res.status(404).json({ error: 'Subscription license not found.' });
  }
  if (license.source !== 'subscription') {
    return res.status(400).json({ error: 'This license is not backed by a subscription.' });
  }
  if (license.boundDeviceId && license.boundDeviceId !== deviceId) {
    return res.status(403).json({ error: 'This device is not allowed to manage that subscription.' });
  }

  return res.json({ url: createManagementUrl(license.licenseId) });
});

await initLicenseStore();

app.listen(PORT, () => {
  console.log(
    `[activation-server] Listening on port ${PORT} using ${isDatabaseBacked() ? 'Postgres' : 'JSON'} storage`
  );
});

async function createGeneratedManualLicense(feature, options) {
  let lastError = null;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return await createManualLicense(generateActivationKey(feature), feature, options);
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || !error.message.includes('already exists')) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error('Failed to generate a unique activation key.');
}

function requireAdminApi(req, res, next) {
  if (isAdminRequest(req)) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized.' });
}

function isAdminRequest(req) {
  const provided = req.headers['x-admin-secret'];
  if (typeof provided === 'string' && safeEquals(provided, ADMIN_SECRET)) {
    return true;
  }

  const token = parseCookies(req.headers.cookie ?? '')[ADMIN_SESSION_COOKIE];
  return verifyAdminSessionToken(token);
}

function setAdminSessionCookie(res) {
  const token = createAdminSessionToken();
  const secure = APP_PUBLIC_URL.startsWith('https://') ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(
      token
    )}; HttpOnly; SameSite=Lax; Path=/admin; Max-Age=${Math.floor(
      ADMIN_SESSION_TTL_MS / 1000
    )}${secure}`
  );
}

function clearAdminSessionCookie(res) {
  const secure = APP_PUBLIC_URL.startsWith('https://') ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/admin; Max-Age=0${secure}`
  );
}

function createAdminSessionToken() {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Date.now() + ADMIN_SESSION_TTL_MS,
      nonce: crypto.randomBytes(12).toString('hex'),
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminSessionToken(token) {
  if (!token || !token.includes('.')) return false;

  const [payload, sig] = token.split('.', 2);
  const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('base64url');
  if (!safeEquals(sig, expected)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function parseCookies(rawCookieHeader) {
  const cookies = {};
  for (const item of rawCookieHeader.split(';')) {
    const [rawName, ...rawValue] = item.trim().split('=');
    if (!rawName) continue;
    cookies[rawName] = decodeURIComponent(rawValue.join('=') || '');
  }
  return cookies;
}

function safeEquals(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string') return false;

  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[activation-server] Missing required environment variable: ${name}. ` +
        'Create server/activation-server.env from server/activation-server.env.example ' +
        'or inject the variable before starting the server.'
    );
  }
  return value;
}

function loadPrivateKey(privateKeyBase64) {
  try {
    return crypto.createPrivateKey({
      key: Buffer.from(privateKeyBase64, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
  } catch {
    throw new Error(
      '[activation-server] ACTIVATION_PRIVATE_KEY_BASE64 is not a valid PKCS#8 DER key.'
    );
  }
}

function signPayload(payload) {
  return crypto
    .sign('sha256', Buffer.from(canonicalString(payload), 'utf8'), PRIVATE_KEY)
    .toString('base64');
}

function canonicalString(payload) {
  if (payload.licenseId) {
    return `${payload.deviceId}|${payload.feature}|${payload.licenseId}|${payload.issuedAt}|${payload.expiresAt}`;
  }
  return `${payload.deviceId}|${payload.feature}|${payload.issuedAt}|${payload.expiresAt}`;
}

function makeEntitlement(deviceId, license, featureOverride = null) {
  const issuedAt = Date.now();
  const feature = featureOverride ?? license.feature;
  const maxLease =
    feature === 'base_app'
      ? issuedAt + BASE_APP_LEASE_DURATION_MS
      : issuedAt + PREMIUM_LEASE_DURATION_MS;
  const expiresAt =
    isExpiringLicense(license) && typeof license.currentPeriodEnd === 'number'
      ? Math.min(maxLease, license.currentPeriodEnd)
      : maxLease;

  const payload = {
    deviceId,
    feature,
    licenseId: license.licenseId,
    issuedAt,
    expiresAt,
  };
  return { ...payload, sig: signPayload(payload) };
}

function isValidString(val, maxLen = 128) {
  return typeof val === 'string' && val.trim().length > 0 && val.length <= maxLen;
}

function optionalString(val, maxLen = 128) {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function isExpiringLicense(license) {
  return license?.source === 'subscription' || license?.feature !== 'base_app';
}

function resolveManualLicenseExpiration(feature, duration) {
  if (feature === 'base_app') {
    if (duration) {
      return { error: 'Base App keys do not expire. Do not set a duration.' };
    }
    return { currentPeriodEnd: null };
  }

  if (!duration) {
    return { error: 'Select an expiration duration for premium keys.' };
  }

  const durationMs = PREMIUM_LICENSE_DURATIONS[duration];
  if (!durationMs) {
    return { error: 'Invalid premium key duration. Use 30d, 90d, 180d, or 365d.' };
  }

  return { currentPeriodEnd: Date.now() + durationMs };
}

function isEffectivelyExpired(license) {
  return (
    isExpiringLicense(license) &&
    typeof license.currentPeriodEnd === 'number' &&
    license.currentPeriodEnd <= Date.now()
  );
}

function effectiveLicenseStatus(license) {
  if (license.status === 'active' && isEffectivelyExpired(license)) {
    return 'expired';
  }
  return license.status;
}

function decorateAdminLicense(license) {
  return {
    ...license,
    effectiveStatus: effectiveLicenseStatus(license),
    expiresAt: isExpiringLicense(license) ? license.currentPeriodEnd : null,
  };
}

function canIssueEntitlement(license) {
  if (!license) return false;
  if (license.source === 'manual') {
    return license.status === 'active' && !isEffectivelyExpired(license);
  }

  if (license.status !== 'active') return false;
  if (isEffectivelyExpired(license)) return false;

  return true;
}

function subscriptionAmountForFeature(feature) {
  const envKey = FEATURE_SUBSCRIPTION_AMOUNT_ENV[feature];
  const raw = envKey ? process.env[envKey]?.trim() : '';
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isBillingReady() {
  return Boolean(
    XENDIT_SECRET_KEY &&
      XENDIT_WEBHOOK_TOKEN &&
      SUBSCRIPTION_FEATURES.every((feature) => subscriptionAmountForFeature(feature))
  );
}

function xenditAuthHeader() {
  return `Basic ${Buffer.from(`${XENDIT_SECRET_KEY}:`).toString('base64')}`;
}

async function xenditRequest(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${XENDIT_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: xenditAuthHeader(),
      'Content-Type': 'application/json',
      'api-version': XENDIT_API_VERSION,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await response.json().catch(() => ({}))) ?? {};
  if (!response.ok) {
    throw new Error(
      typeof json.message === 'string'
        ? json.message
        : typeof json.error_code === 'string'
          ? json.error_code
          : `Xendit error ${response.status}`
    );
  }

  return json;
}

function makeSubscriptionReference(licenseId) {
  return `pbsub_${licenseId}`;
}

function parseLicenseIdFromReference(referenceId) {
  if (!isValidString(referenceId, 64) || !referenceId.startsWith('pbsub_')) {
    return null;
  }

  return referenceId.slice('pbsub_'.length) || null;
}

function customerReferenceForEmail(email) {
  return `pbcust${crypto
    .createHash('sha256')
    .update(email.trim().toLowerCase())
    .digest('hex')
    .slice(0, 18)}`;
}

function personNameFromEmail(email) {
  const local = email.split('@')[0] || 'Subscriber';
  const cleaned = local.replace(/[^a-zA-Z0-9]/g, ' ').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.slice(0, 50) || 'Subscriber';
  const last = parts.slice(1).join(' ').slice(0, 50) || 'Photobooth';
  return { first, last };
}

function buildMonthlySchedule() {
  const now = new Date();
  const day = Math.min(now.getUTCDate(), 28);
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');

  return {
    interval: 'MONTH',
    interval_count: 1,
    anchor_date: `${yyyy}-${mm}-${dd}`,
    retry_interval: 'DAY',
    retry_interval_count: 1,
    total_retry: 3,
    failed_attempt_notifications: [1, 2, 3],
  };
}

async function createXenditSubscriptionSession({ license, feature, email, amount }) {
  const name = personNameFromEmail(email);
  const session = await xenditRequest('/sessions', {
    method: 'POST',
    body: {
      reference_id: makeSubscriptionReference(license.licenseId),
      session_type: 'SUBSCRIPTION',
      mode: 'PAYMENT_LINK',
      amount,
      currency: 'PHP',
      country: 'PH',
      customer: {
        reference_id: customerReferenceForEmail(email),
        type: 'INDIVIDUAL',
        email,
        individual_detail: {
          given_names: name.first,
          surname: name.last,
        },
      },
      locale: 'en',
      description: `Monthly ${featureLabel(feature)} subscription`,
      success_return_url: `${APP_PUBLIC_URL}/billing/success?license_id=${encodeURIComponent(
        license.licenseId
      )}`,
      cancel_return_url: `${APP_PUBLIC_URL}/billing/cancel`,
      subscription: {
        schedule: buildMonthlySchedule(),
        failed_cycle_action: 'STOP',
        immediate_payment: true,
        payment_link_for_failed_attempt: true,
        notification_channels: ['EMAIL'],
      },
    },
  });

  return session;
}

function cycleLeaseWindowMs() {
  return 35 * 24 * 60 * 60 * 1000;
}

async function syncSubscriptionRecordFromXendit({
  feature,
  customerEmail,
  providerCustomerId,
  providerPlanId,
  providerSessionId,
  status,
  currentPeriodEnd,
}) {
  if (!feature || !isValidFeature(feature)) {
    throw new Error('Unable to determine feature for Xendit subscription.');
  }

  return createOrUpdateSubscriptionLicense({
    feature,
    customerEmail,
    billingProvider: 'xendit',
    providerCustomerId,
    providerPlanId,
    providerSessionId,
    status,
    currentPeriodEnd,
  });
}

async function handleXenditEvent(event) {
  const eventName = typeof event?.event === 'string' ? event.event : '';
  const data = event?.data ?? {};
  const featureFromRef = parseLicenseIdFromReference(data.reference_id);
  const featureLicense = featureFromRef ? await getLicenseByLicenseId(featureFromRef) : null;
  const feature = featureLicense?.feature ?? null;

  switch (eventName) {
    case 'payment_session.completed': {
      if (!feature) return;
      await syncSubscriptionRecordFromXendit({
        feature,
        customerEmail: featureLicense?.customerEmail ?? null,
        providerCustomerId: data.customer_id ?? featureLicense?.providerCustomerId ?? null,
        providerPlanId: data.plan_id ?? featureLicense?.providerPlanId ?? null,
        providerSessionId: data.payment_session_id ?? featureLicense?.providerSessionId ?? null,
        status: featureLicense?.status === 'active' ? 'active' : 'pending',
        currentPeriodEnd: featureLicense?.currentPeriodEnd ?? null,
      });
      return;
    }
    case 'recurring.plan.activated':
    case 'recurring_plan.activated': {
      if (!feature) return;
      await syncSubscriptionRecordFromXendit({
        feature,
        customerEmail: featureLicense?.customerEmail ?? null,
        providerCustomerId: data.customer_id ?? featureLicense?.providerCustomerId ?? null,
        providerPlanId: data.id ?? featureLicense?.providerPlanId ?? null,
        providerSessionId: featureLicense?.providerSessionId ?? null,
        status: 'active',
        currentPeriodEnd: Date.now() + cycleLeaseWindowMs(),
      });
      return;
    }
    case 'recurring.plan.inactivated':
    case 'recurring_plan.inactivated': {
      const byPlan = data.id ? await getLicenseByProviderPlanId(data.id) : featureLicense;
      if (!byPlan) return;
      await saveLicense({
        ...byPlan,
        status: 'canceled',
        currentPeriodEnd: Date.now(),
        updatedAt: Date.now(),
      });
      return;
    }
    case 'recurring.cycle.succeeded':
    case 'recurring_cycle.succeeded': {
      const byPlan = data.plan_id ? await getLicenseByProviderPlanId(data.plan_id) : featureLicense;
      if (!byPlan) return;
      await saveLicense({
        ...byPlan,
        status: 'active',
        currentPeriodEnd: Date.now() + cycleLeaseWindowMs(),
        updatedAt: Date.now(),
      });
      return;
    }
    case 'recurring.cycle.retrying':
    case 'recurring.cycle.failed':
    case 'recurring_cycle.retrying':
    case 'recurring_cycle.failed': {
      const byPlan = data.plan_id ? await getLicenseByProviderPlanId(data.plan_id) : featureLicense;
      if (!byPlan) return;
      await saveLicense({
        ...byPlan,
        status: 'past_due',
        currentPeriodEnd: Date.now(),
        updatedAt: Date.now(),
      });
      return;
    }
    default:
      return;
  }
}

function createManagementToken(licenseId, expiresAt = Date.now() + MANAGEMENT_LINK_TTL_MS) {
  const payload = Buffer.from(JSON.stringify({ licenseId, expiresAt }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyManagementToken(token) {
  if (!token || !token.includes('.')) return null;

  const [payload, sig] = token.split('.', 2);
  const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('base64url');
  if (sig !== expected) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed?.licenseId || typeof parsed.expiresAt !== 'number') {
      return null;
    }
    if (parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function createManagementUrl(licenseId) {
  return `${APP_PUBLIC_URL}/billing/manage?token=${encodeURIComponent(createManagementToken(licenseId))}`;
}

async function deactivateProviderSubscription(planId) {
  if (!isBillingReady()) {
    throw new Error('Xendit billing is not configured.');
  }

  return xenditRequest(`/recurring/plans/${encodeURIComponent(planId)}/deactivate`, {
    method: 'POST',
    body: {},
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderPage(title, body) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background: #f5f7fb;
        color: #1f2937;
        margin: 0;
        padding: 32px 16px;
      }
      .card {
        max-width: 640px;
        margin: 0 auto;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
        padding: 28px;
      }
      h1 {
        margin-top: 0;
        font-size: 28px;
      }
      p {
        line-height: 1.55;
      }
      .key-label {
        margin-bottom: 8px;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #475569;
      }
      .key-box {
        background: #0f172a;
        color: #fff;
        padding: 14px 16px;
        border-radius: 10px;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 0.08em;
        overflow-wrap: anywhere;
      }
      .hint {
        color: #475569;
        font-size: 14px;
      }
      .action-btn {
        display: inline-block;
        margin-top: 12px;
        padding: 12px 16px;
        border: 0;
        border-radius: 10px;
        background: #2563eb;
        color: #fff;
        text-decoration: none;
        font-weight: 700;
        cursor: pointer;
      }
      .action-btn.secondary {
        background: #0f172a;
      }
      .action-btn.danger {
        background: #b91c1c;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${escapeHtml(title)}</h1>
      ${body}
    </div>
  </body>
</html>`;
}
