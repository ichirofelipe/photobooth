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
      <div v-if="currentTab === 'settings'" class="settings-panel">
        <div class="settings-card">
          <h3 class="settings-heading"><i class="mdi mdi-puzzle-outline"></i> Template Management</h3>
          <div class="template-manage">
            <p class="template-manage-info">
              {{ templateStore.allFrames.length }} templates · {{ templateStore.activeIndices.length }} active
            </p>
            <router-link to="/template-editor" class="manage-templates-btn">
              <i class="mdi mdi-pencil-ruler"></i> Manage Templates
            </router-link>
          </div>
        </div>

        <div class="settings-card">
          <h3 class="settings-heading"><i class="mdi mdi-wifi"></i> Network Settings</h3>
          <div class="settings-field">
            <label class="settings-label">Printer IP Address</label>
            <input
              class="settings-input"
              placeholder="e.g. 192.168.1.100"
              type="text"
              @input="onInputSetupText('ipAddress', $event)"
              :value="networkStore.networkData['ipAddress']"
            />
          </div>
        </div>

        <div class="settings-card">
          <h3 class="settings-heading"><i class="mdi mdi-qrcode"></i> QR Code Soft Copy</h3>
          <div class="toggle-row">
            <span class="toggle-label">Enable QR download for guests</span>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="networkStore.networkData.qrEnabled"
                @change="networkStore.updateField('qrEnabled', ($event.target as HTMLInputElement).checked)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="settings-card">
          <h3 class="settings-heading"><i class="mdi mdi-image-outline"></i> Home Logo</h3>
          <div class="settings-upload">
            <input type="file" accept="image/*" @change="onFileChange($event, 'homeLogo')" />
            <button @click="uploadImages('homeLogo', false)"><i class="mdi mdi-upload"></i> Upload</button>
          </div>
          <div class="logo-preview" v-if="designStore.mainData.homeLogoImage?.src">
            <img :src="designStore.mainData.homeLogoImage?.src" alt="Logo Preview" />
          </div>
        </div>
      </div>
    </div>

    <div class="flex gap-3 self-center">
      <button class="pb-button p-5" @click="resetSetup()"><i class="mdi mdi-refresh"></i> RESET</button>
      <router-link v-if="designStore.mainData.colorData?.length > 0" to="/" class="pb-button p-5"><i class="mdi mdi-check"></i> DONE</router-link>
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
import { useTemplateStore } from '@/stores/templateStore';
import useSetup from '@/composables/useSetup';

const appStore = useAppStore();
const designStore = ref<ReturnType<typeof useDesignStore> | null>(null);
const networkStore = useNetworkStore();
const templateStore = useTemplateStore();
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
  await designStore.value.init();
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
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

// ==================== SETTINGS PANEL ====================
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 480px;
  width: 100%;
}

.settings-card {
  background: $white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  padding: 18px 22px;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }
}

.settings-heading {
  font-size: 15px;
  font-weight: 700;
  color: $dark;
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;

  i {
    font-size: 20px;
    color: $secondary-color;
  }
}

.settings-field {
  padding: 0 2px;
}

.settings-label {
  display: block;
  font-size: 12px;
  color: $border-color;
  margin-bottom: 6px;
  font-weight: 500;
}

.settings-input {
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: #fafafa;

  &:focus {
    outline: none;
    border-color: $secondary-color;
    box-shadow: 0 0 0 3px rgba($secondary-color, 0.12);
    background: $white;
  }
}

.settings-upload {
  display: flex;
  border: 1.5px solid #ddd;
  border-radius: 8px;
  overflow: hidden;

  input[type="file"] {
    flex: 1;
    padding: 8px 10px;
    font-size: 13px;
    border: none;
    background: #fafafa;
  }

  button {
    border-radius: 0 8px 8px 0;
    padding: 8px 16px;
    font-size: 13px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
}

.settings-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.template-manage {
  padding: 4px 0;
  text-align: center;
}

.template-manage-info {
  font-size: 13px;
  color: $border-color;
  margin-bottom: 10px;
}

.manage-templates-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  background: $secondary-color;
  color: $white;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;

  &:hover {
    filter: brightness(1.15);
    color: $white;
  }
}

.floating-tabs {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  background: $white;
  border-top-left-radius: 12px;
  border-bottom-left-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  z-index: 10;

  li {
    padding: 6px 8px;
    font-size: 24px;
    color: $secondary-color;
    cursor: pointer;
    transition: all 0.2s ease;

    &.active {
      color: $white;
      background: $secondary-color;
    }

    &:hover:not(.active) {
      background: rgba($secondary-color, 0.08);
    }
  }
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 15px;
}

.toggle-label {
  font-size: 14px;
  color: $dark;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: $border-color;
  border-radius: 26px;
  transition: 0.3s;

  &::before {
    content: '';
    position: absolute;
    height: 20px;
    width: 20px;
    left: 3px;
    bottom: 3px;
    background-color: $white;
    border-radius: 50%;
    transition: 0.3s;
  }
}

.toggle-switch input:checked + .toggle-slider {
  background-color: $secondary-color;
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(22px);
}
</style>
