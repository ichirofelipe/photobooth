<template>
  <div id="parent">
    <h1 class="whitespace-nowrap tracking-wider">Pick your Prim style</h1>
    <router-link to="/setup" class="setup p-5"></router-link>
    <div id="template-selection" :class="'grid grid-cols-' + templateStore.activeFrames.length">
      <a
        v-for="item in templateStore.activeFrames"
        :key="item.originalIndex"
        class="self-center template-option"
        :class="{ active: appStore.selectedTemplate?.id === item.originalIndex }"
        @click="appStore.setTemplate(item.originalIndex, item.frame.frameData.imageCount)"
      >
        <label class="primary-color">{{ item.frame.label }}</label>
        <img v-if="item.frame.imgSrc" :src="item.frame.imgSrc" class="pb-template" />
        <div v-else class="pb-template-placeholder">{{ item.frame.frameData.imageCount }} photos</div>
      </a>
    </div>
    <router-link v-if="appStore.selectedTemplate" to="/camera" class="pb-button p-5"><i class="mdi mdi-camera"></i> Enter the PRIM experience</router-link>
    <button v-if="!appStore.selectedTemplate" class="pb-button p-5 disabled"><i class="mdi mdi-camera"></i> Enter the PRIM experience</button>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/stores/appStore';
import { useTemplateStore } from '@/stores/templateStore';

const appStore = useAppStore();
const templateStore = useTemplateStore();
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
  padding-bottom: 2.5em;
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
    bottom: -0.5em;
    left: 50%;
    transform: translateX(-50%);
  }

  &:nth-child(even) img,
  &:nth-child(even) .pb-template-placeholder {
    transform: rotateZ(-4deg);
  }

  &:nth-child(odd) img,
  &:nth-child(odd) .pb-template-placeholder {
    transform: rotateZ(4deg);
  }

  &.active img,
  &.active .pb-template-placeholder {
    transform: scale(1.1);
    filter: drop-shadow(0px 0px 10px $secondary-color);
  }
}

.pb-template-placeholder {
  width: 15vw;
  max-height: 35vh;
  aspect-ratio: 3 / 4;
  margin: auto;
  background: #f0f0f0;
  border: 2px dashed #bbb;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #999;
  filter: drop-shadow(3px 3px 5px rgba(0, 0, 0, 0.3));
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