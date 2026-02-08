<template>
  <div class="flex flex-col h-full justify-between">
    <div></div>
    <img v-if="booth.mainData?.homeLogoImage?.src" id="logo" :src="booth.mainData?.homeLogoImage?.src" alt="PRIM Photobooth">
    <!-- <h1 class="text-7xl font-bold tracking-widest">LOGO</h1> -->
    <p id="touchtostart" class="text-2xl uppercase whitespace-nowrap tracking-wider">Touch anywhere to start</p>
  </div>
  <router-link v-if="isActivate" to="/templates" class="absolute w-screen h-screen top-0 left-0"></router-link>
  <div v-else id="modal">
    <div id="modal-content" class="bg-white p-6 rounded-lg shadow-lg max-w-md mx-auto">
      <h2 class="text-2xl font-bold mb-4">Activation Required</h2>
      <p class="mb-4">Please activate your device to use the photobooth</p>
      <p class="mb-4">Device ID: {{ deviceId }}</p>
      <input type="text" placeholder="Enter License Key" class="border p-2 w-full" v-model="licenseKey" :class="{ 'input-error': errors.licenseKey }"/>
      <p v-if="errors.licenseKey" class="error-msg">
        {{ errors.licenseKey }}
      </p>
      <button @click="validateKey(licenseKey)" class="bg-blue-500 text-white px-4 py-2 mt-4 rounded hover:bg-blue-600">Activate Now</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import useDeviceKey from '@/assets/js/deviceKey';
import { usePhotoboothStore } from '../assets/js/data';

const booth = usePhotoboothStore();
const licenseKey = ref("");

onMounted(async () => {
    await checkActivation();
    await fetchDeviceId();
    await booth.reloadMainData();
});

const {
  isActivate,
  deviceId,
  validateKey,
  checkActivation,
  fetchDeviceId,
  errors
} = useDeviceKey();

</script>

<style scoped>
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

.input-error {
  border: 2px solid red;
}

.error-msg {
  color: red;
  font-size: 12px;
  margin-top: 4px;
  text-align: left;
}

@keyframes fadePulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
@keyframes scalePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
@keyframes shimmer {
  to { background-position: 200% center; }
}
</style>