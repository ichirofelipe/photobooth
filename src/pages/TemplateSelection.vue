<template>
  <div id="parent">
    <h1 class="whitespace-nowrap tracking-wider">Pick your Prim style</h1>
    <button
      class="setup"
      :style="{ opacity: setupHoldOpacity }"
      aria-label="Hold to open setup"
      @pointerdown.prevent="startSetupHold"
      @pointerup="cancelSetupHold"
      @pointerleave="cancelSetupHold"
      @pointercancel="cancelSetupHold"
      @contextmenu.prevent
    >
      <svg class="setup-ring" viewBox="0 0 36 36" aria-hidden="true">
        <circle class="setup-ring-track" cx="18" cy="18" r="16" />
        <circle class="setup-ring-fill" cx="18" cy="18" r="16" :stroke-dashoffset="RING_LENGTH - setupHoldProgress * RING_LENGTH" />
      </svg>
      <i class="mdi mdi-cog" :style="{ transform: `rotate(${setupHoldProgress * 180}deg)` }"></i>
    </button>
    <div id="template-selection" :class="'grid grid-cols-' + visibleFrames.length">
      <a
        v-for="item in visibleFrames"
        :key="item.originalIndex"
        class="self-center template-option"
        :class="{ active: selectedTemplateVisible && appStore.selectedTemplate?.id === item.originalIndex }"
        @click="appStore.setTemplate(item.originalIndex, item.frame.frameData.imageCount)"
      >
        <label class="primary-color">{{ item.frame.label }}</label>
        <TemplatePreview v-if="useRenderedTemplatePreviews || !item.frame.imgSrc" :template="item.frame" />
        <img v-else :src="item.frame.imgSrc" class="pb-template" />
      </a>
    </div>
    <router-link v-if="selectedTemplateVisible" to="/camera" class="pb-button p-5"><i class="mdi mdi-camera"></i> Enter the PRIM experience</router-link>
    <button v-else class="pb-button p-5 disabled"><i class="mdi mdi-camera"></i> Enter the PRIM experience</button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/appStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useEntitlementStore } from '@/stores/entitlementStore';
import TemplatePreview from '@/components/TemplatePreview.vue';

const appStore = useAppStore();
const templateStore = useTemplateStore();
const entitlementStore = useEntitlementStore();
const router = useRouter();

// Setup is operator-only: the cog must be held down to open it so guests
// tapping around the booth can't land in it by accident.
const SETUP_HOLD_MS = 1800;
const RING_LENGTH = 100.5; // circumference of the r=16 progress circle

const setupHoldProgress = ref(0);
// Invisible at rest; fades in with the hold so guests never see it.
const setupHoldOpacity = computed(() =>
  setupHoldProgress.value === 0 ? 0 : Math.min(0.3 + setupHoldProgress.value * 0.7, 1)
);
let setupHoldFrame = 0;
let setupHoldStart = 0;

function startSetupHold() {
  setupHoldStart = performance.now();
  trackSetupHold();
}

function trackSetupHold() {
  setupHoldFrame = requestAnimationFrame(() => {
    const elapsed = performance.now() - setupHoldStart;
    setupHoldProgress.value = Math.min(elapsed / SETUP_HOLD_MS, 1);
    if (setupHoldProgress.value >= 1) {
      cancelSetupHold();
      router.push('/setup');
      return;
    }
    trackSetupHold();
  });
}

function cancelSetupHold() {
  cancelAnimationFrame(setupHoldFrame);
  setupHoldProgress.value = 0;
}

onBeforeUnmount(cancelSetupHold);

// Testing switch: render built-in templates from their data instead of using PNG previews.
const useRenderedTemplatePreviews = true;

/**
 * When template_editor is not active, restrict to built-in templates only.
 * Custom templates the owner created remain in allFrames but are hidden until
 * the entitlement is purchased.
 */
const visibleFrames = computed(() => {
  const all = templateStore.activeFrames;
  if (entitlementStore.isValid('template_editor')) return all;
  return all.filter((item) => item.frame.source === 'builtin');
});

const selectedTemplateVisible = computed(() =>
  visibleFrames.value.some((item) => item.originalIndex === appStore.selectedTemplate?.id)
);
</script>

<style scoped lang="scss">
@use '@/assets/scss/variables' as *;

#template-selection {
  column-gap: 3vw;
  width: fit-content;
  margin: 0 auto;
}

.template-option {
  cursor: pointer;
  position: relative;
  height: 100%;
  padding-bottom: 3em;
  display: flex;

  img {
    width: fit-content;
    max-width: 20vw;
    max-height: 35vh;
    margin: auto;
    filter: drop-shadow(3px 3px 5px rgba(0, 0, 0, 0.6));
    transform: scale(1);
  }

  label {
    position: absolute;
    border-radius: 5px;
    font-size: 1.1em;
    white-space: nowrap;
    font-weight: bold;
    display: block;
    bottom: -1em;
    left: 50%;
    transform: translateX(-50%);
  }

  &:nth-child(even) img,
  &:nth-child(even) .pb-template-custom {
    transform: rotateZ(-4deg);
  }

  &:nth-child(odd) img,
  &:nth-child(odd) .pb-template-custom {
    transform: rotateZ(4deg);
  }

  &.active img,
  &.active .pb-template-custom {
    transform: scale(1.1);
    filter: drop-shadow(0px 0px 10px $secondary-color);
  }
}

.setup {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 50%;
  background-color: $white;
  color: $primary-color;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  opacity: 0;
  transition: opacity 0.25s ease;
  cursor: pointer;
  touch-action: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;

  i {
    display: block;
    font-size: 26px;
    line-height: 1;
  }

  .setup-ring {
    position: absolute;
    inset: 3px;
    transform: rotate(-90deg);
    pointer-events: none;

    circle {
      fill: none;
      stroke-width: 3;
      stroke-linecap: round;
    }

    .setup-ring-track {
      stroke: $primary-light;
    }

    .setup-ring-fill {
      stroke: $secondary-color;
      stroke-dasharray: 100.5;
    }
  }
}
</style>
