import { ref, onMounted, type Ref } from 'vue';
import type {
  Dimensions,
  FrameRect,
  FrameRectOptions,
  KonvaRectConfig,
  RectData,
  ColorEntry,
  ResponsiveSizing,
} from '@/types';

const MIN_HEIGHT = 1100;

export function useResponsiveSizing(getBaseData: () => Dimensions): ResponsiveSizing {
  const responsiveWidth: Ref<number> = ref(0);
  const responsiveHeight: Ref<number> = ref(0);
  const diff: Ref<number> = ref(0);

  const updateSizing = (): void => {
    const baseData = getBaseData();
    const tmpDiff = (MIN_HEIGHT - window.innerHeight) / MIN_HEIGHT;
    diff.value = tmpDiff >= 0 ? tmpDiff : 0;
    responsiveWidth.value = baseData.width - (baseData.width * diff.value);
    responsiveHeight.value = baseData.height - (baseData.height * diff.value);
  };

  onMounted(() => {
    updateSizing();
    window.addEventListener('resize', updateSizing);
  });

  return { responsiveWidth, responsiveHeight, diff, updateSizing };
}

export function computeFrameRect(
  frameData: { width: number; height: number; strokeSize: number },
  diff: number,
  responsiveWidth: number,
  responsiveHeight: number,
  { multiples = 0, centered = false }: FrameRectOptions = {}
): FrameRect {
  const resWidth = frameData.width - (frameData.width * diff);
  const resHeight = frameData.height - (frameData.height * diff);
  const strokeWidth = frameData.strokeSize;

  let x: number;
  if (centered) {
    x = ((responsiveWidth - resWidth) / 2) + (strokeWidth / 2);
  } else {
    x = (strokeWidth / 2) + (resWidth * multiples);
  }

  const y = ((responsiveHeight - resHeight) / 2) + (strokeWidth / 2);
  const width = resWidth - strokeWidth;
  const height = resHeight - strokeWidth;
  const scaleFactorWidth = resWidth / frameData.width;

  return { x, y, width, height, scaleFactorWidth, strokeWidth };
}

export function computeImageRect(
  imgFrameData: RectData,
  diff: number,
  imgData: HTMLImageElement,
  frameRect: FrameRect
): KonvaRectConfig {
  const resWidth = imgFrameData.width - (imgFrameData.width * diff);
  const resHeight = imgFrameData.height - (imgFrameData.height * diff);
  const resX = imgFrameData.x - (imgFrameData.x * diff);
  const resY = imgFrameData.y - (imgFrameData.y * diff);

  const scaleFactorWidth = resWidth / imgData.width;
  const scaledImageHeight = scaleFactorWidth * imgData.height;
  const scaledImageWidth = scaleFactorWidth * imgData.width;
  const verticalOffset = (scaledImageHeight - resHeight) / 2;
  const horizontalOffset = (scaledImageWidth - resWidth) / 2;

  const imageOffsetX = frameRect.x + resX;
  const imageOffsetY = frameRect.y + resY;
  const finalOffsetY = (verticalOffset / scaledImageHeight) * imgData.height;
  const finalOffsetX = (horizontalOffset / scaledImageWidth) * imgData.width;

  return {
    fillPatternImage: imgData,
    fillPatternScale: { x: scaleFactorWidth, y: scaleFactorWidth },
    fillPatternOffset: { x: finalOffsetX, y: finalOffsetY },
    fillPatternRepeat: 'no-repeat',
    x: imageOffsetX,
    y: imageOffsetY,
    width: resWidth,
    height: resHeight,
  };
}

export function darkenHex(hex: string, factor: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((num >> 16) & 255) * (1 - factor));
  const g = Math.max(0, ((num >> 8) & 255) * (1 - factor));
  const b = Math.max(0, (num & 255) * (1 - factor));
  return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
}

export function verifyColorData(colorData: ColorEntry[] | undefined, index: number): string | undefined {
  if (!colorData || colorData.length === 0) return undefined;
  const entry = colorData[index];
  if (!entry) return undefined;
  return entry.header !== null && entry.footer !== null ? '' : 'no-data';
}
