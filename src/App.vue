<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowUturnLeftIcon } from '@heroicons/vue/24/solid';
import RotatePopup from './components/RotatePopup.vue';
import useOrientation from './composables/useOrientation';
import useNavigation from './composables/useNavigation';
import { useNetworkStore } from './stores/networkStore';

const route = useRoute();
const router = useRouter();
const networkStore = useNetworkStore();
const { isPortrait } = useOrientation();
const { goBack } = useNavigation();

const hasBackArrow = computed(() => {
  return route.fullPath !== '/' && route.fullPath !== '/setup';
});

let pollInterval: ReturnType<typeof setInterval> | undefined;

onMounted(async () => {
  await networkStore.load();
});

onBeforeUnmount(() => {
  clearInterval(pollInterval);
});

async function checkSetupFlag(): Promise<void> {
  try {
    if (!networkStore.networkData.ipAddress) {
      router.push('/setup');
    }
    const res = await fetch(`http://${networkStore.networkData.ipAddress}:3000/setup-status`);
    const json = await res.json();
    if (json.setup) {
      router.push('/setup');
    }
  } catch (err) {
    console.log('Polling error', err);
  }
}
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
