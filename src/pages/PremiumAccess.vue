<template>
  <div id="parent" class="premium-access-page">
    <div class="premium-shell">
      <router-link to="/setup" class="premium-back-link">
        <i class="mdi mdi-arrow-left"></i>
        Back to Setup
      </router-link>

      <section class="premium-hero-card">
        <div class="premium-hero-copy">
          <div class="premium-hero-topline">
            <span class="premium-eyebrow">Premium manual unlock</span>
            <span class="premium-mode-chip">{{ paymentModeLabel }}</span>
          </div>

          <h1 class="premium-title">{{ targetConfig.title }}</h1>
          <p class="premium-summary">{{ targetConfig.summary }}</p>

          <div class="premium-feature-pills" aria-label="Included premium features">
            <span
              v-for="status in includedFeatureStatuses"
              :key="status.feature"
              class="premium-feature-pill"
              :class="{ active: status.active }"
            >
              <i :class="featureIcon(status.feature)"></i>
              {{ featureLabel(status.feature) }}
              <strong>{{ status.active ? 'Unlocked' : 'Locked' }}</strong>
            </span>
          </div>

          <div class="premium-unlock-steps">
            <article v-for="step in unlockSteps" :key="step.title" class="premium-step-card">
              <span>{{ step.number }}</span>
              <div>
                <strong>{{ step.title }}</strong>
                <p>{{ step.description }}</p>
              </div>
            </article>
          </div>
        </div>

        <aside class="premium-activation-card">
          <div class="premium-card-topline">
            <span class="premium-activation-icon">
              <i class="mdi mdi-key-variant"></i>
            </span>
            <span v-if="isFullyUnlocked" class="premium-already-chip">Already activated</span>
          </div>

          <h2>Enter activation key</h2>
          <p class="premium-card-copy">
            Paste the key you received after manual verification. It will unlock
            {{ includedFeatureLabels }} on this device.
          </p>

          <p v-if="entitlementStore.configError" class="premium-message premium-message-error">
            {{ entitlementStore.configError }}
          </p>
          <p v-else-if="isFullyUnlocked" class="premium-message premium-message-success">
            This device already has access to {{ unlockedLabel }}. You can still enter another valid
            key here if you need to replace or upgrade the current activation.
          </p>
          <p v-if="activationError" class="premium-message premium-message-error">
            {{ activationError }}
          </p>
          <p v-if="activationInfo" class="premium-message premium-message-success">
            {{ activationInfo }}
          </p>

          <label class="premium-key-label" for="premium-activation-key">Activation key</label>
          <div class="premium-activation-row">
            <input
              id="premium-activation-key"
              v-model="activationKey"
              class="premium-key-input"
              type="text"
              :placeholder="activationPlaceholder"
              :disabled="isActivating || !!entitlementStore.configError"
              autocomplete="off"
              spellcheck="false"
            />
            <button
              class="premium-activate-btn"
              type="button"
              @click="handleActivate"
              :disabled="isActivating || !activationKey.trim() || !!entitlementStore.configError"
            >
              <i :class="isActivating ? 'mdi mdi-loading premium-spin' : 'mdi mdi-lock-open-outline'"></i>
              {{ isActivating ? 'Activating...' : 'Activate' }}
            </button>
          </div>

          <div class="premium-activation-hint">
            <i class="mdi mdi-shield-check-outline"></i>
            Keys are verified through the activation server, then stored for offline use while valid.
          </div>
        </aside>
      </section>

      <section class="premium-content-grid">
        <article class="premium-panel premium-status-panel">
          <div class="premium-panel-head">
            <div>
              <h2>Access status</h2>
              <p>{{ introCopy }}</p>
            </div>
          </div>

          <ul class="premium-feature-list">
            <li
              v-for="status in includedFeatureStatuses"
              :key="status.feature"
              :class="{ active: status.active }"
            >
              <span class="premium-feature-icon">
                <i :class="featureIcon(status.feature)"></i>
              </span>
              <div>
                <strong>{{ featureLabel(status.feature) }}</strong>
                <p>{{ status.active ? 'Ready to use on this device.' : 'Locked until activation succeeds.' }}</p>
                <p v-if="status.notice" class="premium-feature-notice">{{ status.notice }}</p>
              </div>
              <span class="premium-status-chip" :class="{ active: status.active }">
                {{ status.active ? 'Unlocked' : 'Locked' }}
              </span>
            </li>
          </ul>
        </article>

        <article v-if="premiumAccessConfig.mode === 'manual'" class="premium-panel premium-manual-panel">
          <div class="premium-panel-head">
            <div>
              <h2>Manual payment</h2>
              <p>
                Online checkout is not available yet. Contact us, send proof of payment, then enter
                the activation key we send back.
              </p>
            </div>
          </div>

          <div class="premium-device-card">
            <div>
              <span class="premium-device-label">Device ID to include</span>
              <code>{{ deviceIdLabel }}</code>
            </div>
            <button
              class="premium-copy-btn"
              type="button"
              :disabled="!entitlementStore.deviceId"
              @click="copyDeviceId"
            >
              <i class="mdi mdi-content-copy"></i>
              Copy
            </button>
          </div>
          <p v-if="deviceCopyInfo" class="premium-copy-info">{{ deviceCopyInfo }}</p>

          <div class="premium-contact-sections">
            <section v-if="contactMethods.length" class="premium-contact-section">
              <h3>Contact channels</h3>
              <div class="premium-contact-list">
                <article
                  v-for="method in contactMethods"
                  :key="method.id"
                  class="premium-contact-card"
                >
                  <div class="premium-contact-title-row">
                    <i :class="contactIcon(method.kind)"></i>
                    <strong>{{ method.label }}</strong>
                  </div>
                  <p class="premium-contact-value">{{ method.value }}</p>
                  <p v-if="method.details" class="premium-contact-details">{{ method.details }}</p>
                  <a
                    v-if="method.href"
                    class="premium-contact-action"
                    :href="method.href"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ method.buttonLabel ?? 'Open' }}
                    <i class="mdi mdi-open-in-new"></i>
                  </a>
                </article>
              </div>
            </section>

            <section v-if="paymentMethods.length || noteMethods.length" class="premium-contact-section">
              <h3>Payment details</h3>
              <div class="premium-payment-list">
                <article
                  v-for="method in paymentMethods"
                  :key="method.id"
                  class="premium-payment-card"
                >
                  <div class="premium-contact-title-row">
                    <i :class="contactIcon(method.kind)"></i>
                    <strong>{{ method.label }}</strong>
                  </div>
                  <p class="premium-contact-value">{{ method.value }}</p>
                  <p v-if="method.details" class="premium-contact-details">{{ method.details }}</p>
                </article>
              </div>

              <div v-for="method in noteMethods" :key="method.id" class="premium-note-card">
                <i :class="contactIcon(method.kind)"></i>
                <p>{{ method.value }}</p>
              </div>

              <p v-if="premiumAccessConfig.supportNote" class="premium-support-note">
                {{ premiumAccessConfig.supportNote }}
              </p>
            </section>
          </div>
        </article>

        <article v-else class="premium-panel premium-manual-panel">
          <div class="premium-panel-head">
            <div>
              <h2>Payment configuration</h2>
              <p>
                This screen is ready to switch to an online gateway later. Update
                <code>premiumAccessConfig.mode</code> and connect the future checkout flow here.
              </p>
            </div>
          </div>
        </article>
      </section>

      <div v-if="premiumAccessConfig.futureGatewayNote" class="premium-future-banner">
        <i class="mdi mdi-credit-card-clock-outline"></i>
        <span>{{ premiumAccessConfig.futureGatewayNote }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useEntitlementStore } from '@/stores/entitlementStore';
