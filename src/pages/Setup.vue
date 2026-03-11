<template>
  <div v-if="booth" id="parent">
    <h1 class="whitespace-nowrap tracking-wider">
      Setup
      <!-- Tokyo -->
    </h1>

    <div id="frame-editor" class="flex gap-x-3 mx-auto">
      <div id="frame-viewer" class="">
        <i @click="booth.setFrame('prev')" class="frame-arrow mdi mdi-arrow-left"></i>
        <i @click="booth.setFrame('next')" class="frame-arrow mdi mdi-arrow-right"></i>
        <v-stage ref="stageRef" :config="{width: responsiveWidth, height: responsiveHeight}">
          <v-layer>
            <!-- BASE -->
            <v-rect :config="{width: responsiveWidth, height: responsiveHeight, fill: 'white'}" />
          </v-layer>
          <v-layer ref="layerRef" :config="booth.currentTemplate.frameData">
            <!-- FRAME -->
            <v-rect v-if="getFrameConfig()" :config="getFrameConfig()" />

            <v-rect v-if="getHeaderConfig()" :config="getHeaderConfig()"/>

            <v-rect v-if="getFooterConfig()" :config="getFooterConfig()"/>
            <!-- User Images -->
            <template v-if="booth.loadedTestImages.length">
              <v-rect
                v-for="(imgData, index) in booth.getImagesForCurrentTemplate()"
                :key="index"
                :config="getImageConfig(imgData, index)"
              />
            </template>

            <v-text
              v-else
              :config="{
                text: 'Loading Images...',
                x: 10,
                y: 10,
                fontSize: 20,
                fill: 'black'
              }"
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
            <li 
              v-for="(color, index) in booth.mainData.colorData" class="option color col-span-1" :class="[verifyColor(index), {selected: booth.selectedColorIndex === index}]" @click="booth.setColor(index)">
              <div :style="'background:'+color.hex"></div>
              <span class="text" v-if="verifyColor(index) === 'no-data'"></span>
            </li>
          </ul>
          <button @click="deleteColor()" :class="{disabled: booth.selectedColorIndex === null}">Delete Color</button>
        </div>

        <div id="frames" class="frame-designs" :class="{disabled: verifyUploads()}">
          <h3 class="font-medium text-lg py-1">HEADER</h3>
          <div class="uploader">
            <input type="file" multiple accept="image/*" @change="onFileChange($event, 'header')" />
            <button @click="uploadImages('header')">upload</button>
          </div>
          <ul id="header-list" class="grid grid grid-cols-2 scrollbar">
            <li v-for="(names, index) in booth.mainData.headerData" class="col-span-1" :class="{selected: booth.selectedHeaderIndex === index}" @click="booth.setHeader(index)">
              <div>{{ names }}</div>
            </li>
          </ul>
        </div>

        <div id="frames" class="frame-designs" :class="{disabled: verifyUploads()}">
          <h3 class="font-medium text-lg py-1">FOOTER</h3>
          <div class="uploader">
            <input type="file" multiple accept="image/*" @change="onFileChange($event, 'footer')" />
            <button @click="uploadImages('footer')">upload</button>
          </div>
          <ul id="header-list" class="grid grid grid-cols-2 scrollbar">
            <li v-for="(names, index) in booth.mainData.footerData" class="col-span-1" :class="{selected: booth.selectedFooterIndex === index}" @click="booth.setFooter(index)">
              <div>{{ names }}</div>
            </li>
          </ul>
        </div>

        <button @click="saveColorSettings()">Save Color Settings</button>

        <div id="network" class="frame-designs">
          <h3 class="font-medium text-lg py-1">NETWORK SETTINGS</h3>
          <div class="ipaddress">
            <input placeholder="IP ADDRESS" type="text" @input="onInputSetupText('ipAddress', $event)" :value="nextworkValues.ipAddress??booth.networkData['ipAddress']">
          </div>
        </div>

        <div id="frames" class="frame-designs">
          <h3 class="font-medium text-lg py-1">HOME LOGO</h3>
          <div class="uploader">
            <input type="file" accept="image/*" @change="onFileChange($event, 'homeLogo')" />
            <button @click="uploadImages('homeLogo', false)">upload</button>
          </div>
          <div id="logo-preview" v-if="booth.mainData.homeLogoImage?.src">
            <img :src="booth.mainData.homeLogoImage?.src" alt="Logo Preview">
          </div>
        </div>

      </div>
    </div>
    <div class="flex gap-3 self-center">
      <button class="pb-button p-5" @click="resetSetup()">RESET</button>
      <router-link v-if="booth.mainData.colorData?.length > 0" to="/" class="pb-button p-5">DONE</router-link>
    </div>
  </div>
</template>

<script setup>
import useSetup from "../assets/js/setup";
import { ref, onMounted } from 'vue'
import { ColorPicker } from "vue3-colorpicker";
import { usePhotoboothStore } from '../assets/js/data';
import "vue3-colorpicker/style.css";
const booth = ref(null);
const color = ref('#112357');
const nextworkValues = ref({
  ipAddress: undefined
});
const {
  responsiveWidth,
  responsiveHeight,
  getFrameConfig,
  getImageConfig,
  frameData,
  layerRef,
  getFooterConfig,
  getHeaderConfig,
  addColor,
  verifyColor,
  saveColorSettings,
  deleteColor,
  uploadImages,
  onFileChange,
  resetSetup,
  onInputSetupText
} = useSetup();

function verifyUploads() {
  console.log('booth.selectedColorIndex', verifyColor(booth.value.selectedColorIndex));
  if(!booth.value.selectedColorIndex === null) return;
  return verifyColor(booth.value.selectedColorIndex) !== 'no-data' || !booth.value.selectedColorIndex;
}

onMounted(async () => {
  booth.value = usePhotoboothStore();
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

.frame-arrow {
  position: absolute;
  z-index: 1;
  top: 50%;
  transform: translateY(-50%);
  border: 1px solid #ccc;
  width: 25px;
  height: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 100%;
}

.frame-arrow.mdi-arrow-left {
  left: 0px;
}

.frame-arrow.mdi-arrow-right {
  right: 0px;
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

#network input {
  width: 95%;
  padding: 5px;
  border: 1px solid #999;
  border-radius: 5px;
}

#logo-preview {
  margin-top: 10px;
  display: flex;
  justify-content: center;
}

#logo-preview img {
  width: 100px;
}

#frame-viewer {
  position: relative;
  height: fit-content;
}

</style>
