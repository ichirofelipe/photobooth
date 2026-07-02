<template>
  <div class="flex flex-col h-full justify-between">
    <div></div>
    <img
      v-if="designStore.mainData?.homeLogoImage?.src"
      id="logo"
      :src="designStore.mainData?.homeLogoImage?.src"
      alt="PRIM Photobooth"
    />
    <p id="touchtostart" class="text-2xl uppercase whitespace-nowrap tracking-wider">
      Touch anywhere to start
    </p>
  </div>
  <router-link v-if="isActivated" to="/templates" class="absolute w-screen h-screen top-0 left-0" />
  <div v-else-if="entitlementStore.initialized" id="modal">
    <div id="modal-content" class="bg-white p-6 rounded-lg shadow-lg max-w-md mx-auto">
      <h2 class="text-2xl font-bold mb-3">{{ modalTitle }}</h2>
      <p class="modal-copy">
        {{ modalCopy }}
      </p>
      <p class="mb-3 text-sm text-gray-500">
        Device ID: {{ entitlementStore.deviceId ?? 'Unavailable' }}
      </p>

      <label class="field-label" for="base-license-key">Activation Key</label>
      <input
        id="base-license-key"
        v-model="licenseKey"
        type="text"
        placeholder="Enter License Key"
        class="border p-2 w-full"
        :class="{ 'input-error': activationError }"
        :disabled="isActivating || !!entitlementStore.configError"
      />
      <p v-if="entitlementStore.configError" class="error-msg">
        {{ entitlementStore.configError }}
      </p>
      <p v-if="baseNotice" class="info-msg">{{ baseNotice }}</p>
      <p v-if="activationInfo" class="info-msg">{{ activationInfo }}</p>
      <p v-if="activationError" class="error-msg">{{ activationError }}</p>
      <button
        class="primary-btn"
        @click="handleActivate"
        :disabled="isActivating || !licenseKey.trim() || !!entitlementStore.configError"
      >
        {{ isActivating ? 'Activating...' : 'Activate Now' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useEntitlementStore } from '@/stores/entitlementStore';
import { useDesignStore } from '@/stores/designStore';

const designStore = useDesignStore();
const entitlementStore = useEntitlementStore();

const licenseKey = ref('');
const activationError = ref<string | null>(null);
const activationInfo = ref<string | null>(null);
const isActivating = ref(false);

const isActivated = computed(() => entitlementStore.isValid('base_app'));
const baseNotice = computed(() => entitlementStore.noticeFor('base_app'));
const hasServerUnavailableMessage = computed(() =>
  [activationError.value, entitlementStore.configError, baseNotice.value].some((message) =>
    message?.toLowerCase().includes('activation server is temporarily unavailable')
  )
);
const modalTitle = computed(() =>
  hasServerUnavailableMessage.value ? 'Activation Server Unavailable' : 'Activation Required'
);
const modalCopy = computed(() =>
  hasServerUnavailableMessage.value
    ? 'Activation server is temporarily unavailable. Connect to the internet and try again.'
    : 'Enter your base_app activation key to use the photobooth. QR Download and Template Editor can be unlocked later from Setup with their own activation keys.'
);

async function handleActivate(): Promise<void> {
  activationError.value = null;
  activationInfo.value = null;
  isActivating.value = true;

  const result = await entitlementStore.activateLicense({
    key: licenseKey.value.trim(),
    feature: 'base_app',
  });

  if (!result.success) {
    activationError.value = result.error ?? 'Activation failed.';
  } else {
    activationInfo.value = result.info ?? 'Activation successful.';
    licenseKey.value = '';
  }

  isActivating.value = false;
}
onMounted(async () => {
  await designStore.reloadMainData();
});
</script>

<style scoped lang="scss">
@use '@/assets/scss/variables' as *;

#logo {
  width: auto;
  max-width: 50vw;
  max-height: 70vh;
  margin: 0 auto;
}

#touchtostart {
  font-size: 30px;
  text-align: center;
  background: linear-gradient(90deg, #000 20%, #fff 40%, #000 60%);
  background-size: 200% auto;
  color: #000;
  margin-bottom: 5px;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shimmer 2s linear infinite;
}

#modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

#modal-content {
  width: min(100%, 480px);
}

.modal-copy {
  font-size: 14px;
  line-height: 1.5;
  color: #4b5563;
  margin-bottom: 12px;
}

.field-label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #475569;
}

.input-error {
  border: 2px solid red;
}

.error-msg {
  color: red;
  font-size: 12px;
  margin-top: 6px;
  text-align: left;
}

.info-msg {
  color: #1d4ed8;
  font-size: 12px;
  margin-top: 6px;
  text-align: left;
  line-height: 1.5;
}

.primary-btn {
  width: 100%;
  color: #fff;
  padding: 12px 16px;
  margin-top: 14px;
  border-radius: 10px;
  font-weight: 700;
  transition: filter 0.2s ease;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.primary-btn {
  background: #2563eb;
}
</style>
