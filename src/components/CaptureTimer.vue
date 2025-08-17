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
.number {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1000;
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