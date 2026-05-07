import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import {
  generateActivationKey,
  isValidLicenseFeature,
  licenseFeaturesGranting,
} from './activation-constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const LICENSES_FILE = path.join(DATA_DIR, 'licenses.json');

let pool = null;
let initPromise = null;

function databaseUrl() {
  return process.env.DATABASE_URL?.trim() ?? '';
}

function databaseSsl() {
  return process.env.DATABASE_SSL?.trim() ?? 'prefer';
}

function databaseConnectionTimeoutMs() {
  const parsed = Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? 10000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10000;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function jsonNullIfEmpty(value) {
  return typeof value === 'string' && value.trim().length === 0 ? null : value ?? null;
}

function numericOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function licenseIdForKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 24);
}

function normalizeLicense(licenseKey, raw) {
  const now = Date.now();
  const feature = raw?.feature;

  if (!isValidLicenseFeature(feature)) return null;

  return {
    licenseKey,
    licenseId: raw.licenseId || licenseIdForKey(licenseKey),
    feature,
    source: raw.source === 'subscription' ? 'subscription' : 'manual',
    status: raw.status || 'active',
    customerEmail: jsonNullIfEmpty(raw.customerEmail),
    adminNote: jsonNullIfEmpty(raw.adminNote),
    billingProvider: jsonNullIfEmpty(raw.billingProvider) ??
      ((raw.providerPlanId || raw.providerCustomerId || raw.providerSessionId) ? 'xendit' : null),
    providerCustomerId:
      jsonNullIfEmpty(raw.providerCustomerId) ??
      jsonNullIfEmpty(raw.xenditCustomerId) ??
      jsonNullIfEmpty(raw.stripeCustomerId),
    providerPlanId:
      jsonNullIfEmpty(raw.providerPlanId) ??
      jsonNullIfEmpty(raw.xenditPlanId) ??
      jsonNullIfEmpty(raw.stripeSubscriptionId),
    providerSessionId:
      jsonNullIfEmpty(raw.providerSessionId) ??
      jsonNullIfEmpty(raw.xenditSessionId),
    boundDeviceId: jsonNullIfEmpty(raw.boundDeviceId),
    currentPeriodEnd: numericOrNull(raw.currentPeriodEnd),
    createdAt: numericOrNull(raw.createdAt) ?? now,
    updatedAt:
      numericOrNull(raw.updatedAt) ??
      numericOrNull(raw.lastActivatedAt) ??
      numericOrNull(raw.createdAt) ??
      now,
    lastActivatedAt: numericOrNull(raw.lastActivatedAt),
    lastTransferredAt: numericOrNull(raw.lastTransferredAt),
  };
}

function serializeLicense(record) {
  return {
    feature: record.feature,
    licenseId: record.licenseId,
    source: record.source,
    status: record.status,
    customerEmail: record.customerEmail,
    adminNote: record.adminNote,
    billingProvider: record.billingProvider,
    providerCustomerId: record.providerCustomerId,
    providerPlanId: record.providerPlanId,
    providerSessionId: record.providerSessionId,
    boundDeviceId: record.boundDeviceId,
    currentPeriodEnd: record.currentPeriodEnd,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastActivatedAt: record.lastActivatedAt,
    lastTransferredAt: record.lastTransferredAt,
  };
}

function loadJsonLicenses() {
  ensureDataDir();

  try {
    if (!fs.existsSync(LICENSES_FILE)) return {};
    const raw = JSON.parse(fs.readFileSync(LICENSES_FILE, 'utf-8'));
    const normalized = {};

    for (const [key, value] of Object.entries(raw)) {
      const record = normalizeLicense(key, value);
      if (record) {
        normalized[key] = record;
      }
    }

    return normalized;
  } catch {
    return {};
  }
}

