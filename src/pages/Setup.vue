<template>
  <div id="parent">
    <h1 class="whitespace-nowrap tracking-wider">
      Setup
      <!-- Tokyo -->
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

            <v-rect :config="getHeaderConfig()"/>

            <v-rect :config="getLogoConfig()"/>

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
          <h3 class="font-medium text-lg py-1">COLOR</h3>
          <div class="color-picker">
            <ColorPicker v-model:pure-color="color" format="hex" />
            <input type="text" :value="color">
            <button>add</button>
          </div>
          <ul id="design-list" class="frame-options grid grid grid-cols-2 gap-3 scrollbar">
            <li v-for="(frameDesign, index) in frameDesigns" :class="{selected: booth.selectedDesign === index}" class="option color col-span-1" @click="selectDesign(index)">
              <div :style="'background:'+frameDesign.hex"></div>
            </li>
          </ul>
        </div>

        <div id="frames" class="frame-designs">
          <h3 class="font-medium text-lg py-1">FRAMES</h3>
          <ul id="variation-list" class="frame-options grid grid grid-cols-3 gap-3 scrollbar">
            <li v-for="(option, index) in frames" class="variation-option col-span-1" :class="{selected: booth.selectedTemplate?.id ?? 2 === index}" @click=booth.setTemplate(index,option.frameData.imageCount)>
              <img :src="option.imgSrc"/>
            </li>
          </ul>
        </div>

        <div v-if="variation.length > 0" id="variation" class="frame-designs">
          <h3 class="font-medium text-lg py-1">VARIATION</h3>
          <ul id="variation-list" class="frame-options grid grid grid-cols-3 gap-3 scrollbar">
            <li v-for="(option, index) in variation" class="variation-option col-span-1" :class="{selected: booth.selectedVariation === index}" @click=selectVariation(index)>
              <img :src="option.imgSrc"/>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <button class="pb-button p-5">SAVE & CONTINUE</button>
  </div>
</template>

<script setup>
import useSetup from "../assets/js/setup";
import { usePhotoboothStore } from '../assets/js/data';
import { frameDesigns } from '../data/frameDesigns.json';
import { ref } from 'vue'
import { ColorPicker } from "vue3-colorpicker";
import "vue3-colorpicker/style.css";

const color = ref('#112357');
const booth = usePhotoboothStore();
const {
  responsiveWidth,
  responsiveHeight,
  getFrameConfig,
  getImageConfig,
  frameData,
  loadedImages,
  layerRef,
  selectDesign,
  selectVariation,
  getLogoConfig,
  getHeaderConfig,
  frames,
  variation
} = useSetup();
</script>

<style>
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

.frame-options::-webkit-scrollbar {
    width: 10px;
}
        
.frame-options::-webkit-scrollbar-track {
    background-color: transparent;
    border: 1.5px solid #7e7e7e;
    border-radius: 8px;
}
        
.frame-options::-webkit-scrollbar-thumb {
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

.color-picker {
    display: flex;
    border: 1px solid #999;
    border-radius: 5px;
    overflow: hidden;
    width: calc(100% - 25px);
    margin: 0 auto;
}

.color-picker .vc-color-wrap {
    margin: 0;
    box-shadow: none;
    width: 70px;
}

.color-picker input {
    width: 100%;
    padding: 0 5px;
}

.color-picker button {
    padding: 0 10px;
    color: #eee;
    font-size: 12px;
    border-radius: 0;
}

</style>
