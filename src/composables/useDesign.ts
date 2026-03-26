import { ref, onMounted, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import { useAppStore } from '@/stores/appStore';
import { useNetworkStore } from '@/stores/networkStore';
import frameDataJson from '@/data/frameData.json';
import defaultDesignData from '@/data/designData.json';
import { FilesystemService } from '@/services/filesystem';
import { ImageLoaderService } from '@/services/imageLoader';
import {
  useResponsiveSizing,
  computeFrameRect,
  computeImageRect,
  darkenHex,
  verifyColorData,
} from './useFrameConfig';
import type { DesignData, FrameTemplate, KonvaRectConfig, UploadedImage } from '@/types';

const frames = (frameDataJson as { frames: FrameTemplate[] }).frames;

const BASE_DIRS: Record<string, string> = {
  header: '/images/designs/',
  footer: '/images/footer/',
};

interface DesignReturn {
  responsiveWidth: Ref<number>;
  responsiveHeight: Ref<number>;
  getFrameConfig: (multiples?: number) => KonvaRectConfig;
  frameData: FrameTemplate['frameData'];
  getImageConfig: (index: number, multiples?: number, tmp?: number) => KonvaRectConfig | undefined;
  handlePrint: () => Promise<void>;
  layerRef: Ref<{ getNode: () => { toCanvas: (opts: Record<string, number>) => HTMLCanvasElement; toDataURL: (opts: Record<string, number>) => string } } | null>;
  getFooterConfig: (multiples?: number) => KonvaRectConfig | undefined;
  getHeaderConfig: (multiples?: number) => KonvaRectConfig | undefined;
  variation: FrameTemplate['variation'];
  mainData: Ref<DesignData | undefined>;
  loadDesignData: () => Promise<void>;
  loadSetupImages: () => Promise<void>;
  verifyColor: (index: number) => string | undefined;
  isPrintPressed: Ref<boolean>;
}

export default function useDesign(): DesignReturn {
  const router = useRouter();
  const appStore = useAppStore();
  const networkStore = useNetworkStore();

  const mainData = ref<DesignData | undefined>();
  const isPrintPressed = ref(false);
  const layerRef = ref<{ getNode: () => { toCanvas: (opts: Record<string, number>) => HTMLCanvasElement; toDataURL: (opts: Record<string, number>) => string } } | null>(null);
  const loadedImages = ref<Record<number, HTMLImageElement>>({});

  const selectedFrameId = appStore.selectedTemplate?.id ?? 2;
  const { frameData, variation, baseData } = frames[selectedFrameId];

  // --- Responsive Sizing ---
  const { responsiveWidth, responsiveHeight, diff } = useResponsiveSizing(() => baseData);

  // --- Frame Config ---
  const getFrameConfig = (multiples: number = 0): KonvaRectConfig => {
    const rect = computeFrameRect(
      frameData,
      diff.value,
      responsiveWidth.value,
      responsiveHeight.value,
      { multiples }
    );
    const color =
      appStore.selectedDesign !== null
        ? mainData.value!.colorData[appStore.selectedDesign].hex
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
      cornerRadius: 0,
    };
  };

  const getHeaderConfig = (multiples: number = 0): KonvaRectConfig | undefined => {
    if (appStore.selectedDesign === null) return undefined;
    const { headerImages } = mainData.value!;
    const { header } = mainData.value!.colorData[appStore.selectedDesign];
    if (header === null || !headerImages[header]) return undefined;

    const frameRect = computeFrameRect(
      frameData, diff.value, responsiveWidth.value, responsiveHeight.value, { multiples }
    );
    return computeImageRect(
      variation[appStore.selectedVariation].headerData,
      diff.value,
      headerImages[header]!,
      frameRect
    );
  };

  const getFooterConfig = (multiples: number = 0): KonvaRectConfig | undefined => {
    if (appStore.selectedDesign === null) return undefined;
    const { footerImages } = mainData.value!;
    const { footer } = mainData.value!.colorData[appStore.selectedDesign];
    if (footer === null || !footerImages[footer]) return undefined;

    const frameRect = computeFrameRect(
      frameData, diff.value, responsiveWidth.value, responsiveHeight.value, { multiples }
    );
    return computeImageRect(
      variation[appStore.selectedVariation].footerData,
      diff.value,
      footerImages[footer]!,
      frameRect
    );
  };

  const getImageConfig = (index: number, multiples: number = 0, tmp: number = 0): KonvaRectConfig | undefined => {
    const newIndex = Number(index) + tmp;
    if (
      !variation[appStore.selectedVariation].imagesData[index] ||
      !loadedImages.value[newIndex]
    )
      return undefined;

    const frameRect = computeFrameRect(
      frameData, diff.value, responsiveWidth.value, responsiveHeight.value, { multiples }
    );
    const imgRectData = computeImageRect(
      variation[appStore.selectedVariation].imagesData[index],
      diff.value,
      loadedImages.value[newIndex],
      frameRect
    );
    const color =
      appStore.selectedDesign !== null
        ? mainData.value!.colorData[appStore.selectedDesign].hex
        : '#ffffff';

    return {
      ...imgRectData,
      cornerRadius: 1,
      stroke: darkenHex(color, 0.5) ?? undefined,
      strokeWidth: 2,
    };
  };

  // --- Test Images Fallback ---
  const testImages: { src: string }[] = [
    { src: '/images/captures/sample1.webp' },
    { src: '/images/captures/sample2.webp' },
    { src: '/images/captures/sample3.webp' },
    { src: '/images/captures/sample4.webp' },
    { src: '/images/captures/sample1.webp' },
    { src: '/images/captures/sample2.webp' },
    { src: '/images/captures/sample3.webp' },
    { src: '/images/captures/sample4.webp' },
  ];

  const images = ref<(UploadedImage | { src: string })[]>(
    appStore.uploadedImages.length > 0 ? appStore.uploadedImages : testImages
  );

  onMounted(() => {
    images.value.forEach((img, index) => {
      ImageLoaderService.loadImageFromUrl(img.src).then((imgData) => {
        loadedImages.value = { ...loadedImages.value, [index]: imgData };
      });
    });
  });

  // --- Data Loading ---
  const loadDesignData = async (): Promise<void> => {
    const data = await FilesystemService.loadOrInitJson<DesignData>('designData.json', defaultDesignData as DesignData);

    if (mainData.value === undefined) {
      mainData.value = data;
      mainData.value.colorData = data.colorData.filter(
        (d) => d.header !== null && d.footer !== null
      );
    } else {
      mainData.value.colorData = data.colorData.filter(
        (d) => d.header !== null && d.footer !== null
      );
      mainData.value.headerData = data.headerData;
      mainData.value.footerData = data.footerData;
    }
  };

  const loadSetupImages = async (): Promise<void> => {
    await loadSetupImageHelper('header', BASE_DIRS.header);
    await loadSetupImageHelper('footer', BASE_DIRS.footer);
  };

  const loadSetupImageHelper = async (key: string, directory: string): Promise<void> => {
    const data = mainData.value![`${key}Data` as keyof DesignData] as string[];
    for (let index = 0; index < data.length; index++) {
      const imgName = data[index];
      const img = await ImageLoaderService.loadImageWithFallback(
        `${directory}${imgName}`,
        `${key}Data/${imgName}`
      );
      (mainData.value as Record<string, unknown>)[`${key}Images`] ??= [];
      ((mainData.value as Record<string, unknown>)[`${key}Images`] as (HTMLImageElement | null)[])[index] = img;
    }
  };

  // --- Print (DO NOT MODIFY LOGIC) ---
  const handlePrint = async (): Promise<void> => {
    isPrintPressed.value = true;
    let dataURL = '';

    if (frameData.rotate && Capacitor.getPlatform() === 'web') {
      const node = layerRef.value!.getNode();
      const oldCanvas = node.toCanvas({ pixelRatio: 8, quality: 2 });
      const rotatedCanvas = document.createElement('canvas');

      rotatedCanvas.width = oldCanvas.height;
      rotatedCanvas.height = oldCanvas.width;

      const ctx = rotatedCanvas.getContext('2d')!;
      ctx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(oldCanvas, -oldCanvas.width / 2, -oldCanvas.height / 2);

      dataURL = rotatedCanvas.toDataURL('image/png');
    } else {
      dataURL = layerRef.value!.getNode().toDataURL({ pixelRatio: 8, quality: 2 });
    }

    if (Capacitor.getPlatform() === 'web') {
      const printWindow = window.open('', '_blank')!;
      printWindow.document.write(`
                <html>
                <head>
                    <title>Print</title>
                    <style>
                    @page {
                        size: 6in 4in;
                        margin: 0;
                    }

                    body, html {
                        margin: 0;
                        padding: 0;
                        width: 6in;
                        height: 4in;
                        background: black;
                    }

                    img {
                        width: 97.5%;
                        height: 97%;
                        margin-top: 1.3%;
                        margin-left: .5%;
                        object-fit: contain;
                        display: block;
                    }
                    </style>
                </head>
                <body onload="window.print(); window.close();">
                    <img src="${dataURL}" />
                </body>
                </html>
            `);
      printWindow.document.close();
    } else {
      const base64 = dataURL.replace('data:image/png;base64,', '');

      await FilesystemService.writeToDocuments(`konva_${Date.now()}.png`, base64);

      try {
        const result = await sendToPrintServer(base64);
        console.log('Printed!', result);
      } catch (err) {
        console.log('PRINT FAILED', err);
      }

      console.log('Saved & Printed successfully!');
      router.push('/');
    }
  };

  const sendToPrintServer = async (base64: string): Promise<void> => {
    try {
      const res = await fetch(
        `http://${networkStore.networkData.ipAddress}:3000/print`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            img: base64,
            orientation: frameData.rotate ? 'portrait' : 'landscape',
          }),
        }
      );
      const json = await res.json();
      console.log('PRINT RESPONSE:', json);
    } catch (err) {
      console.error('PRINT ERROR:', err);
    }
  };

  const verifyColor = (index: number): string | undefined => verifyColorData(mainData.value?.colorData, index);

  return {
    responsiveWidth,
    responsiveHeight,
    getFrameConfig,
    frameData,
    getImageConfig,
    handlePrint,
    layerRef,
    getFooterConfig,
    getHeaderConfig,
    variation,
    mainData,
    loadDesignData,
    loadSetupImages,
    verifyColor,
    isPrintPressed,
  };
}