import {
  isPremiumUnlockTarget,
  premiumAccessConfig,
  premiumFeaturesForTarget,
  premiumTargetConfig,
} from '@/config/premiumAccess';
import type { PremiumContactMethod, PremiumFeature, PremiumUnlockTarget } from '@/types';

const route = useRoute();
const entitlementStore = useEntitlementStore();

const activationKey = ref('');
const activationError = ref<string | null>(null);
const activationInfo = ref<string | null>(null);
const deviceCopyInfo = ref<string | null>(null);
const isActivating = ref(false);

const currentTarget = computed<PremiumUnlockTarget>(() => {
  const rawTarget = route.params.target;
  const candidate = Array.isArray(rawTarget) ? rawTarget[0] : rawTarget;
  return isPremiumUnlockTarget(candidate) ? candidate : 'premium_bundle';
});

const targetConfig = computed(() => premiumTargetConfig(currentTarget.value));
const includedFeatures = computed(() => premiumFeaturesForTarget(currentTarget.value));

const includedFeatureStatuses = computed(() =>
  includedFeatures.value.map((feature) => entitlementStore.getPremiumFeatureStatus(feature))
);

const isFullyUnlocked = computed(() =>
  includedFeatures.value.every((feature) => entitlementStore.hasPremiumFeature(feature))
);

