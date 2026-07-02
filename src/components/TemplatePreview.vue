<template>
  <div class="pb-template-custom" :style="previewStyle" :aria-label="`${template.label} preview`">
    <div class="template-preview-stage">
      <div
        v-for="card in previewCards"
        :key="card.key"
        class="template-preview-card"
        :class="`template-preview-card--${card.position}`"
        :style="cardStyle(card.position)"
      >
        <div
          v-for="(image, index) in card.variation.imagesData"
          :key="`image-${index}`"
          class="template-preview-photo"
          :style="rectStyle(image)"
        ></div>

        <div
          v-if="template.headerEnabled !== false"
          class="template-preview-header"
          :style="rectStyle(card.variation.headerData)"
        >
          <img
            class="template-preview-header-art"
            src="/images/Bride%20%26%20Groom.png"
            alt=""
            aria-hidden="true"
            draggable="false"
          />
        </div>

        <img
          class="template-preview-footer"
          src="/images/footer/bottom-logo-white.png"
          alt=""
          aria-hidden="true"
          :style="rectStyle(card.variation.footerData)"
          draggable="false"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { FrameTemplate, RectData, VariationData } from '@/types';

type PreviewCardPosition = 'single' | 'back' | 'front';

interface PreviewCard {
  key: string;
  position: PreviewCardPosition;
  variation: VariationData;
}

const props = defineProps<{
  template: FrameTemplate;
}>();

const safeBaseWidth = computed(() => Math.max(1, props.template.baseData.width || 1));
const safeBaseHeight = computed(() => Math.max(1, props.template.baseData.height || 1));
const safeFrameWidth = computed(() => Math.max(1, props.template.frameData.width || safeBaseWidth.value));
const safeFrameHeight = computed(() => Math.max(1, props.template.frameData.height || safeBaseHeight.value));

const previewStyle = computed(() => {
  const ratio = safeBaseWidth.value / safeBaseHeight.value;
  return {
    '--preview-ratio': String(ratio),
    '--preview-width': `min(18.5vw, calc(32.375vh * ${ratio}))`,
    '--preview-height': `calc(var(--preview-width) / ${ratio})`,
  };
});

const primaryVariation = computed(() => props.template.variation[0] ?? createFallbackVariation());
const secondaryVariation = computed(() => props.template.variation[1] ?? primaryVariation.value);

const usesNarrowFrame = computed(() => safeFrameWidth.value < safeBaseWidth.value * 0.96);

const previewCards = computed<PreviewCard[]>(() => {
  if (!usesNarrowFrame.value) {
    return [
      {
        key: 'single',
        position: 'single',
        variation: primaryVariation.value,
      },
    ];
  }

  return [
    {
      key: 'back',
      position: 'back',
      variation: primaryVariation.value,
    },
    {
      key: 'front',
      position: 'front',
      variation: secondaryVariation.value,
    },
  ];
});

function createFallbackVariation(): VariationData {
  const frameWidth = safeFrameWidth.value;
  const frameHeight = safeFrameHeight.value;

  return {
    imgSrc: '',
    copy: 1,
    footerData: {
      x: frameWidth * 0.3,
      y: frameHeight * 0.92,
      width: frameWidth * 0.4,
      height: frameHeight * 0.06,
    },
    headerData: {
      x: frameWidth * 0.08,
      y: frameHeight * 0.05,
      width: frameWidth * 0.84,
      height: frameHeight * 0.22,
    },
    imagesData: [],
  };
}

function toPercent(value: number, total: number): string {
  return `${(value / Math.max(1, total)) * 100}%`;
}

function rectStyle(rect: RectData): Record<string, string> {
  return {
    left: toPercent(rect.x, safeFrameWidth.value),
    top: toPercent(rect.y, safeFrameHeight.value),
    width: toPercent(rect.width, safeFrameWidth.value),
    height: toPercent(rect.height, safeFrameHeight.value),
  };
}

function cardStyle(position: PreviewCardPosition): Record<string, string> {
  const width = (safeFrameWidth.value / safeBaseWidth.value) * 100;
  const height = (safeFrameHeight.value / safeBaseHeight.value) * 100;
  const centeredTop = ((safeBaseHeight.value - safeFrameHeight.value) / 2 / safeBaseHeight.value) * 100;
  const singleLeft = ((safeBaseWidth.value - safeFrameWidth.value) / 2 / safeBaseWidth.value) * 100;

  if (position === 'single') {
    return {
      left: `${Math.max(0, singleLeft)}%`,
      top: `${Math.max(0, centeredTop)}%`,
      width: `${width}%`,
      height: `${height}%`,
    };
  }

  const edgeInset = 5;
  const top = Math.max(0, centeredTop);
  const frontLeft = Math.max(edgeInset, 100 - width - edgeInset);

  return {
    left: position === 'back' ? `${edgeInset}%` : `${frontLeft}%`,
    top: position === 'back' ? `${top + 1}%` : `${top + 7}%`,
    width: `${width}%`,
    height: `${height}%`,
  };
}
</script>

<style scoped lang="scss">
@use '@/assets/scss/variables' as *;

.pb-template-custom {
  width: var(--preview-width);
  max-width: 18.5vw;
  max-height: 32.375vh;
  aspect-ratio: var(--preview-ratio);
  margin: auto;
  position: relative;
  filter: drop-shadow(3px 3px 5px rgba(0, 0, 0, 0.6));
  transform: scale(1);
  transition: transform 0.2s ease, filter 0.2s ease;
}

.template-preview-stage {
  position: absolute;
  inset: 2.5%;
  overflow: visible;
}

.template-preview-card {
  position: absolute;
  background: $primary-color;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.8);
  overflow: hidden;
  transform-origin: center center;

  &--back {
    z-index: 1;
    transform: rotate(-7deg);
  }

  &--front {
    z-index: 2;
    transform: rotate(7deg);
  }

  &--single {
    z-index: 1;
  }
}

.template-preview-photo,
.template-preview-header,
.template-preview-footer {
  position: absolute;
}

.template-preview-photo {
  background: $white;
  box-shadow: inset 0 0 0 1px rgba(254, 109, 109, 0.08);
}

.template-preview-header {
  pointer-events: none;
}

.template-preview-header-art {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.template-preview-footer {
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}
</style>
