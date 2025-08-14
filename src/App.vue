<script setup>
import { ArrowUturnLeftIcon } from '@heroicons/vue/24/solid';
import usePhotoboothApp from './assets/js/global';
import RotatePopup from './components/RotatePopup.vue';
const { goBack, isPortrait  } = usePhotoboothApp()
</script>

<template>
  <RotatePopup v-if="isPortrait"/>
  <ArrowUturnLeftIcon v-if="isHomePage" @click="goBack" class="w-15 h-15 absolute cursor-pointer top-0 left-0 p-3"/>
  <transition name="slide" mode="out-in">
      <router-view />
  </transition>
</template>


<script>
export default {
  computed: {
    isHomePage() {
      return this.$route.fullPath !== '/'
    }
  },
}
</script>

<style scoped>
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