const introCopy = computed(() => {
  if (currentTarget.value === 'premium_bundle') {
    return 'This bundle unlocks both QR Download and Template Editor on the current device.';
  }

  return `This activation unlocks ${featureLabel(currentTarget.value)} on the current device.`;
});

const unlockedLabel = computed(() => {
  if (currentTarget.value === 'premium_bundle') {
    return 'all premium features';
  }
  return featureLabel(currentTarget.value);
});

const includedFeatureLabels = computed(() =>
  includedFeatures.value.map((feature) => featureLabel(feature)).join(' and ')
);

const activationPlaceholder = computed(() => {
  if (currentTarget.value === 'premium_bundle') return 'Enter premium bundle key';
  return `Enter ${featureLabel(currentTarget.value)} key`;
});

const deviceIdLabel = computed(() => entitlementStore.deviceId ?? 'Unavailable');

const contactMethods = computed(() =>
  premiumAccessConfig.contactMethods.filter((method) =>
    ['facebook', 'messenger', 'email', 'phone', 'social'].includes(method.kind)
  )
);

const paymentMethods = computed(() =>
  premiumAccessConfig.contactMethods.filter((method) => ['gcash', 'maya'].includes(method.kind))
);

const noteMethods = computed(() =>
  premiumAccessConfig.contactMethods.filter((method) => method.kind === 'note')
);

const unlockSteps = computed(() => [
  {
    number: '01',
    title: 'Contact',
    description: `Request ${unlockedLabel.value} and send your Device ID.`,
  },
  {
    number: '02',
    title: 'Verify',
    description: 'Send proof of payment through your preferred contact channel.',
  },
  {
    number: '03',
    title: 'Activate',
    description: 'Enter the key we send back to unlock this device.',
  },
]);

const paymentModeLabel = computed(() => {
  if (premiumAccessConfig.mode === 'manual') return 'Manual verification';
  if (premiumAccessConfig.mode === 'xendit') return 'Online checkout';
  return 'Future gateway';
});

function featureLabel(feature: PremiumFeature): string {
  switch (feature) {
    case 'qr_download':
      return 'QR Download';
    case 'template_editor':
      return 'Template Editor';
    default:
      return feature;
  }
}

function featureIcon(feature: PremiumFeature): string {
  switch (feature) {
    case 'qr_download':
      return 'mdi mdi-qrcode-scan';
    case 'template_editor':
      return 'mdi mdi-pencil-ruler';
    default:
      return 'mdi mdi-star-four-points-outline';
  }
}

function contactIcon(kind: PremiumContactMethod['kind']): string {
  switch (kind) {
    case 'facebook':
      return 'mdi mdi-facebook';
    case 'messenger':
      return 'mdi mdi-facebook-messenger';
    case 'email':
      return 'mdi mdi-email-outline';
    case 'gcash':
    case 'maya':
      return 'mdi mdi-wallet-outline';
    case 'phone':
      return 'mdi mdi-phone-outline';
    case 'social':
      return 'mdi mdi-web';
    case 'note':
    default:
      return 'mdi mdi-information-outline';
  }
}

