<template>
  <div v-if="designStore" id="parent">
    <ul class="floating-tabs">
      <li :class="{ active: currentTab === 'template' }">
        <i @click="currentTab = 'template'" class="mdi mdi-view-grid"></i>
      </li>
      <li :class="{ active: currentTab === 'settings' }">
        <i @click="currentTab = 'settings'" class="mdi mdi-cog"></i>
      </li>
    </ul>

    <h1 class="whitespace-nowrap tracking-wider">Setup</h1>

    <div id="frame-editor" class="flex gap-x-3 mx-auto">
      <!-- Template Tab -->
      <div v-if="currentTab === 'template'" id="frame-viewer">
        <i @click="designStore.setFrame('prev')" class="frame-arrow mdi mdi-chevron-left"></i>
        <i @click="designStore.setFrame('next')" class="frame-arrow mdi mdi-chevron-right"></i>
        <v-stage ref="stageRef" :config="{ width: responsiveWidth, height: responsiveHeight }">
          <v-layer>
            <v-rect :config="{ width: responsiveWidth, height: responsiveHeight, fill: 'white' }" />
          </v-layer>
          <v-layer ref="layerRef" :config="designStore.currentTemplate.frameData">
            <v-rect v-if="getFrameConfig()" :config="getFrameConfig()" />
            <v-rect v-if="getHeaderConfig()" :config="getHeaderConfig()" />
            <v-rect v-if="getFooterConfig()" :config="getFooterConfig()" />
            <template v-if="designStore.loadedTestImages.length">
              <v-rect
                v-for="(imgData, index) in designStore.getImagesForCurrentTemplate(appStore.selectedVariation)"
                :key="index"
                :config="getImageConfig(imgData, index)"
              />
            </template>
            <v-text
              v-else
              :config="{ text: 'Loading Images...', x: 10, y: 10, fontSize: 20, fill: 'black' }"
            />
          </v-layer>
        </v-stage>
      </div>

      <!-- Template Tab Sidebar -->
      <div v-if="currentTab === 'template'" class="flex flex-col gap-3">
        <div class="frame-designs">
          <h3 class="font-medium text-lg py-1">COLORS</h3>
          <div class="color-picker">
            <ColorPicker v-model:pure-color="color" format="hex" />
            <input type="text" :value="color" />
            <button @click="addColor(color)">add</button>
          </div>
          <ul class="frame-options grid grid-cols-4 gap-2 scrollbar">
            <li
              v-for="(colorItem, index) in designStore.mainData.colorData"
              :key="index"
              class="option color col-span-1"
              :class="[
                verifyColor(index),
                { selected: designStore.selectedColorIndex === index },
              ]"
              @click="designStore.setColor(index)"
            >
              <div :style="'background:' + colorItem.hex"></div>
              <span class="text" v-if="verifyColor(index) === 'no-data'"></span>
            </li>
          </ul>
          <button
            @click="deleteColor()"
            :class="{ disabled: designStore.selectedColorIndex === null }"
          >
            Delete Color
          </button>
        </div>

        <div class="frame-designs" :class="{ disabled: verifyUploads() }">
          <h3 class="font-medium text-lg py-1">HEADER</h3>
          <div class="uploader">
            <input type="file" multiple accept="image/*" @change="onFileChange($event, 'header')" />
            <button @click="uploadImages('header')">upload</button>
          </div>
          <ul class="header-list grid grid-cols-2 scrollbar">
            <li
              v-for="(name, index) in designStore.mainData.headerData"
              :key="index"
              class="col-span-1"
              :class="{ selected: designStore.selectedHeaderIndex === index }"
              @click="designStore.setHeader(index)"
            >
              <div>{{ name }}</div>
            </li>
          </ul>
        </div>

        <div class="frame-designs" :class="{ disabled: verifyUploads() }">
          <h3 class="font-medium text-lg py-1">FOOTER</h3>
          <div class="uploader">
            <input type="file" multiple accept="image/*" @change="onFileChange($event, 'footer')" />
            <button @click="uploadImages('footer')">upload</button>
          </div>
          <ul class="header-list grid grid-cols-2 scrollbar">
            <li
              v-for="(name, index) in designStore.mainData.footerData"
              :key="index"
              class="col-span-1"
              :class="{ selected: designStore.selectedFooterIndex === index }"
              @click="designStore.setFooter(index)"
            >
              <div>{{ name }}</div>
            </li>
          </ul>
        </div>

        <button @click="saveColorSettings()">Save Color Settings</button>
      </div>

      <!-- Settings Tab -->
      <div v-if="currentTab === 'settings'" class="flex flex-col gap-3">
        <div class="frame-designs">
          <h3 class="font-medium text-lg py-1">NETWORK SETTINGS</h3>
          <div class="network-input">
            <input
              placeholder="IP ADDRESS"
              type="text"
              @input="onInputSetupText('ipAddress', $event)"
              :value="networkStore.networkData['ipAddress']"
            />
          </div>
        </div>

        <div class="frame-designs">
          <h3 class="font-medium text-lg py-1">HOME LOGO</h3>
          <div class="uploader">
            <input type="file" accept="image/*" @change="onFileChange($event, 'homeLogo')" />
            <button @click="uploadImages('homeLogo', false)">upload</button>
          </div>
          <div class="logo-preview" v-if="designStore.mainData.homeLogoImage?.src">
            <img :src="designStore.mainData.homeLogoImage?.src" alt="Logo Preview" />
          </div>
        </div>
      </div>
    </div>

    <div class="flex gap-3 self-center">
      <button class="pb-button p-5" @click="resetSetup()">RESET</button>
      <router-link v-if="designStore.mainData.colorData?.length > 0" to="/" class="pb-button p-5">DONE</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ColorPicker } from 'vue3-colorpicker';