function saveJsonLicenses(records) {
  ensureDataDir();
  const payload = {};

  for (const [key, value] of Object.entries(records)) {
    payload[key] = serializeLicense(value);
  }

  const tmp = `${LICENSES_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf-8');
  fs.renameSync(tmp, LICENSES_FILE);
}

function createPool() {
  const url = databaseUrl();
  if (!url) return null;

  const sslMode = databaseSsl();
  const ssl =
    sslMode === 'disable'
      ? false
      : sslMode === 'require'
        ? { rejectUnauthorized: false }
        : undefined;

  return new Pool({
    connectionString: url,
    ssl,
    connectionTimeoutMillis: databaseConnectionTimeoutMs(),
  });
}

function rowToLicense(row) {
  if (!row) return null;

  return {
    licenseKey: row.license_key,
    licenseId: row.license_id,
    feature: row.feature,
    source: row.source,
    status: row.status,
    customerEmail: row.customer_email,
    adminNote: row.admin_note ?? null,
    billingProvider: row.billing_provider ?? null,
    providerCustomerId:
      row.provider_customer_id ?? row.xendit_customer_id ?? row.stripe_customer_id ?? null,
    providerPlanId:
      row.provider_plan_id ?? row.xendit_plan_id ?? row.stripe_subscription_id ?? null,
    providerSessionId:
      row.provider_session_id ?? row.xendit_session_id ?? null,
    boundDeviceId: row.bound_device_id,
    currentPeriodEnd: row.current_period_end === null ? null : Number(row.current_period_end),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    lastActivatedAt: row.last_activated_at === null ? null : Number(row.last_activated_at),
    lastTransferredAt: row.last_transferred_at === null ? null : Number(row.last_transferred_at),
  };
}

async function ensurePostgresSchema() {
  if (!pool) return;

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS activation_licenses (
        license_key TEXT PRIMARY KEY,
        license_id TEXT NOT NULL UNIQUE,
        feature TEXT NOT NULL,
        source TEXT NOT NULL,
        status TEXT NOT NULL,
        customer_email TEXT,
        admin_note TEXT,
        billing_provider TEXT,
        provider_customer_id TEXT,
        provider_plan_id TEXT UNIQUE,
        provider_session_id TEXT,
        bound_device_id TEXT,
        current_period_end BIGINT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        last_activated_at BIGINT,
        last_transferred_at BIGINT
      )
    `);
    await client.query(`
      ALTER TABLE activation_licenses
      ADD COLUMN IF NOT EXISTS admin_note TEXT,
      ADD COLUMN IF NOT EXISTS billing_provider TEXT,
      ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
      ADD COLUMN IF NOT EXISTS provider_plan_id TEXT,
      ADD COLUMN IF NOT EXISTS provider_session_id TEXT
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_activation_licenses_feature_device
      ON activation_licenses(feature, bound_device_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_activation_licenses_customer_feature
      ON activation_licenses(customer_email, feature, source)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_activation_licenses_admin_note
      ON activation_licenses(admin_note)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_activation_licenses_provider_plan
      ON activation_licenses(provider_plan_id)
    `);

    const legacy = loadJsonLicenses();
    for (const record of Object.values(legacy)) {
      await client.query(
        `
          INSERT INTO activation_licenses (
            license_key,
            license_id,
            feature,
            source,
            status,
            customer_email,
            admin_note,
            billing_provider,
            provider_customer_id,
            provider_plan_id,
            provider_session_id,
            bound_device_id,
            current_period_end,
            created_at,
            updated_at,
            last_activated_at,
            last_transferred_at
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15,
            $16, $17
          )
          ON CONFLICT (license_key) DO NOTHING
        `,
        [
          record.licenseKey,
          record.licenseId,
          record.feature,
          record.source,
          record.status,
          record.customerEmail,
          record.adminNote,
          record.billingProvider,
          record.providerCustomerId,
          record.providerPlanId,
          record.providerSessionId,
          record.boundDeviceId,
          record.currentPeriodEnd,
          record.createdAt,
          record.updatedAt,
          record.lastActivatedAt,
          record.lastTransferredAt,
        ]
      );
    }
  } finally {
    client.release();
  }
}

async function ensureInitialized() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    ensureDataDir();

    if (!pool && databaseUrl()) {
      pool = createPool();
    }

    if (pool) {
      await ensurePostgresSchema();
    }
  })();

  return initPromise;
}

