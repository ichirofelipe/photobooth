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
  id: string;
  source: 'builtin' | 'custom';
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

// ---- Feature Entitlements ----

export type Feature = 'base_app' | 'qr_download' | 'template_editor';
export type PremiumFeature = 'qr_download' | 'template_editor';
export type PremiumUnlockTarget = PremiumFeature | 'premium_bundle';
export type ActivationTarget = Feature | 'premium_bundle';
export type PaymentMode = 'manual' | 'xendit' | 'future_gateway';

export const ALL_FEATURES: Feature[] = ['base_app', 'qr_download', 'template_editor'];
export const PREMIUM_FEATURES: PremiumFeature[] = ['qr_download', 'template_editor'];
export const PREMIUM_UNLOCK_TARGETS: PremiumUnlockTarget[] = [
  'qr_download',
  'template_editor',
  'premium_bundle',
];

export interface EntitlementRecord {
  deviceId: string;
  feature: Feature;
  licenseId?: string;
  issuedAt: number;
  expiresAt: number;
  sig: string;
}

export interface EntitlementSyncItem {
  feature: Feature;
  licenseId?: string;
}

export interface EntitlementRevocation {
  feature: Feature;
  reason:
    | 'transferred_to_another_device'
    | 'not_activated'
    | 'expired'
    | 'billing_inactive'
    | 'unknown';
}

export interface PremiumContactMethod {
  id: string;
  label: string;
  kind: 'facebook' | 'messenger' | 'email' | 'gcash' | 'maya' | 'phone' | 'social' | 'note';
  value: string;
  href?: string;
  details?: string;
  buttonLabel?: string;
}

export interface PremiumTargetConfig {
  title: string;
  summary: string;
  includes: PremiumFeature[];
}

export interface PremiumPaymentConfig {
  mode: PaymentMode;
  futureGatewayNote?: string;
  supportNote?: string;
  contactMethods: PremiumContactMethod[];
  targets: Record<PremiumUnlockTarget, PremiumTargetConfig>;
}

// ---- Device Key ----

export interface DeviceKeyPlugin {
  getDeviceId(): Promise<{ deviceId: string }>;
  getEntitlements(opts: { publicKey: string }): Promise<{ entitlements: EntitlementRecord[] }>;
  activateLicense(opts: {
    key: string;
    feature: ActivationTarget;
    serverUrl: string;
    publicKey: string;
  }): Promise<{ transferred?: boolean; activatedFeatures?: Feature[] }>;
  syncEntitlements(opts: {
    serverUrl: string;
    entitlements: EntitlementSyncItem[];
    publicKey: string;
  }): Promise<{ revoked: EntitlementRevocation[] }>;
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
