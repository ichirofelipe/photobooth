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
              :class="[verifyColor(index), { selected: designStore.selectedColorIndex === index }]"
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

      <div v-if="currentTab === 'settings'" class="settings-panel">
        <div class="settings-card">
          <h3 class="settings-heading"><i class="mdi mdi-puzzle-outline"></i> Template Management</h3>
          <div class="template-manage">
            <p class="template-manage-info">
              {{ templateStore.allFrames.length }} templates | {{ templateStore.activeIndices.length }} active
            </p>
            <router-link
              v-if="entitlementStore.hasPremiumFeature('template_editor')"
              to="/template-editor"
              class="manage-templates-btn"
            >
              <i class="mdi mdi-pencil-ruler"></i> Manage Templates
            </router-link>
            <button
              v-else
              class="manage-templates-btn"
              type="button"
              @click="openPremiumAccess('template_editor')"
            >
              <i class="mdi mdi-lock-outline"></i> Unlock Template Editor
            </button>
          </div>
        </div>

        <div class="settings-card">
          <div class="settings-card-head">
            <h3 class="settings-heading"><i class="mdi mdi-shield-key-outline"></i> Premium Access</h3>
            <button class="settings-ghost-btn" @click="syncLicenses" :disabled="isSyncingLicenses">
              {{ isSyncingLicenses ? 'Refreshing...' : 'Refresh' }}
            </button>
          </div>

          <p class="premium-device-id">Device ID: {{ entitlementStore.deviceId ?? 'Unavailable' }}</p>
          <p v-if="entitlementStore.configError" class="premium-error">{{ entitlementStore.configError }}</p>

          <div v-for="license in premiumLicenses" :key="license.feature" class="premium-row">
            <div class="premium-meta">
              <div>
                <strong>{{ license.label }}</strong>
                <p class="premium-status">{{ license.active ? 'Unlocked' : 'Locked' }}</p>
              </div>
              <span class="premium-chip" :class="{ active: license.active }">
                {{ license.active ? 'Active' : 'Locked' }}
              </span>
            </div>

            <p v-if="license.notice" class="premium-notice">{{ license.notice }}</p>
            <p v-if="license.info" class="premium-info">{{ license.info }}</p>

            <p v-if="!license.canActivate" class="premium-help">
              Base app keys are entered on the start screen. Premium add-ons are activated separately.
            </p>

            <div v-else class="premium-actions premium-actions-stack">
              <button
                class="settings-ghost-btn premium-subscribe-btn"
                type="button"
                @click="license.target && openPremiumAccess(license.target)"
              >
                {{ license.active ? `View ${license.label} Access` : `Unlock ${license.label}` }}
              </button>
            </div>
          </div>

          <div class="premium-row">
            <div class="premium-meta">
              <div>
                <strong>Premium Bundle</strong>
                <p class="premium-status">
                  {{ premiumBundleUnlocked ? 'QR Download and Template Editor are unlocked.' : 'Unlock both premium features with one key.' }}
                </p>
              </div>
              <span class="premium-chip" :class="{ active: premiumBundleUnlocked }">
                {{ premiumBundleUnlocked ? 'Active' : 'Locked' }}
              </span>
            </div>

            <p class="premium-info">
              The bundle can unlock both premium features together after manual payment verification.
            </p>

            <div class="premium-actions premium-actions-stack">
              <button
                class="settings-ghost-btn premium-subscribe-btn"
                type="button"
                @click="openPremiumAccess('premium_bundle')"
              >
                {{ premiumBundleUnlocked ? 'View Bundle Access' : 'Unlock Premium Features' }}
              </button>
            </div>
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
              :value="networkStore.networkData.ipAddress"
            />
          </div>
        </div>

        <div class="settings-card">
          <h3 class="settings-heading"><i class="mdi mdi-qrcode"></i> QR Code Soft Copy</h3>
          <div class="toggle-row">
            <span class="toggle-label">Enable QR download for guests</span>
            <template v-if="entitlementStore.hasPremiumFeature('qr_download')">
              <label class="toggle-switch">
                <input
                  type="checkbox"
                  :checked="networkStore.networkData.qrEnabled"
                  @change="networkStore.updateField('qrEnabled', ($event.target as HTMLInputElement).checked)"
                />
                <span class="toggle-slider"></span>
              </label>
            </template>
            <template v-else>
              <button class="lock-badge lock-badge-action" type="button" @click="openPremiumAccess('qr_download')">
                <i class="mdi mdi-lock-outline"></i> Unlock QR Download
              </button>
            </template>
          </div>
          <p v-if="!entitlementStore.hasPremiumFeature('qr_download')" class="upsell-note">
            QR download is locked until a valid activation key is entered.
          </p>
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
      <router-link
        v-if="designStore.mainData.colorData?.length > 0"
        to="/"
        class="pb-button p-5"
      >
        <i class="mdi mdi-check"></i> DONE
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ColorPicker } from 'vue3-colorpicker';
import 'vue3-colorpicker/style.css';
import { useAppStore } from '@/stores/appStore';
import { useDesignStore } from '@/stores/designStore';
import { useNetworkStore } from '@/stores/networkStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useEntitlementStore } from '@/stores/entitlementStore';
import type { PremiumUnlockTarget } from '@/types';
import useSetup from '@/composables/useSetup';