async function saveRecord(record) {
  await ensureInitialized();

  if (pool) {
    await pool.query(
      `
        INSERT INTO activation_licenses (
          license_key,
          license_id,
          feature,
          source,
          status,
          customer_email,
          admin_note,
          billing_provider,
          provider_customer_id,
          provider_plan_id,
          provider_session_id,
          bound_device_id,
          current_period_end,
          created_at,
          updated_at,
          last_activated_at,
          last_transferred_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17
        )
        ON CONFLICT (license_key) DO UPDATE SET
          license_id = EXCLUDED.license_id,
          feature = EXCLUDED.feature,
          source = EXCLUDED.source,
          status = EXCLUDED.status,
          customer_email = EXCLUDED.customer_email,
          admin_note = EXCLUDED.admin_note,
          billing_provider = EXCLUDED.billing_provider,
          provider_customer_id = EXCLUDED.provider_customer_id,
          provider_plan_id = EXCLUDED.provider_plan_id,
          provider_session_id = EXCLUDED.provider_session_id,
          bound_device_id = EXCLUDED.bound_device_id,
          current_period_end = EXCLUDED.current_period_end,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          last_activated_at = EXCLUDED.last_activated_at,
          last_transferred_at = EXCLUDED.last_transferred_at
      `,
      [
        record.licenseKey,
        record.licenseId,
        record.feature,
        record.source,
        record.status,
        record.customerEmail,
        record.adminNote,
        record.billingProvider,
        record.providerCustomerId,
        record.providerPlanId,
        record.providerSessionId,
        record.boundDeviceId,
        record.currentPeriodEnd,
        record.createdAt,
        record.updatedAt,
        record.lastActivatedAt,
        record.lastTransferredAt,
      ]
    );
    return record;
  }

  const licenses = loadJsonLicenses();
  licenses[record.licenseKey] = record;
  saveJsonLicenses(licenses);
  return record;
}

async function querySingle(sql, params) {
  await ensureInitialized();
  if (!pool) return null;

  const result = await pool.query(sql, params);
  return rowToLicense(result.rows[0]);
}

function findJsonRecord(predicate) {
  const licenses = loadJsonLicenses();
  return Object.values(licenses).find(predicate) ?? null;
}

export async function initLicenseStore() {
  await ensureInitialized();
}

export function isDatabaseBacked() {
  return Boolean(databaseUrl());
}

export async function getLicenseByKey(key) {
  await ensureInitialized();

  if (pool) {
    return querySingle(`SELECT * FROM activation_licenses WHERE license_key = $1 LIMIT 1`, [key]);
  }

  return findJsonRecord((record) => record.licenseKey === key);
}

export async function getLicenseByLicenseId(licenseId) {
  await ensureInitialized();

  if (pool) {
    return querySingle(`SELECT * FROM activation_licenses WHERE license_id = $1 LIMIT 1`, [licenseId]);
  }

  return findJsonRecord((record) => record.licenseId === licenseId);
}

export async function getLicenseByProviderPlanId(providerPlanId) {
  if (!providerPlanId) return null;
  await ensureInitialized();

  if (pool) {
    return querySingle(
      `SELECT * FROM activation_licenses WHERE provider_plan_id = $1 LIMIT 1`,
      [providerPlanId]
    );
  }

  return findJsonRecord((record) => record.providerPlanId === providerPlanId);
}

