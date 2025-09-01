<template>
  <div id="parent" class="p-8">
    <h1 class="whitespace-nowrap tracking-wider">Choose your template</h1>
    <div id="template-selection" class="grid grid-cols-3">
    
      <a v-for="(frame, index) in frames" class="self-center template-option" :class="{active: booth.selectedTemplate?.id === index}" @click=booth.setTemplate(index,frame.frameData.imageCount)>
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
  column-gap: 3rem;
}
.template-option {
  cursor: pointer;
  position: relative;
}

.template-option img {
  width: auto;
  max-width: 20vw;
  max-height: 35vh;
  margin: 0 auto;
  filter: drop-shadow(3px 3px 5px rgba(0,0,0,0.6));
  transform: rotateZ(0deg) scale(1);
}

.template-option:nth-child(1) {
  transform: rotateZ(-8deg);
}

.template-option:nth-child(2) {
  transform: rotateZ(8deg);
}

.template-option.active img {
  transform: rotateZ(0deg) scale(1.2);
  filter: drop-shadow(0px 0px 10px #0eadb9);
}

</style>