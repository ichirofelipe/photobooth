<template>
  <div class="p-8 flex flex-col h-full justify-between">
    <CaptureTimer v-if="timer" :timeLeft="timeLeft"/>
    <video ref="videoRef" :class="{shutter: shutterFlag}" autoplay playsinline class="w-full h-full"></video>
    <canvas ref="canvasRef" style="display: none;"></canvas>
  </div>
</template>

<script setup>
import CaptureTimer from '../components/CaptureTimer.vue';
import useDesign from "../assets/js/camera";
const {
  shutterFlag,
  timer,
  timeLeft,
  videoRef,
  canvasRef
} = useDesign();
</script>

<style scoped>
video.shutter {
  animation: shutter 0.75s ease;
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