async function copyDeviceId(): Promise<void> {
  const deviceId = entitlementStore.deviceId;
  deviceCopyInfo.value = null;

  if (!deviceId) {
    deviceCopyInfo.value = 'Device ID is unavailable on this device.';
    return;
  }

  if (!navigator.clipboard?.writeText) {
    deviceCopyInfo.value = 'Copy is not available here. Long press the Device ID to copy it.';
    return;
  }

  try {
    await navigator.clipboard.writeText(deviceId);
    deviceCopyInfo.value = 'Device ID copied.';
  } catch {
    deviceCopyInfo.value = 'Copy failed. Long press the Device ID to copy it manually.';
  }
}

async function handleActivate(): Promise<void> {
  activationError.value = null;
  activationInfo.value = null;

  const key = activationKey.value.trim();
  if (!key) {
    activationError.value = 'Enter an activation key first.';
    return;
  }

  isActivating.value = true;
  const result = await entitlementStore.activatePremiumFeature({
    key,
    target: currentTarget.value,
  });
  isActivating.value = false;

  if (!result.success) {
    activationError.value = result.error ?? 'Activation failed.';
    return;
  }

  activationInfo.value = result.info ?? 'Activation successful.';
  activationKey.value = '';
}
</script>

<style scoped lang="scss">
.premium-access-page {
  position: relative;
  min-height: 100%;
  height: 100%;
  overflow-y: auto;
  justify-content: flex-start;
  align-items: stretch;
  padding: 24px;
  background:
    linear-gradient(135deg, rgba(8, 13, 26, 0.92), rgba(19, 31, 53, 0.94)),
    radial-gradient(circle at 14% 18%, rgba(56, 189, 248, 0.2), transparent 34%),
    radial-gradient(circle at 86% 6%, rgba(245, 158, 11, 0.16), transparent 30%),
    #08111f;
  color: #f8fafc;
  box-sizing: border-box;
  isolation: isolate;
}

.premium-bg-orb {
  position: fixed;
  z-index: -1;
  border-radius: 999px;
  filter: blur(8px);
  opacity: 0.72;
  pointer-events: none;
}

.premium-bg-orb-one {
  width: 260px;
  height: 260px;
  left: -80px;
  top: 80px;
  background: rgba(14, 165, 233, 0.22);
}

.premium-bg-orb-two {
  width: 340px;
  height: 340px;
  right: -110px;
  bottom: -80px;
  background: rgba(245, 158, 11, 0.14);
}

.premium-shell {
  width: min(1180px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.premium-back-link {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid rgba(226, 232, 240, 0.16);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.52);
  color: #dbeafe;
  font-size: 14px;
  font-weight: 800;
  text-decoration: none;
  backdrop-filter: blur(14px);
}

.premium-hero-card,
.premium-panel,
.premium-future-banner {
  border: 1px solid rgba(226, 232, 240, 0.14);
  box-shadow: 0 24px 60px rgba(2, 6, 23, 0.32);
  backdrop-filter: blur(18px);
}

.premium-hero-card {
  display: grid;
  grid-template-columns: minmax(0, 1.16fr) minmax(340px, 0.84fr);
  gap: 18px;
  padding: 18px;
  border-radius: 28px;
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.72)),
    linear-gradient(90deg, rgba(14, 165, 233, 0.12), rgba(245, 158, 11, 0.1));
}

.premium-hero-copy {
  padding: 18px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: left;
}

.premium-hero-topline,
.premium-card-topline,
.premium-panel-head,
.premium-contact-title-row,
.premium-activation-hint,
.premium-future-banner {
  display: flex;
  align-items: center;
}

.premium-hero-topline {
  gap: 10px;
  flex-wrap: wrap;
}

.premium-eyebrow {
  margin: 0;
  color: #7dd3fc;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.premium-title {
  margin: 16px 0 0;
  color: #f8fafc;
  font-size: clamp(42px, 7vw, 86px);
  line-height: 0.92;
  letter-spacing: -0.045em;
  text-align: left;
  text-wrap: balance;
}

