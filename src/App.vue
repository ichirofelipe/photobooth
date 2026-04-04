<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import { ArrowUturnLeftIcon } from '@heroicons/vue/24/solid';
import RotatePopup from './components/RotatePopup.vue';
import useOrientation from './composables/useOrientation';
import useNavigation from './composables/useNavigation';
import usePermissions from './composables/usePermissions';
import { useNetworkStore } from './stores/networkStore';
import { PhotoServer } from './plugins/photo-server';

const route = useRoute();
const networkStore = useNetworkStore();
const { isPortrait } = useOrientation();
const { goBack } = useNavigation();
const { requestAllPermissions } = usePermissions();

const hasBackArrow = computed(() => {
  return route.fullPath !== '/' && route.fullPath !== '/setup' && route.fullPath !== '/qr';
});

onMounted(async () => {
  await networkStore.load();
  await requestAllPermissions();

  // Start the embedded photo server on Android
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await PhotoServer.startServer({ port: 8080 });
      console.log('PhotoServer started:', result.url);
    } catch (err) {
      console.warn('PhotoServer failed to start:', err);
    }
  }
});
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