export async function getDeviceLicense(feature, deviceId) {
  await ensureInitialized();
  const candidateFeatures = licenseFeaturesGranting(feature);

  if (pool) {
    if (candidateFeatures.length === 0) return null;

    return querySingle(
      `
        SELECT *
        FROM activation_licenses
        WHERE feature = ANY($1::text[]) AND bound_device_id = $2
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      [candidateFeatures, deviceId]
    );
  }

  const matches = Object.values(loadJsonLicenses()).filter(
    (record) => candidateFeatures.includes(record.feature) && record.boundDeviceId === deviceId
  );
  matches.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return matches[0] ?? null;
}

export async function getLatestSubscriptionLicenseForFeature(feature, customerEmail, providerCustomerId) {
  await ensureInitialized();

  if (pool) {
    if (customerEmail) {
      const byEmail = await querySingle(
        `
          SELECT *
          FROM activation_licenses
          WHERE feature = $1
            AND source = 'subscription'
            AND lower(customer_email) = lower($2)
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        [feature, customerEmail]
      );
      if (byEmail) return byEmail;
    }

    if (providerCustomerId) {
      return querySingle(
        `
          SELECT *
          FROM activation_licenses
          WHERE feature = $1
            AND source = 'subscription'
            AND provider_customer_id = $2
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        [feature, providerCustomerId]
      );
    }

    return null;
  }

  const records = Object.values(loadJsonLicenses()).filter(
    (record) =>
      record.feature === feature &&
      record.source === 'subscription' &&
      ((customerEmail && record.customerEmail?.toLowerCase() === customerEmail.toLowerCase()) ||
        (providerCustomerId && record.providerCustomerId === providerCustomerId))
  );
  records.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return records[0] ?? null;
}

function normalizeListOptions(options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 25, 1), 100);
  const offset = Math.max(Number(options.offset) || 0, 0);
  const query = typeof options.query === 'string' ? options.query.trim().slice(0, 200) : '';
  const feature = isValidLicenseFeature(options.feature) ? options.feature : '';
  const status =
    typeof options.status === 'string' && options.status.trim().length > 0
      ? options.status.trim().slice(0, 32)
      : '';
  const source = ['manual', 'subscription'].includes(options.source) ? options.source : '';
  const boundState = ['bound', 'unbound'].includes(options.boundState)
    ? options.boundState
    : '';
  const activity = ['activated', 'transferred'].includes(options.activity)
    ? options.activity
    : '';

  return { limit, offset, query, feature, status, source, boundState, activity };
}

function recordMatchesListOptions(record, filters) {
  if (filters.feature && record.feature !== filters.feature) return false;
  if (filters.status && record.status !== filters.status) return false;
  if (filters.source && record.source !== filters.source) return false;
  if (filters.boundState === 'bound' && !record.boundDeviceId) return false;
  if (filters.boundState === 'unbound' && record.boundDeviceId) return false;
  if (filters.activity === 'activated' && !record.lastActivatedAt) return false;
  if (filters.activity === 'transferred' && !record.lastTransferredAt) return false;

  if (!filters.query) return true;

  const needle = filters.query.toLowerCase();
  return [
    record.licenseKey,
    record.licenseId,
    record.boundDeviceId,
    record.customerEmail,
    record.adminNote,
    record.feature,
    record.status,
    record.source,
  ].some((value) => String(value ?? '').toLowerCase().includes(needle));
}

function buildPostgresListWhere(filters) {
  const where = [];
  const values = [];

  function addValue(value) {
    values.push(value);
    return `$${values.length}`;
  }

  if (filters.feature) where.push(`feature = ${addValue(filters.feature)}`);
  if (filters.status) where.push(`status = ${addValue(filters.status)}`);
  if (filters.source) where.push(`source = ${addValue(filters.source)}`);
  if (filters.boundState === 'bound') where.push('bound_device_id IS NOT NULL');
  if (filters.boundState === 'unbound') where.push('bound_device_id IS NULL');
  if (filters.activity === 'activated') where.push('last_activated_at IS NOT NULL');
  if (filters.activity === 'transferred') where.push('last_transferred_at IS NOT NULL');

  if (filters.query) {
    const param = addValue(`%${filters.query}%`);
    where.push(`(
      license_key ILIKE ${param}
      OR license_id ILIKE ${param}
      OR bound_device_id ILIKE ${param}
      OR customer_email ILIKE ${param}
      OR admin_note ILIKE ${param}
      OR feature ILIKE ${param}
      OR status ILIKE ${param}
      OR source ILIKE ${param}
    )`);
  }

  return {
    clause: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
    values,
  };
}

export async function createManualLicense(key, feature, options = {}) {
  const existing = await getLicenseByKey(key);
  if (existing) {
    throw new Error('License key already exists.');
  }

  const now = Date.now();
  const record = {
    licenseKey: key,
    licenseId: licenseIdForKey(key),
    feature,
    source: 'manual',
    status: 'active',
    customerEmail: jsonNullIfEmpty(options.customerEmail),
    adminNote: jsonNullIfEmpty(options.adminNote),
    billingProvider: null,
    providerCustomerId: null,
    providerPlanId: null,
    providerSessionId: null,
    boundDeviceId: null,
    currentPeriodEnd: null,
    createdAt: now,
    updatedAt: now,
    lastActivatedAt: null,
    lastTransferredAt: null,
  };

  await saveRecord(record);
  return record;
}

async function getUniqueGeneratedKey(feature) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = generateActivationKey(feature);
    const existing = await getLicenseByKey(candidate);
    if (!existing) return candidate;
  }

  throw new Error('Failed to generate a unique activation key.');
}

export async function createOrUpdateSubscriptionLicense({
  feature,
  customerEmail,
  billingProvider = 'xendit',
  providerCustomerId,
  providerPlanId,
  providerSessionId,
  status,
  currentPeriodEnd,
}) {
  let existing = await getLicenseByProviderPlanId(providerPlanId);

  if (!existing) {
    existing = await getLatestSubscriptionLicenseForFeature(
      feature,
      customerEmail,
      providerCustomerId
    );
  }

  const now = Date.now();

  if (existing) {
    const updated = {
      ...existing,
      feature,
      source: 'subscription',
      status,
      customerEmail: jsonNullIfEmpty(customerEmail) ?? existing.customerEmail,
      billingProvider: jsonNullIfEmpty(billingProvider) ?? existing.billingProvider,
      providerCustomerId: jsonNullIfEmpty(providerCustomerId) ?? existing.providerCustomerId,
      providerPlanId: jsonNullIfEmpty(providerPlanId) ?? existing.providerPlanId,
      providerSessionId: jsonNullIfEmpty(providerSessionId) ?? existing.providerSessionId,
      currentPeriodEnd: numericOrNull(currentPeriodEnd) ?? existing.currentPeriodEnd,
      updatedAt: now,
    };

    await saveRecord(updated);
    return updated;
  }

  const key = await getUniqueGeneratedKey(feature);
  const record = {
    licenseKey: key,
    licenseId: licenseIdForKey(key),
    feature,
    source: 'subscription',
    status,
    customerEmail: jsonNullIfEmpty(customerEmail),
    adminNote: null,
    billingProvider: jsonNullIfEmpty(billingProvider),
    providerCustomerId: jsonNullIfEmpty(providerCustomerId),
    providerPlanId: jsonNullIfEmpty(providerPlanId),
    providerSessionId: jsonNullIfEmpty(providerSessionId),
    boundDeviceId: null,
    currentPeriodEnd: numericOrNull(currentPeriodEnd),
    createdAt: now,
    updatedAt: now,
    lastActivatedAt: null,
    lastTransferredAt: null,
  };

  await saveRecord(record);
  return record;
}

export async function saveLicense(record) {
  return saveRecord(record);
}

export async function bindLicenseToDevice(record, deviceId) {
  const now = Date.now();
  const transferred = Boolean(record.boundDeviceId) && record.boundDeviceId !== deviceId;
  const updated = {
    ...record,
    boundDeviceId: deviceId,
    updatedAt: now,
    lastActivatedAt: now,
    lastTransferredAt: transferred ? now : record.lastTransferredAt,
  };

  await saveRecord(updated);
  return { license: updated, transferred };
}

export async function listLicenses(options = {}) {
  await ensureInitialized();
  const filters = normalizeListOptions(options);

  if (pool) {
    const where = buildPostgresListWhere(filters);
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM activation_licenses ${where.clause}`,
      where.values
    );
    const rowsResult = await pool.query(
      `
        SELECT *
        FROM activation_licenses
        ${where.clause}
        ORDER BY updated_at DESC, created_at DESC
        LIMIT $${where.values.length + 1}
        OFFSET $${where.values.length + 2}
      `,
      [...where.values, filters.limit, filters.offset]
    );

    return {
      total: Number(countResult.rows[0]?.total ?? 0),
      limit: filters.limit,
      offset: filters.offset,
      licenses: rowsResult.rows.map(rowToLicense),
    };
  }

  const matching = Object.values(loadJsonLicenses())
    .filter((record) => recordMatchesListOptions(record, filters))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  return {
    total: matching.length,
    limit: filters.limit,
    offset: filters.offset,
    licenses: matching.slice(filters.offset, filters.offset + filters.limit),
  };
}

