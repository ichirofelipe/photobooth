<script setup lang="ts">
import { ref, onMounted } from 'vue';

const videoRef = ref<HTMLVideoElement | null>(null);

onMounted(async () => {
  initRotatePhoneVideo();
});

function initRotatePhoneVideo(): void {
    const video = videoRef.value;
    if (!video) return;
    video.playbackRate = 1.25; // PLAY BACK SPEED

    // Initial fade-in
    fadeIn();

    // When video ends, fade out, restart, fade in
    video.addEventListener("ended", () => {
        fadeOut();

        setTimeout(() => {
            video.currentTime = 0; // rewind
            video.play();
            fadeIn();
        }, 500); // wait for fade out
    });

}

function fadeOut(): void {
    if (videoRef.value) {
        videoRef.value.style.opacity = "0";
    }
}

function fadeIn(): void {
    if (videoRef.value) {
        videoRef.value.style.opacity = "1";
    }
}
</script>

<template>
    <div id="rotate-popup">
        <div class="video-container">
          <video
            ref="videoRef"
            src="/videos/rotate_phone.mp4"
            class="fade-video"
            autoplay
            muted
            playsinline
          ></video>
        </div>
    </div>
</template>

<style scoped lang="scss">
#rotate-popup {
  position: fixed;
  width: 100vw;
  height: 100vh;
  top: 0;
  left: 0;
  background: #000000;
  z-index: 1000;
}

.video-container {
  position: absolute;
  width: 200%;
  height: auto;
  overflow: hidden;
  top: 50%;
  left: 0;
  transform: translate(-25%, -50%);
}

.fade-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 1s ease;
}
</style>