.premium-summary {
  max-width: 680px;
  margin: 18px 0 0;
  color: #d6e0ef;
  font-size: 17px;
  line-height: 1.65;
}

.premium-mode-chip,
.premium-status-chip,
.premium-already-chip {
  border-radius: 999px;
  padding: 7px 12px;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.premium-mode-chip {
  background: rgba(56, 189, 248, 0.14);
  border: 1px solid rgba(125, 211, 252, 0.24);
  color: #bae6fd;
}

.premium-already-chip {
  background: rgba(34, 197, 94, 0.14);
  border: 1px solid rgba(134, 239, 172, 0.28);
  color: #bbf7d0;
}

.premium-feature-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}

.premium-feature-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(226, 232, 240, 0.12);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  color: #dbeafe;
  font-size: 13px;
  font-weight: 800;

  i {
    color: #7dd3fc;
  }

  strong {
    color: #fcd34d;
  }

  &.active strong {
    color: #86efac;
  }
}

.premium-unlock-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 26px;
}

.premium-step-card {
  display: flex;
  gap: 12px;
  min-height: 110px;
  padding: 14px;
  border: 1px solid rgba(226, 232, 240, 0.1);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.045);

  span {
    color: #fbbf24;
    font-size: 13px;
    font-weight: 900;
  }

  strong {
    display: block;
    margin-bottom: 4px;
    color: #f8fafc;
  }

  p {
    margin: 0;
    color: #cbd5e1;
    font-size: 13px;
    line-height: 1.45;
  }
}

.premium-activation-card {
  display: flex;
  flex-direction: column;
  gap: 13px;
  padding: 24px;
  border: 1px solid rgba(125, 211, 252, 0.22);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(8, 13, 26, 0.95)),
    radial-gradient(circle at top right, rgba(14, 165, 233, 0.14), transparent 34%);
  text-align: left;
}

.premium-card-topline {
  justify-content: space-between;
  gap: 12px;
}

.premium-activation-icon,
.premium-feature-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 16px;
}

.premium-activation-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  color: #111827;
  font-size: 24px;
}

.premium-activation-card h2,
.premium-panel h2 {
  margin: 0;
  color: #f8fafc;
  font-size: 22px;
  letter-spacing: -0.01em;
}

.premium-card-copy {
  margin: 0;
  color: #cbd5e1;
  line-height: 1.6;
}

.premium-message {
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  line-height: 1.5;
  font-size: 14px;
}

.premium-message-error {
  background: rgba(220, 38, 38, 0.16);
  border: 1px solid rgba(248, 113, 113, 0.28);
  color: #fecaca;
}

.premium-message-success {
  background: rgba(22, 163, 74, 0.14);
  border: 1px solid rgba(74, 222, 128, 0.24);
  color: #dcfce7;
}

.premium-key-label,
.premium-device-label {
  color: #93c5fd;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.premium-activation-row {
  display: flex;
  gap: 10px;
}

.premium-key-input {
  flex: 1;
  min-width: 0;
  min-height: 52px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 16px;
  background: rgba(2, 6, 23, 0.76);
  color: #f8fafc;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.03em;
  padding: 0 16px;

  &::placeholder {
    color: rgba(203, 213, 225, 0.68);
    font-weight: 700;
  }

  &:focus {
    outline: 3px solid rgba(56, 189, 248, 0.24);
    border-color: rgba(125, 211, 252, 0.62);
  }
}

.premium-activate-btn,
.premium-copy-btn,
.premium-contact-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 16px;
  text-decoration: none;
  font-weight: 900;
  min-height: 52px;
}

