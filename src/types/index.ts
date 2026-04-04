// ---- Color & Design Data ----

export interface ColorEntry {
  hex: string;
  header: number | null;
  footer: number | null;
}

export interface DesignData {
  colorData: ColorEntry[];
  headerData: string[];
  headerImages: (HTMLImageElement | null)[];
  footerData: string[];
  footerImages: (HTMLImageElement | null)[];
  homeLogoData: string;
  homeLogoImage: HTMLImageElement | null;
}

// ---- Network ----

export interface NetworkData {
  ipAddress: string;
  qrEnabled: boolean;
}

// ---- Frame & Template ----

export interface Dimensions {
  width: number;
  height: number;
}

export interface RectData {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameData {
  width: number;
  height: number;
  strokeSize: number;
  imageCount: number;
  rotate: boolean;
}

export interface VariationData {
  imgSrc: string;
  copy: number;
  footerData: RectData;
  headerData: RectData;
  imagesData: RectData[];
}

export interface FrameTemplate {
  imgSrc: string;
  label: string;
  baseData: Dimensions;
  frameData: FrameData;
  variation: VariationData[];
}

// ---- Computed Rects (Konva configs) ----

export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactorWidth: number;
  strokeWidth: number;
}

export interface KonvaRectConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  fillPatternImage?: HTMLImageElement;
  fillPatternScale?: { x: number; y: number };
  fillPatternOffset?: { x: number; y: number };
  fillPatternRepeat?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

// ---- App Store ----

export interface SelectedTemplate {
  id: number;
  imgCount: number;
}

export interface UploadedImage {
  src: string;
  width: number;
  height: number;
}

// ---- Page Config ----

export interface PageConfigEntry {
  name: string;
  backLink: string | null;
  resetData: boolean;
}

// ---- Device Key ----

export interface DeviceKeyErrors {
  licenseKey: string | null;
}

// ---- Upload Data (Setup page) ----

export interface UploadData {
  headerData: FileList | File[];
  footerData: FileList | File[];
  homeLogoData: FileList | File[] | null;
}

// ---- Template Config (active selection) ----

export interface TemplateConfig {
  activeIndices: number[];
}

// ---- Frame Config Options ----

export interface FrameRectOptions {
  multiples?: number;
  centered?: boolean;
}

// ---- Responsive Sizing ----

export interface ResponsiveSizing {
  responsiveWidth: import('vue').Ref<number>;
  responsiveHeight: import('vue').Ref<number>;
  diff: import('vue').Ref<number>;
  updateSizing: () => void;
}
