<template>
  <div class="p-8 flex flex-col h-full justify-between">
    <div v-if="Capacitor.getPlatform() !== 'web'" ref="previewRef" id="cameraPreview"></div>
    <video id="cameraPreviewWeb" v-else ref="videoRef" :class="{shutter: shutterFlag}" autoplay playsinline></video>
    <CaptureTimer v-if="timer" :timeLeft="timeLeft"/>
    <canvas ref="canvasRef" style="display: none;"></canvas>
  </div>
</template>

<script setup lang="ts">
import CaptureTimer from '../components/CaptureTimer.vue';
import useCamera from "../assets/js/camera";
import { onMounted, ref } from 'vue';

const previewRef = ref<HTMLDivElement | null>(null);
const {
    shutterFlag,
    timer,
    timeLeft,
    videoRef,
    canvasRef,
    Capacitor,
    startCamera
} = useCamera();

onMounted( async() => startCamera(previewRef));

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