import 'vue3-colorpicker/style.css';
import { useAppStore } from '@/stores/appStore';
import { useDesignStore } from '@/stores/designStore';
import { useNetworkStore } from '@/stores/networkStore';
import useSetup from '@/composables/useSetup';

const appStore = useAppStore();
const designStore = ref<ReturnType<typeof useDesignStore> | null>(null);
const networkStore = useNetworkStore();
const color = ref('#112357');
const currentTab = ref<'template' | 'settings'>('template');

const {
  responsiveWidth,
  responsiveHeight,
  getFrameConfig,
  getImageConfig,
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
  onInputSetupText,
} = useSetup();

function verifyUploads(): boolean {
  if (designStore.value!.selectedColorIndex === null) return true;
  return verifyColor(designStore.value!.selectedColorIndex) !== 'no-data' || !designStore.value!.selectedColorIndex;
}

onMounted(async () => {
  designStore.value = useDesignStore();
});
</script>

<style lang="scss">
@use '@/assets/scss/frame-editor';
</style>

<style scoped lang="scss">
@use '@/assets/scss/variables' as *;
@use '@/assets/scss/mixins' as *;

#frame-viewer {
  position: relative;
  height: fit-content;
}

.color-picker,
.uploader {
  display: flex;
  border: 1px solid $border-color;
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

.frame-arrow {
  position: absolute;
  z-index: 1;
  top: 50%;
  transform: translateY(-50%);
  width: 25px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: black;
  font-size: 5vh;

  &.mdi-chevron-left {
    left: 0;
    background: linear-gradient(to left, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.6));
  }

  &.mdi-chevron-right {
    right: 0;
    background: linear-gradient(to right, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.6));
  }
}

.header-list {
  padding-top: 10px;
  row-gap: 5px;

  > li {
    border: 1px solid $border-color;
    border-radius: 5px;
    overflow: hidden;
    width: calc(100% - 25px);
    margin: 0 auto;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-align: left;
    padding: 0 5px;
    font-size: 12px;
    position: relative;

    span {
      position: absolute;
      right: 5px;
      top: 0;
    }
  }
}

.uploader ~ ul > li.selected {
  background: #666;
  color: $white;
}

.network-input input {
  width: 95%;
  padding: 5px;
  border: 1px solid $border-color;
  border-radius: 5px;
}

.logo-preview {
  margin-top: 10px;
  display: flex;
  justify-content: center;

  img {
    width: 100px;
  }
}

.floating-tabs {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  background: $white;
  border-top-left-radius: 5px;
  border-bottom-left-radius: 5px;
  box-shadow: 0 0 2px 1px rgba($primary-color, 0.25);
  overflow: hidden;

  li {
    padding: 2px 5px;
    font-size: 25px;
    color: $primary-color;

    &.active {
      color: $white;
      background: $primary-color;
    }
  }
}
</style>
