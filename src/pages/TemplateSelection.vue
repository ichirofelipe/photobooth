<template>
  <div id="parent">
    <h1 class="whitespace-nowrap tracking-wider">Choose your template</h1>
    <div id="template-selection" class="grid grid-cols-4">
    
      <a v-for="(frame, index) in frames" class="self-center template-option" :class="{active: booth.selectedTemplate?.id === index}" @click=booth.setTemplate(index,frame.frameData.imageCount)>
        <label class="primary-color">{{ frame.label }}</label>
        <img :src="frame.imgSrc" class="pb-template"/>
      </a>
      
    </div>
    <router-link v-if="booth.selectedTemplate" to="/camera" class="pb-button p-5">CLICK HERE TO PROCEED</router-link>
    <button v-if="!booth.selectedTemplate" class="pb-button p-5 disabled">CLICK HERE TO PROCEED</button>
  </div>
</template>

<script setup>
import { usePhotoboothStore } from '../assets/js/data';
import { frames } from '../data/frameData';
const booth = usePhotoboothStore();
</script>

<style scoped>
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
}

.template-option img {
  width: fit-content;
  max-width: 20vw;
  max-height: 35vh;
  margin: auto;
  filter: drop-shadow(3px 3px 5px rgba(0,0,0,0.6));
  transform: scale(1);
}

.template-option label {
  position: absolute;
  border-radius: 5px;
  font-size: 0.9em;
  white-space: nowrap;
  font-weight: bold;
  display: block;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}

.template-option:nth-child(even) img {
  transform: rotateZ(-4deg);
}

.template-option:nth-child(odd) img {
  transform: rotateZ(4deg);
}

.template-option.active img {
  transform: scale(1.1);
  filter: drop-shadow(0px 0px 10px #0eadb9);
}

</style>