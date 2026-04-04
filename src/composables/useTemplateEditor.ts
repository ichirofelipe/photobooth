import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { useTemplateStore } from '@/stores/templateStore';
import type { FrameTemplate, RectData, VariationData } from '@/types';

const PREVIEW_MAX_W = 380;
const PREVIEW_MAX_H = 320;

function createDefaultVariation(imageCount: number): VariationData {
  const imagesData: RectData[] = [];
  for (let i = 0; i < imageCount; i++) {
    imagesData.push({ x: 10, y: 50 + i * 140, width: 200, height: 130 });
  }
  return {
    imgSrc: '',
    copy: 1,
    headerData: { x: 0, y: 0, width: 200, height: 200 },
    footerData: { x: 50, y: 400, width: 120, height: 30 },
    imagesData,
  };
}

function createDefaultTemplate(): FrameTemplate {
  return {
    imgSrc: '',
    label: 'New Template',
    baseData: { width: 750, height: 500 },
    frameData: { width: 375, height: 500, strokeSize: 0.5, imageCount: 2, rotate: false },
    variation: [createDefaultVariation(2)],
  };
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateTemplate(t: FrameTemplate): ValidationResult {
  const errors: string[] = [];

  if (!t.label.trim()) errors.push('Label is required.');
  if (t.baseData.width <= 0) errors.push('Base width must be > 0.');
  if (t.baseData.height <= 0) errors.push('Base height must be > 0.');
  if (t.frameData.width <= 0) errors.push('Frame width must be > 0.');
  if (t.frameData.height <= 0) errors.push('Frame height must be > 0.');
  if (t.frameData.width > t.baseData.width) errors.push('Frame width exceeds base width.');
  if (t.frameData.height > t.baseData.height) errors.push('Frame height exceeds base height.');
  if (t.frameData.strokeSize < 0) errors.push('Stroke size cannot be negative.');
  if (t.frameData.imageCount < 1) errors.push('Image count must be at least 1.');
  if (t.variation.length === 0) errors.push('At least one variation is required.');

  t.variation.forEach((v, vi) => {
    if (v.copy < 1) errors.push(`Variation ${vi + 1}: copy must be >= 1.`);
    const expectedImages = v.imagesData.length * v.copy;
    if (expectedImages !== t.frameData.imageCount) {
      errors.push(
        `Variation ${vi + 1}: images (${v.imagesData.length}) × copy (${v.copy}) = ${expectedImages}, expected ${t.frameData.imageCount}.`
      );
    }
    const allRects = [v.headerData, v.footerData, ...v.imagesData];
    allRects.forEach((rect) => {
      if (rect.width <= 0 || rect.height <= 0) {
        errors.push(`Variation ${vi + 1}: all rects must have width/height > 0.`);
      }
    });
  });

  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export interface TemplateEditorReturn {
  editingIndex: Ref<number | null>;
  editForm: Ref<FrameTemplate | null>;
  selectedVariation: Ref<number>;
  validationErrors: Ref<string[]>;
  previewScale: ComputedRef<number>;
  previewWidth: ComputedRef<number>;
  previewHeight: ComputedRef<number>;
  frameOffset: ComputedRef<{ x: number; y: number }>;
  currentVar: ComputedRef<VariationData | null>;

  startEdit: (index: number) => void;
  startCreate: () => void;
  cancelEdit: () => void;
  saveEdit: () => Promise<boolean>;

  addVariation: () => void;
  removeVariation: (index: number) => void;
  addImageSlot: () => void;
  removeImageSlot: (index: number) => void;

  rectToStyle: (rect: RectData) => Record<string, string>;
  frameStyle: ComputedRef<Record<string, string>>;
}

export default function useTemplateEditor(): TemplateEditorReturn {
  const templateStore = useTemplateStore();

  const editingIndex = ref<number | null>(null);
  const editForm = ref<FrameTemplate | null>(null);
  const selectedVariation = ref(0);
  const validationErrors = ref<string[]>([]);

  const previewScale = computed(() => {
    if (!editForm.value) return 1;
    const { width, height } = editForm.value.baseData;
    if (width <= 0 || height <= 0) return 1;
    return Math.min(PREVIEW_MAX_W / width, PREVIEW_MAX_H / height, 1);
  });

  const previewWidth = computed(() => {
    if (!editForm.value) return 0;
    return editForm.value.baseData.width * previewScale.value;
  });

  const previewHeight = computed(() => {
    if (!editForm.value) return 0;
    return editForm.value.baseData.height * previewScale.value;
  });

  const frameOffset = computed(() => {
    if (!editForm.value) return { x: 0, y: 0 };
    const s = previewScale.value;
    const { frameData, baseData } = editForm.value;
    return {
      x: (frameData.strokeSize * s) / 2,
      y: ((baseData.height - frameData.height) * s) / 2 + (frameData.strokeSize * s) / 2,
    };
  });

  const frameStyle = computed<Record<string, string>>(() => {
    if (!editForm.value) return {};
    const s = previewScale.value;
    const { frameData } = editForm.value;
    const off = frameOffset.value;
    return {
      left: off.x + 'px',
      top: off.y + 'px',
      width: (frameData.width - frameData.strokeSize) * s + 'px',
      height: (frameData.height - frameData.strokeSize) * s + 'px',
    };
  });

  const currentVar = computed<VariationData | null>(() => {
    if (!editForm.value) return null;
    return editForm.value.variation[selectedVariation.value] ?? null;
  });

  function rectToStyle(rect: RectData): Record<string, string> {
    const s = previewScale.value;
    const off = frameOffset.value;
    return {
      left: off.x + rect.x * s + 'px',
      top: off.y + rect.y * s + 'px',
      width: rect.width * s + 'px',
      height: rect.height * s + 'px',
    };
  }

  function startEdit(index: number): void {
    editingIndex.value = index;
    editForm.value = deepClone(templateStore.allFrames[index]);
    selectedVariation.value = 0;
    validationErrors.value = [];
  }

  function startCreate(): void {
    editingIndex.value = null;
    editForm.value = createDefaultTemplate();
    selectedVariation.value = 0;
    validationErrors.value = [];
  }

  function cancelEdit(): void {
    editForm.value = null;
    editingIndex.value = null;
    validationErrors.value = [];
  }

  async function saveEdit(): Promise<boolean> {
    if (!editForm.value) return false;

    const result = validateTemplate(editForm.value);
    validationErrors.value = result.errors;
    if (!result.valid) return false;

    if (editingIndex.value !== null) {
      await templateStore.updateTemplate(editingIndex.value, editForm.value);
    } else {
      const success = await templateStore.addTemplate(editForm.value);
      if (!success) {
        validationErrors.value = ['Maximum 8 templates reached.'];
        return false;
      }
    }

    editForm.value = null;
    editingIndex.value = null;
    return true;
  }

  function addVariation(): void {
    if (!editForm.value) return;
    const imgCount = editForm.value.frameData.imageCount;
    editForm.value.variation.push(createDefaultVariation(imgCount));
    selectedVariation.value = editForm.value.variation.length - 1;
  }

  function removeVariation(index: number): void {
    if (!editForm.value || editForm.value.variation.length <= 1) return;
    editForm.value.variation.splice(index, 1);
    if (selectedVariation.value >= editForm.value.variation.length) {
      selectedVariation.value = editForm.value.variation.length - 1;
    }
  }

  function addImageSlot(): void {
    if (!editForm.value) return;
    const v = editForm.value.variation[selectedVariation.value];
    if (!v) return;
    v.imagesData.push({ x: 10, y: 10, width: 100, height: 80 });
  }

  function removeImageSlot(index: number): void {
    if (!editForm.value) return;
    const v = editForm.value.variation[selectedVariation.value];
    if (!v || v.imagesData.length <= 1) return;
    v.imagesData.splice(index, 1);
  }

  return {
    editingIndex,
    editForm,
    selectedVariation,
    validationErrors,
    previewScale,
    previewWidth,
    previewHeight,
    frameOffset,
    currentVar,
    startEdit,
    startCreate,
    cancelEdit,
    saveEdit,
    addVariation,
    removeVariation,
    addImageSlot,
    removeImageSlot,
    rectToStyle,
    frameStyle,
  };
}
