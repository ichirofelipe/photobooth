import crypto from 'crypto';

export const ENTITLEMENT_FEATURES = ['base_app', 'qr_download', 'template_editor'];
export const LICENSE_FEATURES = [...ENTITLEMENT_FEATURES, 'premium_bundle'];
export const SUBSCRIPTION_FEATURES = ['qr_download', 'template_editor'];

export const FEATURE_LABELS = {
  base_app: 'Base App',
  qr_download: 'QR Download',
  template_editor: 'Template Editor',
  premium_bundle: 'Premium Bundle',
};

export const FEATURE_SUBSCRIPTION_AMOUNT_ENV = {
  qr_download: 'XENDIT_QR_DOWNLOAD_AMOUNT',
  template_editor: 'XENDIT_TEMPLATE_EDITOR_AMOUNT',
};

const FEATURE_CODES = {
  base_app: 'BASE',
  qr_download: 'QR',
  template_editor: 'TPL',
  premium_bundle: 'PRM',
};

const LICENSE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function isValidFeature(feature) {
  return ENTITLEMENT_FEATURES.includes(feature);
}

export function isValidLicenseFeature(feature) {
  return LICENSE_FEATURES.includes(feature);
}

export function isSubscriptionFeature(feature) {
  return SUBSCRIPTION_FEATURES.includes(feature);
}

export function featureLabel(feature) {
  return FEATURE_LABELS[feature] ?? feature;
}

export function featureCode(feature) {
  return FEATURE_CODES[feature];
}

export function grantedFeaturesForLicense(licenseFeature) {
  if (licenseFeature === 'premium_bundle') {
    return ['qr_download', 'template_editor'];
  }
  return isValidFeature(licenseFeature) ? [licenseFeature] : [];
}

export function licenseGrantsFeature(licenseFeature, requestedFeature) {
  return grantedFeaturesForLicense(licenseFeature).includes(requestedFeature);
}

export function licenseFeaturesGranting(requestedFeature) {
  if (requestedFeature === 'qr_download') {
    return ['qr_download', 'premium_bundle'];
  }
  if (requestedFeature === 'template_editor') {
    return ['template_editor', 'premium_bundle'];
  }
  if (requestedFeature === 'base_app') {
    return ['base_app'];
  }
  return [];
}

function randomChunk(length = 4) {
  const bytes = crypto.randomBytes(length);
  let value = '';

  for (let i = 0; i < length; i += 1) {
    value += LICENSE_ALPHABET[bytes[i] % LICENSE_ALPHABET.length];
  }

  return value;
}

export function generateActivationKey(feature) {
  return `PB-${featureCode(feature)}-${randomChunk()}-${randomChunk()}-${randomChunk()}`;
}
