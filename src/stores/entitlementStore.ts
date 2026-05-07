import { defineStore } from 'pinia';
import { Capacitor } from '@capacitor/core';
import { DeviceKey } from '@/plugins/device-key';
import type {
  ActivationTarget,
  EntitlementRecord,
  EntitlementRevocation,
  EntitlementSyncItem,
  Feature,
  PremiumFeature,
  PremiumUnlockTarget,
} from '@/types';
import { ALL_FEATURES } from '@/types';
import { premiumFeaturesForTarget } from '@/config/premiumAccess';

const IS_MOCK = import.meta.env.VITE_MOCK_ENTITLEMENTS === 'true';
const ACTIVATION_SERVER_URL =
  import.meta.env.VITE_ACTIVATION_SERVER_URL ?? 'http://localhost:3001';
const ACTIVATION_PUBLIC_KEY =
  import.meta.env.VITE_ACTIVATION_PUBLIC_KEY_BASE64 ?? '';

const MOCK_EXPIRES_AT = Date.now() + 365 * 24 * 60 * 60 * 1000;
const NOTICE_STORAGE_KEY = 'entitlement_notices_v1';
const LICENSE_REF_STORAGE_KEY = 'entitlement_license_refs_v1';
const ACTIVATION_WAKE_MESSAGE =
  'The activation server may still be waking up. Please wait 30-60 seconds, then tap Activate again.';
const ACTIVATION_ADDRESS_MESSAGE =
  'The activation server address cannot be reached. Check your internet connection or contact support.';

let initPromise: Promise<void> | null = null;

interface EntitlementState {
  initialized: boolean;
  deviceId: string | null;
  configError: string | null;
  records: Partial<Record<Feature, EntitlementRecord>>;
  notices: Partial<Record<Feature, string>>;
  licenseRefs: Partial<Record<Feature, string>>;
}

interface ActivationResult {
  success: boolean;
  error?: string;
  info?: string;
  activatedFeatures?: Feature[];
}

function readStoredNotices(): Partial<Record<Feature, string>> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(NOTICE_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const notices: Partial<Record<Feature, string>> = {};

    for (const feature of ALL_FEATURES) {
      if (typeof parsed[feature] === 'string' && parsed[feature].trim().length > 0) {
        notices[feature] = parsed[feature];
      }
    }

    return notices;
  } catch {
    return {};
  }
}

