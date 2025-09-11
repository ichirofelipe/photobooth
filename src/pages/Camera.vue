<template>
  <div>
    <CaptureTimer v-if="timer" :timeLeft="timeLeft"/>
    <div v-if="Capacitor.getPlatform() === 'web'">
      <video id="cameraPreviewWeb" ref="videoRef" :class="{shutter: shutterFlag}" autoplay playsinline></video>
      <canvas ref="canvasRef" style="display: none;"></canvas>
    </div>
    <div v-else>
      <img
        v-if="UVCSrcRef"
        :src="UVCSrcRef"
        :class="{shutter: shutterFlag}"
        alt="UVC preview"
        id="UVCcamera"
      />
      <div v-else style="color:black" id="loader">Loading the Camera…</div>
    </div>
  </div>
</template>

<script setup>
import CaptureTimer from '../components/CaptureTimer.vue';
import useCamera from "../assets/js/camera";
import { onMounted } from 'vue';
import { Capacitor } from '@capacitor/core';

const {
    shutterFlag,
    timer,
    timeLeft,
    videoRef,
    canvasRef,
    UVCSrcRef,
    startCamera,
} = useCamera();

onMounted( async() => await startCamera());

</script>

<style scoped>
video {
  transform: scaleX(-1);
}
.shutter {
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

#loader{
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

#UVCcamera{
  width: auto;
  height: 100%;
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
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