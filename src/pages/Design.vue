<template>
  <div id="parent">
    <h1 class="whitespace-nowrap tracking-wider">
      Make it a masterpiece
      <!-- Tokyo -->
    </h1>
    <div v-if="isReady" id="frame-editor" class="flex gap-x-3 mx-auto">
      <div id="frame-viewer" class="">
        <v-stage ref="layerRef" :config="{width: responsiveWidth, height: responsiveHeight}">
          <v-layer>
            <!-- BASE -->
            <v-rect :config="{width: responsiveWidth, height: responsiveHeight, fill: 'white'}" />
          </v-layer>
          <v-layer v-for="i in Array.from({ length: variation[booth.selectedVariation].copy }).keys()" :key="i" :config="frameData">
            <!-- FRAME -->
            <v-rect v-if="getFrameConfig(i)" :config="getFrameConfig(i)" />

            <v-rect v-if="getHeaderConfig(i)" :config="getHeaderConfig(i)"/>

            <v-rect v-if="getLogoConfig(i)" :config="getLogoConfig(i)"/>
            <!-- User Images -->
            <v-rect
              v-for="(data, index) in variation[booth.selectedVariation].imagesData"
              :key="index"
              :config="getImageConfig(index, i, i*variation[booth.selectedVariation].imagesData.length)"
            />

          </v-layer>
        </v-stage>
      </div>

      <div class="flex flex-col gap-3">
        <div id="frames" class="frame-designs">
          <h3 class="font-medium text-lg py-1">COLOR</h3>
          <ul id="design-list" class="frame-options grid grid grid-cols-3 gap-3 scrollbar">
            <li v-for="(color, index) in mainData.colorData" :class="{selected: booth.selectedDesign === index}" class="option color col-span-1" @click="booth.setDesign(index)">
              <div :style="'background:'+color.hex"></div>
            </li>
          </ul>
        </div>
        <div v-if="variation.length > 1" id="variation" class="frame-designs">
          <h3 class="font-medium text-lg py-1">VARIATION</h3>
          <ul id="variation-list" class="frame-options grid grid grid-cols-3 gap-3 scrollbar">
            <li v-for="(option, index) in variation" class="variation-option col-span-1" :class="{selected: booth.selectedVariation === index}" @click="booth.setVariation(index)">
              <img :src="option.imgSrc"/>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <button @click="handlePrint" class="pb-button p-5">PROCEED TO PRINT</button>
    <!-- <button class="pb-button p-5">PROCEED TO PRINT</button> -->
  </div>
</template>

<script setup>
import useDesign from "../assets/js/design";
import { onMounted, ref } from "vue";
import { usePhotoboothStore } from '../assets/js/data';

const isReady = ref(false);
const booth = usePhotoboothStore();
const {
  responsiveWidth,
  responsiveHeight,
  getFrameConfig,
  handlePrint,
  getImageConfig,
  frameData,
  layerRef,
  getLogoConfig,
  getHeaderConfig,
  variation,
  mainData,
  loadDesignData,
  loadSetupImages,
} = useDesign();

onMounted(async () => {
    await loadDesignData();
    await loadSetupImages();
    isReady.value = true;
});
</script>

<style scoped>
.konvajs-content {
  margin: 0 auto;
}
.konvajs-content canvas{
  box-shadow: inset 0 0px 8px rgba(0, 0, 0, 0.3);
  border-radius: 5px;
}

.frame-designs {
  max-width: 50em;
  width: 100%;
  box-shadow: inset 0 0px 8px rgba(0, 0, 0, 0.3);
  background-color: #ffffff;
  border-radius: 5px;
  height: fit-content;
}

.frame-options {
    overflow-y: auto;
    max-height: 13em;
    padding: 15px;
    min-width: 20em;
}

#design-list::-webkit-scrollbar {
    width: 10px;
}
        
#design-list::-webkit-scrollbar-track {
    background-color: transparent;
    border: 1.5px solid #7e7e7e;
    border-radius: 8px;
}
        
#design-list::-webkit-scrollbar-thumb {
    background-color: #f1f1f1;
    border: 2px solid #616161;
    border-radius: 8px;
}

.option {
  height: 5em;
  background: #ffffff;
  cursor: pointer;
  border-radius: 3px;
  position: relative;
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.9),
              0 2px 6px rgba(0, 0, 0, 0.5);
}

.option:not(.color) {
  filter: brightness(0.7);
}

.option:not(.color):hover {
  filter: brightness(1.2);
}

.option:not(.color).selected {
  filter: brightness(1.2);
}

.option:not(.color).selected img {
  padding: 3px;
  background-color: #000;
}

.option.color:hover {
  box-shadow: 0 0 0 2px white, 0 0 0 4px rgb(90, 90, 90);
}

.option.color.selected {
  box-shadow: 0 0 0 2px white, 0 0 0 4px rgb(90, 90, 90);
}

.option > * {
  height: 100%;
  max-width: 100%;
  object-fit: cover;
  border-radius: 3px;
}

.variation-option {
  cursor: pointer;
  filter: brightness(0.7);
}

.variation-option img {
  max-height: 100px;
  max-width: 6.5em;
  transform: rotateZ(-7deg);
  margin: 0 auto;
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.9),
              0 2px 6px rgba(0, 0, 0, 0.5);
}

.variation-option.selected, .variation-option:hover {
  filter: brightness(1);
  transition: 0.5s;
}

</style>
