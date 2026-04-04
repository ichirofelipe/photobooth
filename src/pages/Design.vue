<template>
  <div id="parent">
    <h1 class="whitespace-nowrap tracking-wider">Make it a masterpiece</h1>
    <div v-if="isReady" id="frame-editor" class="flex gap-x-3 mx-auto">
      <div id="frame-viewer">
        <v-stage ref="layerRef" :config="{ width: responsiveWidth, height: responsiveHeight }">
          <v-layer>
            <v-rect :config="{ width: responsiveWidth, height: responsiveHeight, fill: 'white' }" />
          </v-layer>
          <v-layer
            v-for="i in Array.from({ length: variation[appStore.selectedVariation].copy }).keys()"
            :key="i"
            :config="frameData"
          >
            <v-rect v-if="getFrameConfig(i)" :config="getFrameConfig(i)" />
            <v-rect v-if="getHeaderConfig(i)" :config="getHeaderConfig(i)" />
            <v-rect v-if="getFooterConfig(i)" :config="getFooterConfig(i)" />
            <v-rect
              v-for="(data, index) in variation[appStore.selectedVariation].imagesData"
              :key="index"
              :config="getImageConfig(index, i, i * variation[appStore.selectedVariation].imagesData.length)"
            />
          </v-layer>
        </v-stage>
      </div>

      <div class="flex flex-col gap-3">
        <div class="frame-designs">
          <h3 class="font-medium text-lg py-1">COLOR</h3>
          <ul class="frame-options grid grid-cols-3 gap-3 scrollbar">
            <li
              v-for="(color, index) in mainData.colorData"
              :key="index"
              :class="{ selected: appStore.selectedDesign === index }"
              class="option color col-span-1"
              @click="appStore.setDesign(index)"
            >
              <div :style="'background:' + color.hex"></div>
            </li>
          </ul>
        </div>
        <div v-if="variation.length > 1" class="frame-designs">
          <h3 class="font-medium text-lg py-1">VARIATION</h3>
          <ul class="frame-options grid grid-cols-3 gap-3 scrollbar">
            <li
              v-for="(option, index) in variation"
              :key="index"
              class="variation-option col-span-1"
              :class="{ selected: appStore.selectedVariation === index }"
              @click="appStore.setVariation(index)"
            >
              <img :src="option.imgSrc" />
            </li>
          </ul>
        </div>
      </div>
    </div>
    <button @click="handlePrint()" class="pb-button p-5" :class="{ disabled: isPrintPressed }" :disabled="isPrintPressed">
      <i class="mdi" :class="isPrintPressed ? 'mdi-loading mdi-spin' : 'mdi-printer'"></i>
      {{ isPrintPressed ? 'PRINTING...' : 'PROCEED TO PRINT' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useAppStore } from '@/stores/appStore';
import { useNetworkStore } from '@/stores/networkStore';
import useDesign from '@/composables/useDesign';

const isReady = ref(false);
const appStore = useAppStore();
const networkStore = useNetworkStore();

const {
  responsiveWidth,
  responsiveHeight,
  getFrameConfig,
  handlePrint,
  getImageConfig,
  frameData,
  layerRef,
  getFooterConfig,
  getHeaderConfig,
  variation,
  mainData,
  loadDesignData,
  loadSetupImages,
  isPrintPressed,
} = useDesign();

onMounted(async () => {
  await networkStore.load();
  await loadDesignData();
  await loadSetupImages();
  isReady.value = true;
});
</script>

<style lang="scss">
@use '@/assets/scss/frame-editor';
</style>
