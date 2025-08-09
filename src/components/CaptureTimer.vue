<template>
    <div class="cont">
        <div class="spinner"></div>
        <div ref="animatedBox" class="number" :class="{small: timeLeft === 0}">
          {{ timeLeft > 0 ? timeLeft :"SMILE!" }}
        </div>
    </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  timeLeft: Number
})

const animatedBox = ref(null)

watch(() => props.timeLeft, () => {
  const el = animatedBox.value
  if (!el) return

  el.style.animation = 'none'
  void el.offsetWidth // force reflow
  el.style.animation = '' // reset animation
})
</script>

<style scoped>
/* 
.cont {
  width: 250px;
  height: 250px;
  position: fixed;
  text-align: center;
  font-weight: bold;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 2px solid #aaa;
  border-radius: 50%;
  overflow: hidden;
  opacity: 0.6;
}
.cont::after {
  content: "";
  width: 200px;
  height: 200px;
  position: absolute;
  top: 23px;
  left: 23px;
  border: 1px solid #aaa;
  border-radius: 50%;
  background: #777;
  opacity: 0.5;
  background-image: linear-gradient(transparent calc(50% - 1px), #aaa calc(50% - 1px), #aaa calc(50% + 1px), transparent calc(50% + 1px)), linear-gradient(90deg, transparent calc(50% - 1px), #aaa calc(50% - 1px), #aaa calc(50% + 1px), transparent calc(50% + 1px));
}

.spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 125px;
  height: 100px;
  transform-origin: 0 0;
  background-image: linear-gradient(black, transparent);
  opacity: 0.5;
  animation: spin 1s infinite linear;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(-360deg);
  }
} */

.number {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 2;
  transform: translate(-50%, -50%);
  font-size: 150px;
  font-weight: bold;
  animation: scaleFadeOut 0.9s ease;
  opacity: 0;
}

.small {
  font-size: 130px !important;
}

@keyframes scaleFadeOut {
from {transform: translate(-50%, -50%) scale(0.5); opacity: 0;}
	to {  transform: translate(-50%, -50%) scale(1.3); opacity: 1;}
}
</style>