<template>
  <div id="parent" class="p-8 flex flex-col h-full justify-between">
    <h1 class="text-3xl lg:text-4xl uppercase whitespace-nowrap tracking-wider">
      Make it a masterpiece
    </h1>
    <div id="frame-editor" class="flex gap-x-3 mx-auto">
      <div id="frame-viewer" class="">
        <v-stage ref="stageRef" :config="{width: responsiveWidth, height: responsiveHeight}">
          <v-layer>
            <!-- BASE -->
            <v-rect :config="{width: responsiveWidth, height: responsiveHeight, fill: 'white'}" />
          </v-layer>
          <v-layer ref="layerRef" :config="frameData">
            <!-- FRAME -->
            <v-rect :config="getFrameConfig()" />

            <v-rect v-if="logo" :config="getLogoConfig()"/>

            <!-- User Images -->
            <v-rect
              v-for="(img, index) in loadedImages"
              :key="index"
              :config="getImageConfig(img, index)"
            />
          </v-layer>
        </v-stage>
      </div>

      <div class="flex flex-col gap-3">
        <div id="frames" class="frame-designs">
          <h3 class="font-medium text-lg py-1">FRAMES</h3>
          <ul id="design-list" class="frame-options grid grid grid-cols-2 gap-3 scrollbar">
            <li v-for="(design, index) in frameDesigns" :class="{selected: booth.selectedDesign === index}" class="option col-span-1" @click="selectDesign(index)">
              <img :src="design.src"/>
            </li>
          </ul>
        </div>
        <div v-if="variation.length > 1" id="variation" class="frame-designs">
          <h3 class="font-medium text-lg py-1">VARIATION</h3>
          <ul id="variation-list" class="frame-options grid grid grid-cols-5 gap-3 scrollbar">
            <li v-for="(option, index) in variation" class="variation-option col-span-1" :class="{selected: booth.selectedVariation === index}" @click=selectVariation(index)>
              <img :src="option.imgSrc"/>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <button @click="handlePrint" class="pb-button p-5">PROCEED TO PRINT</button>
  </div>
</template>

<script setup>
import useDesign from "../assets/js/design";
import { usePhotoboothStore } from '../assets/js/data';
const booth = usePhotoboothStore();
const {
  responsiveWidth,
  responsiveHeight,
  getFrameConfig,
  handlePrint,
  getImageConfig,
  frameData,
  loadedImages,
  layerRef,
  frameDesigns,
  selectDesign,
  selectVariation,
  getLogoConfig,
  logo,
  variation
} = useDesign();
</script>

<style>
.konvajs-content {
  margin: 0 auto;
}
.konvajs-content canvas{
  box-shadow: inset 0 0px 8px rgba(0, 0, 0, 0.3);
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
    max-height: 12em;
    padding: 0 15px 15px 15px;
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
  /* border: 1px solid #ccc; */
  cursor: pointer;
  border-radius: 5px;
  filter: brightness(0.7);
}

.option:hover {
  filter: brightness(1.2);
}

.option.selected {
  filter: brightness(1.2);
}
.option.selected img {
  padding: 3px;
  background-color: #000;
}

.option img {
  height: 100%;
  max-width: 100%;
  object-fit: cover;
  border-radius: 5px;
  width: 12em;
}

.variation-option {
  filter: brightness(0.7);
}

.variation-option img {
  height: 130px;
}

.variation-option.selected {
  filter: brightness(1);
}

</style>