.premium-activate-btn {
  min-width: 154px;
  border: none;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  color: #111827;
  padding: 0 18px;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.premium-spin {
  animation: premium-spin 0.9s linear infinite;
}

.premium-activation-hint {
  gap: 8px;
  margin-top: 2px;
  color: #a5b4fc;
  font-size: 13px;
  line-height: 1.45;
}

.premium-content-grid {
  display: grid;
  grid-template-columns: minmax(300px, 0.78fr) minmax(0, 1.22fr);
  gap: 18px;
}

.premium-panel {
  padding: 22px;
  border-radius: 24px;
  background: rgba(15, 23, 42, 0.76);
  text-align: left;
}

.premium-panel-head {
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;

  p {
    margin: 8px 0 0;
    color: #cbd5e1;
    line-height: 1.55;
  }
}

.premium-feature-list {
  list-style: none;
  padding: 0;
  margin: 18px 0 0;
  display: flex;
  flex-direction: column;
  gap: 12px;

  li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 13px;
    align-items: flex-start;
    padding: 14px;
    border: 1px solid rgba(226, 232, 240, 0.11);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.04);
  }

  strong {
    display: block;
    margin-bottom: 4px;
    color: #f8fafc;
  }

  p {
    margin: 0;
    color: #cbd5e1;
    font-size: 13px;
    line-height: 1.45;
  }
}

.premium-feature-icon {
  width: 42px;
  height: 42px;
  background: rgba(14, 165, 233, 0.14);
  color: #7dd3fc;
  font-size: 20px;
}

.premium-status-chip {
  background: rgba(148, 163, 184, 0.18);
  color: #cbd5e1;

  &.active {
    background: rgba(22, 163, 74, 0.18);
    color: #bbf7d0;
  }
}

.premium-feature-notice {
  margin-top: 6px !important;
  color: #fcd34d !important;
}

.premium-device-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 18px;
  padding: 14px;
  border: 1px solid rgba(125, 211, 252, 0.18);
  border-radius: 18px;
  background: rgba(8, 13, 26, 0.58);

  code {
    display: block;
    margin-top: 6px;
    color: #f8fafc;
    font-size: 13px;
    overflow-wrap: anywhere;
    user-select: all;
  }
}

.premium-copy-btn {
  flex: 0 0 auto;
  min-height: 44px;
  border: 1px solid rgba(125, 211, 252, 0.32);
  background: rgba(14, 165, 233, 0.12);
  color: #dbeafe;
  padding: 0 14px;

  &:disabled {
    opacity: 0.48;
    cursor: not-allowed;
  }
}

.premium-copy-info {
  margin: 8px 0 0;
  color: #bae6fd;
  font-size: 13px;
}

.premium-contact-sections {
  display: grid;
  gap: 18px;
  margin-top: 20px;
}

.premium-contact-section h3 {
  margin: 0 0 10px;
  color: #e2e8f0;
  font-size: 15px;
  letter-spacing: 0.01em;
}

.premium-contact-list,
.premium-payment-list {
  display: grid;
  gap: 12px;
}

.premium-contact-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.premium-payment-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.premium-contact-card,
.premium-payment-card,
.premium-note-card {
  border: 1px solid rgba(226, 232, 240, 0.11);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
}

.premium-contact-card,
.premium-payment-card {
  padding: 15px;
}

.premium-contact-title-row {
  gap: 8px;
  margin-bottom: 8px;

  i {
    color: #7dd3fc;
    font-size: 19px;
  }

  strong {
    color: #f8fafc;
  }
}

.premium-contact-value {
  margin: 0;
  color: #f8fafc;
  font-weight: 900;
  overflow-wrap: anywhere;
}

.premium-contact-details {
  margin: 8px 0 0;
  color: #cbd5e1;
  font-size: 13px;
  line-height: 1.55;
}

.premium-contact-action {
  width: 100%;
  margin-top: 12px;
  border: 1px solid rgba(125, 211, 252, 0.34);
  background: rgba(14, 165, 233, 0.12);
  color: #dbeafe;
}

.premium-note-card {
  display: flex;
  gap: 10px;
  margin-top: 12px;
  padding: 13px;
  color: #fde68a;

  i {
    margin-top: 2px;
    flex: 0 0 auto;
  }

  p {
    margin: 0;
    color: #fde68a;
    line-height: 1.5;
    font-size: 13px;
  }
}

.premium-support-note {
  margin: 12px 0 0;
  color: #cbd5e1;
  font-size: 13px;
  line-height: 1.55;
}

.premium-future-banner {
  gap: 10px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.58);
  color: #bfdbfe;
  font-size: 14px;
  text-align: left;
}

