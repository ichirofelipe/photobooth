import { ref, onMounted, type Ref } from 'vue';
import { useAppStore } from '@/stores/appStore';
import { useDesignStore } from '@/stores/designStore';
import { useNetworkStore } from '@/stores/networkStore';
import { ImageLoaderService } from '@/services/imageLoader';
import {
  useResponsiveSizing,
  computeFrameRect,
  computeImageRect,
  verifyColorData,
} from './useFrameConfig';
import { BASE_DIRS } from '@/stores/designStore';
import type { KonvaRectConfig, DesignData } from '@/types';

interface SetupReturn {
  responsiveWidth: Ref<number>;
  responsiveHeight: Ref<number>;
  getFrameConfig: () => KonvaRectConfig;
  getImageConfig: (imgData: HTMLImageElement, index: number) => KonvaRectConfig | undefined;
  layerRef: Ref<unknown>;
  getFooterConfig: () => KonvaRectConfig | undefined;
  getHeaderConfig: () => KonvaRectConfig | undefined;
  addColor: (newColor: string) => Promise<void>;
  verifyColor: (index: number) => string | undefined;
  saveColorSettings: () => Promise<void>;
  deleteColor: () => Promise<void>;
  uploadImages: (key: string, isArray?: boolean) => Promise<void>;
  onFileChange: (event: Event, key: string) => void;
  resetSetup: () => Promise<void>;
  onInputSetupText: (key: string, e: Event) => void;
}

export default function useSetup(): SetupReturn {
  const appStore = useAppStore();
  const designStore = useDesignStore();
  const networkStore = useNetworkStore();

  const layerRef = ref<unknown>(null);
  const uploadData = ref<{
    headerData: FileList | File[];
    footerData: FileList | File[];
    homeLogoData: FileList | File[] | null;
  }>({
    headerData: [],
    footerData: [],
    homeLogoData: null,
  });

  // --- Responsive Sizing ---
  const { responsiveWidth, responsiveHeight, diff, updateSizing } = useResponsiveSizing(
    () => designStore.currentTemplate.baseData
  );

  // --- Frame Config (centered for setup preview) ---
  const getFrameConfig = (): KonvaRectConfig => {
    updateSizing();
    const rect = computeFrameRect(
      designStore.currentTemplate.frameData,
      diff.value,
      responsiveWidth.value,
      responsiveHeight.value,
      { centered: true }
    );
    const mainData = designStore.mainData as DesignData;
    const color =
      designStore.selectedColorIndex !== null
        ? mainData.colorData[designStore.selectedColorIndex]?.hex
        : '#ffffff';

    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      fill: color,
      fillPatternScale: { x: rect.scaleFactorWidth, y: rect.scaleFactorWidth },
      stroke: 'black',
      strokeWidth: rect.strokeWidth,
      cornerRadius: 3,
    };
  };

  const getHeaderConfig = (): KonvaRectConfig | undefined => {
    if (designStore.currentTemplate.headerEnabled === false) return undefined;
    if (designStore.selectedColorIndex === null) return undefined;
    const mainData = designStore.mainData as DesignData;
    const { headerImages } = mainData;
    const data = mainData.colorData[designStore.selectedColorIndex];

    let headerIndex = designStore.selectedHeaderIndex;
    if (data?.header === null) {
      if (headerIndex === null) return undefined;
    } else {
      headerIndex = data?.header ?? null;
    }

    if (headerIndex === null || !headerImages[headerIndex]) return undefined;

    const frameRect = computeFrameRect(
      designStore.currentTemplate.frameData,
      diff.value,
      responsiveWidth.value,
      responsiveHeight.value,
      { centered: true }
    );
    return computeImageRect(
      designStore.currentTemplate.variation[appStore.selectedVariation].headerData,
      diff.value,
      headerImages[headerIndex]!,
      frameRect
    );
  };

  const getFooterConfig = (): KonvaRectConfig | undefined => {
    if (designStore.selectedColorIndex === null) return undefined;
    const mainData = designStore.mainData as DesignData;
    const { footerImages } = mainData;
    const data = mainData.colorData[designStore.selectedColorIndex];

    let footerIndex = designStore.selectedFooterIndex;
    if (data?.footer === null) {
      if (footerIndex === null) return undefined;
    } else {
      footerIndex = data?.footer ?? null;
    }

    if (footerIndex === null || !footerImages[footerIndex]) return undefined;

    const frameRect = computeFrameRect(
      designStore.currentTemplate.frameData,
      diff.value,
      responsiveWidth.value,
      responsiveHeight.value,
      { centered: true }
    );
    return computeImageRect(
      designStore.currentTemplate.variation[appStore.selectedVariation].footerData,
      diff.value,
      footerImages[footerIndex]!,
      frameRect
    );
  };

  const getImageConfig = (imgData: HTMLImageElement, index: number): KonvaRectConfig | undefined => {
    if (!designStore.currentTemplate.variation[appStore.selectedVariation].imagesData[index])
      return undefined;

    const frameRect = computeFrameRect(
      designStore.currentTemplate.frameData,
      diff.value,
      responsiveWidth.value,
      responsiveHeight.value,
      { centered: true }
    );
    const imgRectData = computeImageRect(
      designStore.currentTemplate.variation[appStore.selectedVariation].imagesData[index],
      diff.value,
      imgData,
      frameRect
    );

    return { ...imgRectData, cornerRadius: 1 };
  };

  // --- Color & Upload Management ---
  const verifyColor = (index: number): string | undefined => verifyColorData((designStore.mainData as DesignData)?.colorData, index);

  const addColor = async (newColor: string): Promise<void> => {
    await designStore.addColor(newColor);
  };

  const deleteColor = async (): Promise<void> => {
    await designStore.deleteColor();
  };

  const saveColorSettings = async (): Promise<void> => {
    await designStore.saveColorSettings();
  };

  const onFileChange = (event: Event, key: string): void => {
    const target = event.target as HTMLInputElement;
    if (target.files) {
      (uploadData.value as Record<string, FileList | File[] | null>)[`${key}Data`] = target.files;
    }
  };

  const uploadImages = async (key: string, isArray: boolean = true): Promise<void> => {
    const files = (uploadData.value as Record<string, FileList | File[] | null>)[`${key}Data`];
    if (files) {
      await designStore.uploadImageFiles(key, files as FileList, isArray);
    }
  };

  const onInputSetupText = (key: string, e: Event): void => {
    const target = e.target as HTMLInputElement;
    networkStore.updateField(key as 'ipAddress', target.value);
  };

  const resetSetup = async (): Promise<void> => {
    designStore.setColor(null);
    await designStore.deleteDesignData();
    await designStore.reloadMainData();
  };

  return {
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
  };
}