function writeStoredNotices(notices: Partial<Record<Feature, string>>): void {
  if (typeof window === 'undefined') return;

  const cleaned: Partial<Record<Feature, string>> = {};
  for (const feature of ALL_FEATURES) {
    const value = notices[feature];
    if (typeof value === 'string' && value.trim().length > 0) {
      cleaned[feature] = value;
    }
  }

  try {
    if (Object.keys(cleaned).length === 0) {
      window.localStorage.removeItem(NOTICE_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(NOTICE_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // Ignore local storage failures; notices just won't persist.
  }
}

function readStoredLicenseRefs(): Partial<Record<Feature, string>> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(LICENSE_REF_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const refs: Partial<Record<Feature, string>> = {};

    for (const feature of ALL_FEATURES) {
      if (typeof parsed[feature] === 'string' && parsed[feature].trim().length > 0) {
        refs[feature] = parsed[feature];
      }
    }

    return refs;
  } catch {
    return {};
  }
}

function writeStoredLicenseRefs(refs: Partial<Record<Feature, string>>): void {
  if (typeof window === 'undefined') return;

  const cleaned: Partial<Record<Feature, string>> = {};
  for (const feature of ALL_FEATURES) {
    const value = refs[feature];
    if (typeof value === 'string' && value.trim().length > 0) {
      cleaned[feature] = value;
    }
  }

  try {
    if (Object.keys(cleaned).length === 0) {
      window.localStorage.removeItem(LICENSE_REF_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(LICENSE_REF_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // Ignore local storage failures; refs just won't persist.
  }
}

function targetFeatures(target: ActivationTarget): Feature[] {
  if (target === 'premium_bundle') {
    return premiumFeaturesForTarget(target);
  }
  return [target];
}

function featureLabel(feature: Feature): string {
  switch (feature) {
    case 'base_app':
      return 'Base App';
    case 'qr_download':
      return 'QR Download';
    case 'template_editor':
      return 'Template Editor';
    default:
      return feature;
  }
}

function buildActivationInfo(activatedFeatures: Feature[], transferred: boolean): string | undefined {
  const unique = Array.from(new Set(activatedFeatures));
  if (unique.length === 0) {
    return transferred
      ? 'This activation key was moved from another device and is now active here.'
      : 'Activation successful.';
  }

  if (transferred) {
    if (
      unique.includes('qr_download') &&
      unique.includes('template_editor') &&
      !unique.includes('base_app')
    ) {
      return 'This activation key was moved from another device. QR Download and Template Editor are now active here.';
    }

    return `This activation key was moved from another device. ${unique
      .map(featureLabel)
      .join(' and ')} ${
      unique.length === 1 ? 'is' : 'are'
    } now active here.`;
  }

  if (
    unique.includes('qr_download') &&
    unique.includes('template_editor') &&
    !unique.includes('base_app')
  ) {
    return 'QR Download and Template Editor activated successfully.';
  }

  return `${unique.map(featureLabel).join(' and ')} activated successfully.`;
}

function normalizeActivationError(err: unknown): string {
  const fallback = 'Activation failed. Check the key and try again.';
  const rawMessage = err instanceof Error ? err.message : typeof err === 'string' ? err : fallback;
  const message = rawMessage.trim() || fallback;
  const normalized = message.toLowerCase();

  if (
    normalized.includes('timed out') ||
    normalized.includes('timeout') ||
    normalized.includes('failed to connect') ||
    normalized.includes('connection reset')
  ) {
    return ACTIVATION_WAKE_MESSAGE;
  }

  if (
    normalized.includes('unable to resolve host') ||
    normalized.includes('no address associated with hostname') ||
    normalized.includes('unknownhost') ||
    normalized.includes('name not resolved') ||
    normalized.includes('failed to resolve')
  ) {
    return ACTIVATION_ADDRESS_MESSAGE;
  }

  return message;
}

export const useEntitlementStore = defineStore('entitlement', {
  state: (): EntitlementState => ({
    initialized: false,
    deviceId: null,
    configError: null,
    records: {},
    notices: readStoredNotices(),
    licenseRefs: readStoredLicenseRefs(),
  }),

  getters: {
    isValid:
      (state) =>
      (feature: Feature): boolean => {
        if (IS_MOCK) return true;
        const record = state.records[feature];
        if (!record) return false;
        return Date.now() < record.expiresAt;
      },

    hasPremiumFeature:
      (state) =>
      (feature: PremiumFeature): boolean => {
        if (IS_MOCK) return true;
        const record = state.records[feature];
        if (!record) return false;
        return Date.now() < record.expiresAt;
      },

    noticeFor:
      (state) =>
      (feature: Feature): string | null =>
        state.notices[feature] ?? null,

    billingLicenseRef:
      (state) =>
      (feature: Feature): string | null =>
        state.records[feature]?.licenseId ?? state.licenseRefs[feature] ?? null,

    getPremiumFeatureStatus:
      (state) =>
      (feature: PremiumFeature) => {
        const record = state.records[feature] ?? null;
        const active = IS_MOCK || (record ? Date.now() < record.expiresAt : false);
        return {
          feature,
          active,
          notice: state.notices[feature] ?? null,
          licenseId: record?.licenseId ?? state.licenseRefs[feature] ?? null,
          expiresAt: record?.expiresAt ?? null,
        };
      },

    isPremiumTargetUnlocked:
      (state) =>
      (target: PremiumUnlockTarget): boolean =>
        premiumFeaturesForTarget(target).every((feature) => {
          if (IS_MOCK) return true;
          const record = state.records[feature];
          return Boolean(record) && Date.now() < record.expiresAt;
        }),
  },

  actions: {
    async init(): Promise<void> {
      if (this.initialized) return;
      if (initPromise) return initPromise;

      initPromise = (async () => {
        if (IS_MOCK || Capacitor.getPlatform() === 'web') {
          this._setMockEntitlements();
          this.initialized = true;
          return;
        }

        const { deviceId } = await DeviceKey.getDeviceId();
        this.deviceId = deviceId;

        if (!ACTIVATION_PUBLIC_KEY) {
          this.configError =
            'Missing VITE_ACTIVATION_PUBLIC_KEY_BASE64. Configure the activation public key for release builds.';
          this.initialized = true;
          return;
        }

        const { entitlements } = await DeviceKey.getEntitlements({
          publicKey: ACTIVATION_PUBLIC_KEY,
        });
        this.records = this._mapEntitlements(entitlements);
        this._rememberLicenseRefs(entitlements);
        this._clearActiveFeatureNotices();

        this.initialized = true;
        void this.syncEntitlements();
      })();

      try {
        await initPromise;
      } finally {
        initPromise = null;
      }
    },

    async activateLicense(params: {
      key: string;
      feature: Feature;
    }): Promise<ActivationResult> {
      return this._performActivation({
        key: params.key,
        target: params.feature,
      });
    },

    async activatePremiumFeature(params: {
      key: string;
      target: PremiumUnlockTarget;
    }): Promise<ActivationResult> {
      return this._performActivation({
        key: params.key,
        target: params.target,
      });
    },

    async syncEntitlements(): Promise<void> {
      if (
        IS_MOCK ||
        Capacitor.getPlatform() === 'web' ||
        this.configError ||
        !ACTIVATION_PUBLIC_KEY
      ) {
        return;
      }

      const previousRecords = { ...this.records };
      const entitlementsToSync: EntitlementSyncItem[] =
        (Object.keys(this.records) as Feature[]).length > 0
          ? (Object.keys(this.records) as Feature[]).map((feature) => ({
              feature,
              licenseId: this.records[feature]?.licenseId,
            }))
          : ALL_FEATURES.map((feature) => ({
              feature,
              licenseId: this.licenseRefs[feature],
            }));

      try {
        const { revoked } = await DeviceKey.syncEntitlements({
          serverUrl: ACTIVATION_SERVER_URL,
          entitlements: entitlementsToSync,
          publicKey: ACTIVATION_PUBLIC_KEY,
        });

        const { entitlements } = await DeviceKey.getEntitlements({
          publicKey: ACTIVATION_PUBLIC_KEY,
        });
        this.records = this._mapEntitlements(entitlements);
        this._rememberLicenseRefs(entitlements);
        this._rememberLicenseRefs(
          Object.values(previousRecords).filter(Boolean) as EntitlementRecord[]
        );
        this._clearActiveFeatureNotices();
        this._applyRevocationNotices(revoked, previousRecords);
      } catch (err) {
        console.warn('[entitlements] Sync error (will retry on next launch):', err);
      }
    },

    async _performActivation(params: {
      key: string;
      target: ActivationTarget;
    }): Promise<ActivationResult> {
      if (IS_MOCK || Capacitor.getPlatform() === 'web') {
        this._setMockEntitlements();
        const activatedFeatures = targetFeatures(params.target);
        return {
          success: true,
          activatedFeatures,
          info: buildActivationInfo(activatedFeatures, false),
        };
      }

      if (this.configError || !ACTIVATION_PUBLIC_KEY) {
        return {
          success: false,
          error:
            this.configError ??
            'Activation is not configured. Missing VITE_ACTIVATION_PUBLIC_KEY_BASE64.',
        };
      }

      try {
        const result = await DeviceKey.activateLicense({
          key: params.key,
          feature: params.target,
          serverUrl: ACTIVATION_SERVER_URL,
          publicKey: ACTIVATION_PUBLIC_KEY,
        });

        const { entitlements } = await DeviceKey.getEntitlements({
          publicKey: ACTIVATION_PUBLIC_KEY,
        });
        this.records = this._mapEntitlements(entitlements);
        this._rememberLicenseRefs(entitlements);

        const activatedFeatures =
          result.activatedFeatures && result.activatedFeatures.length > 0
            ? result.activatedFeatures
            : targetFeatures(params.target);

        for (const feature of activatedFeatures) {
          delete this.notices[feature];
        }
        writeStoredNotices(this.notices);

        return {
          success: true,
          activatedFeatures,
          info: buildActivationInfo(activatedFeatures, Boolean(result.transferred)),
        };
      } catch (err: unknown) {
        return { success: false, error: normalizeActivationError(err) };
      }
    },

    _setMockEntitlements(): void {
      const now = Date.now();
      for (const feature of ALL_FEATURES) {
        this.records[feature] = {
          deviceId: 'dev-mock',
          feature,
          licenseId: `mock-${feature}`,
          issuedAt: now,
          expiresAt: MOCK_EXPIRES_AT,
          sig: 'mock',
        };
      }
      this.deviceId = 'dev-mock';
      this._rememberLicenseRefs(Object.values(this.records) as EntitlementRecord[]);
      this._clearActiveFeatureNotices();
    },

    _mapEntitlements(
      entitlements: EntitlementRecord[]
    ): Partial<Record<Feature, EntitlementRecord>> {
      const mapped: Partial<Record<Feature, EntitlementRecord>> = {};
      for (const ent of entitlements) {
        mapped[ent.feature] = ent;
      }
      return mapped;
    },

    _rememberLicenseRefs(entitlements: EntitlementRecord[]): void {
      let changed = false;

      for (const ent of entitlements) {
        if (ent.licenseId && this.licenseRefs[ent.feature] !== ent.licenseId) {
          this.licenseRefs[ent.feature] = ent.licenseId;
          changed = true;
        }
      }

      if (changed) {
        writeStoredLicenseRefs(this.licenseRefs);
      }
    },

    _clearActiveFeatureNotices(): void {
      let changed = false;

      for (const feature of Object.keys(this.records) as Feature[]) {
        if (this.records[feature] && this.notices[feature]) {
          delete this.notices[feature];
          changed = true;
        }
      }

      if (changed) {
        writeStoredNotices(this.notices);
      }
    },

    _applyRevocationNotices(
      revoked: EntitlementRevocation[],
      previousRecords: Partial<Record<Feature, EntitlementRecord>>
    ): void {
      let changed = false;

      for (const item of revoked) {
        if (!previousRecords[item.feature] && !this.licenseRefs[item.feature]) continue;

        if (item.reason === 'transferred_to_another_device') {
          this.notices[item.feature] =
            'This license was activated on another device. This device no longer has access.';
          changed = true;
          continue;
        }

        if (item.reason === 'billing_inactive') {
          this.notices[item.feature] =
            'This premium activation is no longer active. Renew it or contact support to restore access.';
          changed = true;
          continue;
        }

        this.notices[item.feature] =
          'This license is no longer active on this device. Please reactivate it if needed.';
        changed = true;
      }

      if (changed) {
        writeStoredNotices(this.notices);
      }
    },
  },
});