@keyframes premium-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 980px) {
  .premium-hero-card,
  .premium-content-grid {
    grid-template-columns: 1fr;
  }

  .premium-activation-card {
    order: -1;
  }
}

@media (max-width: 720px) {
  .premium-access-page {
    padding: 16px;
  }

  .premium-hero-card,
  .premium-panel {
    border-radius: 20px;
  }

  .premium-hero-card {
    padding: 12px;
  }

  .premium-hero-copy,
  .premium-activation-card,
  .premium-panel {
    padding: 18px;
  }

  .premium-unlock-steps,
  .premium-contact-list,
  .premium-payment-list {
    grid-template-columns: 1fr;
  }

  .premium-activation-row,
  .premium-device-card {
    flex-direction: column;
    align-items: stretch;
  }

  .premium-activate-btn,
  .premium-copy-btn {
    width: 100%;
  }

  .premium-feature-list li {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .premium-status-chip {
    grid-column: 2;
    width: fit-content;
  }
}
</style>

<style scoped lang="scss">
@use '@/assets/scss/variables' as *;

// Palette alignment pass: this block intentionally sits after the richer
// standalone design so the premium page follows the rest of the app.
.premium-access-page {
  min-height: 100%;
  height: 100%;
  overflow-y: auto;
  justify-content: flex-start;
  align-items: stretch;
  padding: 1em;
  background: $bg-color;
  color: $text-color;
  box-sizing: border-box;
}

.premium-shell {
  width: min(1040px, 100%);
  gap: 16px;
}

.premium-back-link {
  min-height: 44px;
  padding: 0.75rem 1.35rem;
  border: 3px solid transparent;
  border-radius: 2rem;
  background: $secondary-color;
  color: $white;
  font-size: 16px;
  font-weight: 700;
  box-shadow: none;
  backdrop-filter: none;

  &:hover {
    color: $white;
    border-color: $primary-color;
    filter: none;
  }
}

.premium-hero-card,
.premium-panel,
.premium-future-banner {
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  backdrop-filter: none;
}

.premium-hero-card {
  grid-template-columns: minmax(0, 1fr) minmax(320px, 400px);
  padding: 18px;
  border-radius: 16px;
  background: $white;
}

.premium-hero-copy {
  padding: 14px 18px;
}

.premium-eyebrow {
  color: $secondary-color;
}

.premium-title {
  margin-top: 12px;
  font-family: $font-display;
  color: $primary-color;
  font-size: clamp(42px, 8vw, 70px);
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: 0.04em;
}

.premium-summary {
  color: $dark;
  font-size: 16px;
  line-height: 1.55;
}

.premium-mode-chip,
.premium-status-chip,
.premium-already-chip {
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.premium-mode-chip {
  border: none;
  background: rgba($secondary-color, 0.12);
  color: $secondary-color;
}

.premium-already-chip {
  border: none;
  background: rgba(#16a34a, 0.12);
  color: #15803d;
}

.premium-feature-pills {
  margin-top: 18px;
}

.premium-feature-pill {
  border: 1px solid #e5e7eb;
  background: #fafafa;
  color: $dark;
  font-size: 12px;

  i {
    color: $secondary-color;
  }

  strong {
    color: #b45309;
  }

  &.active strong {
    color: #15803d;
  }
}

.premium-unlock-steps {
  gap: 12px;
  margin-top: 20px;
}

.premium-step-card {
  min-height: 0;
  padding: 13px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fafafa;

  span {
    color: $primary-color;
  }

  strong {
    color: $dark;
  }

  p {
    color: #6b7280;
  }
}

.premium-activation-card {
  gap: 12px;
  padding: 22px;
  border: 2px solid rgba($secondary-color, 0.18);
  border-radius: 14px;
  background: linear-gradient(180deg, $white 0%, #fafafa 100%);
  box-shadow: inset 0 0 0 1px rgba($white, 0.75), 0 2px 12px rgba(0, 0, 0, 0.08);
}

.premium-activation-icon {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: $secondary-color;
  color: $white;
}

.premium-activation-card h2,
.premium-panel h2 {
  color: $dark;
  font-size: 20px;
}

.premium-card-copy,
.premium-panel-head p,
.premium-support-note {
  color: #6b7280;
}

.premium-message {
  border-radius: 8px;
  font-size: 13px;
}

.premium-message-error {
  border: 1px solid rgba($primary-color, 0.35);
  background: rgba($primary-color, 0.08);
  color: #b91c1c;
}

.premium-message-success {
  border: 1px solid rgba(#16a34a, 0.24);
  background: rgba(#16a34a, 0.1);
  color: #15803d;
}

.premium-key-label,
.premium-device-label {
  color: $border-color;
}

.premium-key-input {
  min-height: 50px;
  border: 1.5px solid #ddd;
  border-radius: 8px;
  background: #fafafa;
  color: $dark;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0;

  &::placeholder {
    color: #9ca3af;
  }

  &:focus {
    outline: none;
    border-color: $secondary-color;
    box-shadow: 0 0 0 3px rgba($secondary-color, 0.12);
    background: $white;
  }
}

.premium-activate-btn,
.premium-copy-btn,
.premium-contact-action {
  min-height: 50px;
  border-radius: 2rem;
  font-weight: 700;
}

.premium-activate-btn {
  border: 3px solid transparent;
  background: $primary-color;
  color: $white;

  &:hover:not(:disabled) {
    border-color: $secondary-color;
    filter: none;
  }

  &:disabled {
    background: $primary-light;
    color: $white;
  }
}

.premium-activation-hint {
  color: #6b7280;
}

.premium-content-grid {
  grid-template-columns: minmax(280px, 0.72fr) minmax(0, 1.28fr);
}

.premium-panel {
  padding: 20px 22px;
  border-radius: 12px;
  background: $white;
}

.premium-feature-list li {
  grid-template-columns: auto minmax(0, 1fr) auto;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafafa;
}

.premium-feature-list strong {
  color: $dark;
}

.premium-feature-list p {
  color: #6b7280;
}

.premium-feature-icon {
  background: rgba($secondary-color, 0.12);
  color: $secondary-color;
}

.premium-status-chip {
  background: #f3f4f6;
  color: #6b7280;

  &.active {
    background: rgba(#16a34a, 0.12);
    color: #15803d;
  }
}

.premium-feature-notice {
  color: #b45309 !important;
}

.premium-device-card {
  border: 1.5px solid #ddd;
  border-radius: 10px;
  background: #fafafa;

  code {
    color: $dark;
  }
}

.premium-copy-btn,
.premium-contact-action {
  border: 1px solid rgba($secondary-color, 0.45);
  background: rgba($secondary-color, 0.1);
  color: $secondary-color;
}

.premium-copy-info {
  color: $secondary-color;
}

.premium-contact-section h3 {
  color: $dark;
}

.premium-contact-card,
.premium-payment-card,
.premium-note-card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafafa;
}

.premium-contact-title-row {
  i {
    color: $secondary-color;
  }

  strong {
    color: $dark;
  }
}

.premium-contact-value {
  color: $dark;
}

.premium-contact-details {
  color: #6b7280;
}

.premium-note-card {
  color: #b45309;

  p {
    color: #b45309;
  }
}

.premium-future-banner {
  border-radius: 12px;
  background: rgba($secondary-color, 0.08);
  color: $secondary-color;
}

@media (max-width: 980px) {
  .premium-hero-card,
  .premium-content-grid {
    grid-template-columns: 1fr;
  }

  .premium-activation-card {
    order: 0;
  }
}

@media (max-width: 720px) {
  .premium-access-page {
    padding: 1em;
  }

  .premium-hero-card,
  .premium-panel,
  .premium-activation-card {
    border-radius: 12px;
  }

  .premium-title {
    font-size: clamp(38px, 14vw, 58px);
    text-align: center;
  }

  .premium-hero-copy {
    text-align: center;
  }

  .premium-hero-topline,
  .premium-feature-pills {
    justify-content: center;
  }
}
</style>