export async function updateLicenseStatus(licenseKey, status) {
  const license = await getLicenseByKey(licenseKey);
  if (!license) return null;

  const updated = {
    ...license,
    status,
    updatedAt: Date.now(),
  };

  await saveRecord(updated);
  return updated;
}

export async function updateLicenseMetadata(licenseKey, { customerEmail, adminNote } = {}) {
  const license = await getLicenseByKey(licenseKey);
  if (!license) return null;

  const updated = {
    ...license,
    customerEmail:
      typeof customerEmail === 'undefined'
        ? license.customerEmail
        : jsonNullIfEmpty(customerEmail),
    adminNote:
      typeof adminNote === 'undefined' ? license.adminNote : jsonNullIfEmpty(adminNote),
    updatedAt: Date.now(),
  };

  await saveRecord(updated);
  return updated;
}

export async function unbindLicenseDevice(licenseKey) {
  const license = await getLicenseByKey(licenseKey);
  if (!license) return null;

  const updated = {
    ...license,
    boundDeviceId: null,
    updatedAt: Date.now(),
  };

  await saveRecord(updated);
  return updated;
}

export async function listLicensesByFeature(feature) {
  await ensureInitialized();

  if (pool) {
    const result = await pool.query(
      `SELECT * FROM activation_licenses WHERE feature = $1 ORDER BY updated_at DESC`,
      [feature]
    );
    return result.rows.map(rowToLicense);
  }

  return Object.values(loadJsonLicenses())
    .filter((record) => record.feature === feature)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}
