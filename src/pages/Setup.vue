<template>
  <div id="parent">
    <h1 class="whitespace-nowrap tracking-wider">
      Setup
      <!-- Tokyo -->
    </h1>

    <div v-if="isReady" id="frame-editor" class="flex gap-x-3 mx-auto">
      <div id="frame-viewer" class="">
        <v-stage ref="stageRef" :config="{width: responsiveWidth, height: responsiveHeight}">
          <v-layer>
            <!-- BASE -->
            <v-rect :config="{width: responsiveWidth, height: responsiveHeight, fill: 'white'}" />
          </v-layer>
          <v-layer ref="layerRef" :config="frameData">
            <!-- FRAME -->
            <v-rect v-if="getFrameConfig()" :config="getFrameConfig()" />

            <v-rect v-if="getHeaderConfig()" :config="getHeaderConfig()"/>

            <v-rect v-if="getLogoConfig()" :config="getLogoConfig()"/>
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
          <h3 class="font-medium text-lg py-1">COLORS</h3>
          <div class="color-picker">
            <ColorPicker v-model:pure-color="color" format="hex" />
            <input type="text" :value="color">
            <button @click="addColor(color)">add</button>
          </div>
          <ul id="design-list" class="frame-options grid grid grid-cols-4 gap-2 scrollbar">
            <li v-for="(color, index) in mainData.colorData" class="option color col-span-1" :class="[verifyColor(index), {selected: booth.selectedColorIndex === index}]" @click="booth.setColor(index)">
              <div :style="'background:'+color.hex"></div>
              <span class="text" v-if="verifyColor(index) === 'no-data'"></span>
            </li>
          </ul>
          <button @click="deleteColor()" :class="{disabled: booth.selectedColorIndex === null}">Delete Color</button>
        </div>

        <div id="frames" class="frame-designs" :class="{disabled: verifyUploads()}">
          <h3 class="font-medium text-lg py-1">HEADER</h3>
          <div class="uploader">
            <input type="file" multiple accept="image/*" @change="onFileChange($event, 'headerData')" />
            <button @click="uploadImages('headerData')">upload</button>
          </div>
          <ul id="header-list" class="grid grid grid-cols-2 scrollbar">
            <li v-for="(names, index) in mainData.headerData" class="col-span-1" :class="{selected: booth.selectedHeaderIndex === index}" @click="booth.setHeader(index)">
              <div>{{ names }}</div>
            </li>
          </ul>
        </div>

        <div id="frames" class="frame-designs" :class="{disabled: verifyUploads()}">
          <h3 class="font-medium text-lg py-1">LOGO</h3>
          <div class="uploader">
            <input type="file" multiple accept="image/*" @change="onFileChange($event, 'logoData')" />
            <button @click="uploadImages('logoData')">upload</button>
          </div>
          <ul id="header-list" class="grid grid grid-cols-2 scrollbar">
            <li v-for="(names, index) in mainData.logoData" class="col-span-1" :class="{selected: booth.selectedLogoIndex === index}" @click="booth.setLogo(index)">
              <div>{{ names }}</div>
            </li>
          </ul>
        </div>

        <button @click="saveColorSettings()" :class="{disabled: verifyUploads()}">Save Color Settings</button>
      </div>
    </div>
    <div class="flex gap-3 self-center">
      <button class="pb-button p-5" @click="resetSetup()">RESET</button>
      <router-link to="/" class="pb-button p-5">DONE</router-link>
    </div>
  </div>
</template>

<script setup>
import useSetup from "../assets/js/setup";
import { ref, onMounted } from 'vue'
import { ColorPicker } from "vue3-colorpicker";
import { usePhotoboothStore } from '../assets/js/data';
import "vue3-colorpicker/style.css";
const booth = usePhotoboothStore();
const isReady = ref(false);
const color = ref('#112357');
const {
  responsiveWidth,
  responsiveHeight,
  getFrameConfig,
  getImageConfig,
  frameData,
  loadedImages,
  layerRef,
  getLogoConfig,
  getHeaderConfig,
  addColor,
  mainData,
  verifyColor,
  loadDesignData,
  loadSetupImages,
  saveColorSettings,
  deleteColor,
  uploadImages,
  onFileChange,
  resetSetup
} = useSetup();

function verifyUploads() {
  if(!booth.selectedColorIndex) return;
  return verifyColor(booth.selectedColorIndex) !== 'no-data' || !booth.selectedColorIndex;
}

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

.disabled {
  pointer-events: none;
  filter: brightness(0.5);
}

.frame-designs {
  max-width: 50em;
  width: 100%;
  box-shadow: inset 0 0px 8px rgba(0, 0, 0, 0.3);
  background-color: #ffffff;
  border-radius: 5px;
  height: fit-content;
  padding: 10px 0;
}

.frame-designs h3 {
  padding-top: 0px;
}

.frame-designs > button {
  padding: 5px !important;
  width: 30%;
  border-radius: 5px !important;
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

.option.color.no-data
{
  position: relative;
}

.option.color.no-data .text {
  position: absolute;
  height: 100%;
  width: 100%;
  top: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.75);
}

.option.color.no-data .text::after {
  width: 100%;
  text-align: center;
  content: "Set a Data";
  position: absolute;
  color: #ffffff;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  font-size: 0.8em;
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
  filter: drop-shadow(2px 2px 3px #666);
}

.variation-option.selected, .variation-option:hover {
  filter: brightness(1) drop-shadow(2px 2px 3px #666);
  transition: 0.5s;
}

.color-picker, .uploader {
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

.frame-designs input {
    width: 100%;
    padding: 0 5px;
}

.frame-designs button {
    padding: 0 10px;
    color: #eee;
    font-size: 12px;
    border-radius: 0;
}

#header-list {
  padding-top: 10px;
  row-gap: 5px;
}

#header-list > li {
  border: 1px solid #999;
  border-radius: 5px;
  overflow: hidden;
  width: calc(100% - 25px);
  margin: 0 auto;
  display: -webkit-box;
  -webkit-line-clamp: 1; /* number of lines */
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-align: left;
  padding: 0 5px;
  font-size: 12px;
  position: relative;
}

#header-list > li span {
  position: absolute;
  right: 5px;
  top: 0;
}

button {
  color: #ffffff;
}

.uploader ~ ul > li.selected {
  background: #666;
  color: #fff;
}

</style>
