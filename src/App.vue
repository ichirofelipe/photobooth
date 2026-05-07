<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import { ArrowUturnLeftIcon } from '@heroicons/vue/24/solid';
import RotatePopup from './components/RotatePopup.vue';
import useOrientation from './composables/useOrientation';
import useNavigation from './composables/useNavigation';
import usePermissions from './composables/usePermissions';
import { useAppStore } from './stores/appStore';
import { useNetworkStore } from './stores/networkStore';
import { useEntitlementStore } from './stores/entitlementStore';
import { useTemplateStore } from './stores/templateStore';
import { PhotoServer } from './plugins/photo-server';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const networkStore = useNetworkStore();
const entitlementStore = useEntitlementStore();
const templateStore = useTemplateStore();
const { isPortrait } = useOrientation();
const { goBack } = useNavigation();
const { requestAllPermissions } = usePermissions();

const hasBackArrow = computed(() => {
  return route.fullPath !== '/' && route.fullPath !== '/setup' && route.fullPath !== '/qr';
});

function enforceQrLockdown(): void {
  if (!entitlementStore.isValid('qr_download') && networkStore.networkData.qrEnabled) {
    networkStore.updateField('qrEnabled', false);
    console.warn('[entitlements] qr_download not active; qrEnabled turned off automatically.');
  }
}

function allowedTemplateSelections() {
  const active = templateStore.activeFrames;
  if (entitlementStore.isValid('template_editor')) return active;
  return active.filter(({ frame }) => frame.source === 'builtin');
}

function sanitizeSelectedTemplate(): void {
  if (!appStore.selectedTemplate) return;

  const stillVisible = allowedTemplateSelections().some(
    ({ originalIndex }) => originalIndex === appStore.selectedTemplate?.id
  );

  if (!stillVisible) {
    appStore.clearTemplate();
    console.warn('[entitlements] Selected template cleared because it is no longer allowed.');
  }
}

function enforceCurrentRouteAccess(): void {
  if (route.fullPath !== '/' && !entitlementStore.isValid('base_app')) {
    void router.replace('/');
    return;
  }

  if (route.name === 'TemplateEditor' && !entitlementStore.isValid('template_editor')) {
    void router.replace({ name: 'PremiumAccess', params: { target: 'template_editor' } });
    return;
  }

  if (route.name === 'QrResult' && !entitlementStore.isValid('qr_download')) {
    void router.replace({ name: 'PremiumAccess', params: { target: 'qr_download' } });
  }
}

onMounted(async () => {
  await networkStore.load();
  await requestAllPermissions();

  if (Capacitor.isNativePlatform()) {
    try {
      const result = await PhotoServer.startServer({ port: 8080 });
      console.log('PhotoServer started:', result.url);
    } catch (err) {
      console.warn('PhotoServer failed to start:', err);
    }
  }

  await templateStore.init();
  templateStore.sanitizeForEntitlement(entitlementStore.isValid('template_editor'));
  sanitizeSelectedTemplate();
  enforceQrLockdown();
  enforceCurrentRouteAccess();
});

watch(
  () => entitlementStore.records,
  () => {
    templateStore.sanitizeForEntitlement(entitlementStore.isValid('template_editor'));
    sanitizeSelectedTemplate();
    enforceQrLockdown();
    enforceCurrentRouteAccess();
  },
  { deep: true }
);
</script>

<template>
  <RotatePopup v-if="isPortrait" />
  <ArrowUturnLeftIcon
    v-if="hasBackArrow"
    @click="goBack"
    class="primary-color w-15 h-15 absolute cursor-pointer top-0 left-0 p-3"
  />
  <transition name="slide" mode="out-in">
    <router-view />
  </transition>
</template>

<style scoped lang="scss">
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateY(30px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateY(-30px);
}
</style>
