<template>
    <div class="cont">
        <!-- <div class="indicator">
            {{ toOrdinal(imageCount+1) }}
        </div> -->
        <div class="countdown">
            <svg viewBox="0 0 120 120">
              <circle class="border" cx="60" cy="60" r="49"></circle>
              <circle class="border" cx="60" cy="60" r="41"></circle>
              <circle class="bg" cx="60" cy="60" r="45"></circle>
              <circle ref="animatedProgress" class="progress" cx="60" cy="60" r="45"></circle>
            </svg>
        </div>
        <div ref="animatedBox" class="number" :class="{small: timeLeft === 0}">
          {{ timeLeft > 0 
          ? timeLeft : imageCount === 0 
          ? "SMILE!" : `${toOrdinal(imageCount+1)}\npose` }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  timeLeft: number;
  imageCount: number;
}>();

const animatedBox = ref<HTMLElement | null>(null);
const animatedProgress = ref<SVGCircleElement | null>(null);

watch(() => props.timeLeft, () => {
  const el = animatedBox.value;
  const progressEl = animatedProgress.value;
  if (!el || !progressEl) return;

  el.style.animation = 'none';
  progressEl.style.animation = 'none';
  // trigger reflow to restart the animation
  void el.offsetWidth; // force reflow
  void progressEl.offsetWidth; // force reflow
  el.style.animation = ''; // reset animation
  progressEl.style.animation = '';
});

const toOrdinal = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
</script>

<style scoped lang="scss">
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
  color: #ffffff;
  -webkit-text-stroke: 2px #333333;
  white-space: pre-line;
  line-height: 0.8;

  &.small {
    font-size: 90px !important;
  }
}

.countdown {
  position: absolute;
  z-index: 1000;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 30rem;
  height: 30rem;
  display: flex;
  justify-content: center;
  align-items: center;

  svg {
    width: 30rem;
    height: 30rem;
    transform: rotate(-90deg);
  }
}

.border {
  fill: none;
  stroke: rgba(0, 0, 0, 0.4);
  stroke-width: 0.7;
}

circle {
  fill: none;
  stroke: #ddd;
  stroke-width: 10;
}

.bg {
  stroke: transparent;
}

.progress {
  stroke: rgba(240, 240, 240, 0.4);
  stroke-width: 7;
  stroke-linecap: butt;
  stroke-dasharray: 283;
  stroke-dashoffset: 283;
  animation: countdown 0.9s linear;
}

.time {
  position: absolute;
  font-size: 2rem;
  font-weight: bold;
}

.indicator {
  position: absolute;
  z-index: 1000;
  top: 0;
  right: 1vw;
  font-size: 100px;
  font-weight: bold;
  color: #ffffff;
  -webkit-text-stroke: 2px #333333;
  opacity: 0.4;
}
</style>