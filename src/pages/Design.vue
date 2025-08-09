<template>
  <div id="parent" class="p-8 flex flex-col h-full justify-between">
    <h1 class="text-4xl uppercase whitespace-nowrap tracking-wider">
      Make it a masterpiece
    </h1>
    <div id="frame-editor" class="grid xl:grid-cols-2">
      <div id="frame-viewer" class="col-span-1">
        <v-stage ref="stageRef" :config="getStageConfig()">
          <v-layer>
            <!-- BASE -->
            <v-rect :config="getBaseConfig()" />
          </v-layer>
          <v-layer ref="layerRef" :config="frameData">
            <!-- FRAME -->
            <v-rect :config="getFrameConfig()" />

            <!-- User Images -->
            <v-rect
              v-for="(img, index) in images"
              :key="index"
              :config="getImageConfig(img, index)"
            />
          </v-layer>
        </v-stage>
      </div>

      <div id="frame-designs" class="col-span-1">
        <ul id="design-list" class="grid grid grid-cols-2 gap-x-3 gap-y-3">
          <li v-for="(design, index) in frameDesigns" :class="{selected: booth.selectedDesign === index}" class="option col-span-1" @click="selectDesign(index)">
            <img :src="design.src"/>
          </li>
        </ul>
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
  getStageConfig,
  getBaseConfig,
  getFrameConfig,
  handlePrint,
  getImageConfig,
  frameData,
  images,
  layerRef,
  frameDesigns,
  selectDesign
} = useDesign();
</script>

<style>
.konvajs-content {
  margin: 0 auto;
}
.konvajs-content canvas{
  box-shadow: inset 0 0px 8px rgba(0, 0, 0, 0.3);
}

.option {
  height: 6em;
  background: #ffffff;
  padding: 10px;
  border: 1px solid #ccc;
  cursor: pointer;
  border-radius: 5px;
  filter: brightness(0.9);
}

.option:hover {
  filter: brightness(1);
}

.option.selected {
  filter: brightness(1);
  border-color: rgb(77, 177, 220);
}

.option img {
  height: 100%;
  width: 100%;
  object-fit: cover;
  border-radius: 5px;
}
</style>
