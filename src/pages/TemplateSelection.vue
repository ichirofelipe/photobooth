<template>
  <div id="parent">
    <h1 class="whitespace-nowrap tracking-wider">Pick your Prim style</h1>
    <router-link to="/setup" class="setup p-5"></router-link>
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
import { computed } from 'vue';
import { useAppStore } from '@/stores/appStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useEntitlementStore } from '@/stores/entitlementStore';
import TemplatePreview from '@/components/TemplatePreview.vue';

const appStore = useAppStore();
const templateStore = useTemplateStore();
const entitlementStore = useEntitlementStore();

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
  top: 0;
  right: 0;
  font-size: 1.5em;
  color: #000;
  background-color: transparent;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  text-align: center;
}
</style>
