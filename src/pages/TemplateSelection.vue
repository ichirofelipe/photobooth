<template>
  <div id="parent">
    <h1 class="whitespace-nowrap tracking-wider">Pick your Prim style</h1>
    <router-link to="/setup" class="setup p-5"></router-link>
    <div id="template-selection" class="grid grid-cols-4">
      <a
        v-for="(frame, index) in frames"
        :key="index"
        class="self-center template-option"
        :class="{ active: appStore.selectedTemplate?.id === index }"
        @click="appStore.setTemplate(index, frame.frameData.imageCount)"
      >
        <label class="primary-color">{{ frame.label }}</label>
        <img :src="frame.imgSrc" class="pb-template" />
      </a>
    </div>
    <router-link v-if="appStore.selectedTemplate" to="/camera" class="pb-button p-5">Enter the PRIM experience</router-link>
    <button v-if="!appStore.selectedTemplate" class="pb-button p-5 disabled">Enter the PRIM experience</button>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/stores/appStore';
import { frames } from '@/stores/designStore';

const appStore = useAppStore();
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

  &:nth-child(even) img {
    transform: rotateZ(-4deg);
  }

  &:nth-child(odd) img {
    transform: rotateZ(4deg);
  }

  &.active img {
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