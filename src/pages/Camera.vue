<template>
  <div class="p-8 flex flex-col h-full justify-between">
    <!-- <div v-if="Capacitor.getPlatform() !== 'web'" ref="previewRef" id="cameraPreview"></div> -->
    <video id="cameraPreviewWeb" ref="videoRef" :class="{shutter: shutterFlag}" autoplay playsinline></video>
    <CaptureTimer v-if="timer" :timeLeft="timeLeft"/>
    <canvas ref="canvasRef" style="display: none;"></canvas>
  </div>
</template>

<script setup>
import CaptureTimer from '../components/CaptureTimer.vue';
import useCamera from "../assets/js/camera";
import { onMounted, ref } from 'vue';
import { UvcCameraPlugin } from '@/plugins/UvcCameraPlugin';

const devices = ref([]);

onMounted(async () => {
  try {
    const result = await UvcCameraPlugin.listUvcDevices();
    devices.value = result.devices;

    // Listen for USB permission events
    UvcCameraPlugin.addListener('usbPermission', (data) => {
      console.log('USB permission:', data);
    });
  } catch (err) {
    console.error('Error listing UVC devices', err);
  }
});

const {
    shutterFlag,
    timer,
    timeLeft,
    videoRef,
    canvasRef,
    startCamera,
} = useCamera();


// onMounted( async() => await getUvcDevices());

// onBeforeUnmount(stop);

</script>

<style scoped>
video {
  transform: scaleX(-1);
}
video.shutter {
  animation: shutter 0.75s ease;
}

#cameraPreviewWeb{
  position: fixed;
  width: 90vw;
  height: 100vh;
  left: 5vw;
  top: 0;
}

#cameraPreview{
  position: relative;
  width: 700px;
  top: -95px;
  left: 0;
  background-color: #000;
  pointer-events: none;
  opacity: .5;
}

@keyframes shutter {
  from {
    filter:brightness(0)
  }
  to {
    filter: brightness(1)
  }
}
</style>