const appStore = useAppStore();
const router = useRouter();
const designStore = ref<ReturnType<typeof useDesignStore> | null>(null);
const networkStore = useNetworkStore();
const templateStore = useTemplateStore();
const entitlementStore = useEntitlementStore();
const color = ref('#112357');
const currentTab = ref<'template' | 'settings'>('template');
const isSyncingLicenses = ref(false);

const premiumLicenses = computed(() => [
  {
    feature: 'base_app' as const,
    label: 'Base App',
    target: null,
    active: entitlementStore.isValid('base_app'),
    canActivate: false,
    notice: entitlementStore.noticeFor('base_app'),
    info: null,
  },
  {
    feature: 'qr_download' as const,
    label: 'QR Download',
    target: 'qr_download' as const,
    active: entitlementStore.hasPremiumFeature('qr_download'),
    canActivate: true,
    notice: entitlementStore.noticeFor('qr_download'),
    info: entitlementStore.hasPremiumFeature('qr_download')
      ? 'Activated on this device.'
      : 'Manual activation key required.',
  },
  {
    feature: 'template_editor' as const,
    label: 'Template Editor',
    target: 'template_editor' as const,
    active: entitlementStore.hasPremiumFeature('template_editor'),
    canActivate: true,
    notice: entitlementStore.noticeFor('template_editor'),
    info: entitlementStore.hasPremiumFeature('template_editor')
      ? 'Activated on this device.'
      : 'Manual activation key required.',
  },
]);

const premiumBundleUnlocked = computed(
  () =>
    entitlementStore.hasPremiumFeature('qr_download') &&
    entitlementStore.hasPremiumFeature('template_editor')
);

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
  return (
    verifyColor(designStore.value!.selectedColorIndex) !== 'no-data' ||
    !designStore.value!.selectedColorIndex
  );
}

function openPremiumAccess(target: PremiumUnlockTarget): void {
  void router.push({ name: 'PremiumAccess', params: { target } });
}

async function syncLicenses(): Promise<void> {
  isSyncingLicenses.value = true;
  await entitlementStore.syncEntitlements();
  isSyncingLicenses.value = false;
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

.settings-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.settings-ghost-btn {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: transparent;
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
  padding: 8px 12px;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.settings-heading {
  font-size: 15px;
  font-weight: 700;
  color: $dark;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;

  i {
    font-size: 20px;
    color: $secondary-color;
  }
}

.premium-device-id,
.premium-help,
.premium-status {
  font-size: 12px;
  color: $border-color;
}

.premium-device-id {
  margin-bottom: 12px;
}

.premium-billing-field {
  margin-bottom: 4px;
}

.premium-row {
  border-top: 1px solid #e5e7eb;
  padding-top: 12px;
  margin-top: 12px;
}

.premium-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.premium-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;

  &.active {
    background: rgba(#16a34a, 0.12);
    color: #15803d;
  }
}

.premium-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.premium-actions-stack {
  margin-top: 12px;
}

.premium-input {
  flex: 1;
}

.premium-subscribe-btn {
  width: 100%;
}

.premium-activate-btn {
  border: none;
  cursor: pointer;

  &:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }
}

.premium-error {
  color: #dc2626;
  font-size: 12px;
  margin-top: 8px;
}

.premium-notice,
.premium-info {
  font-size: 12px;
  margin-top: 8px;
  line-height: 1.5;
}

.premium-notice {
  color: #b45309;
}

.premium-info {
  color: #1d4ed8;
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

  input[type='file'] {
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
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    filter: brightness(1.15);
    color: $white;
  }

  &.disabled {
    background: #9ca3af;
    cursor: not-allowed;
    pointer-events: none;
  }
}

.upsell-tag {
  margin-left: 6px;
  font-size: 11px;
  background: #f59e0b;
  color: #fff;
  border-radius: 4px;
  padding: 1px 6px;
  vertical-align: middle;
}

.lock-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #9ca3af;
  font-weight: 600;
  cursor: not-allowed;
}

.lock-badge-action {
  border: none;
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba($secondary-color, 0.12);
  color: $secondary-color;
  cursor: pointer;
}

.upsell-note {
  margin-top: 6px;
  padding: 0 15px 8px;
  font-size: 12px;
  color: #6b7280;
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
