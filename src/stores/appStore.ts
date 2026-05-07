import { defineStore } from 'pinia';
import { ImageLoaderService } from '@/services/imageLoader';
import type { SelectedTemplate, UploadedImage } from '@/types';

interface AppState {
  selectedTemplate: SelectedTemplate | null;
  selectedVariation: number;
  selectedDesign: number;
  uploadedImages: UploadedImage[];
  pendingQrBase64: string | null;
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    selectedTemplate: null,
    selectedVariation: 0,
    selectedDesign: 0,
    uploadedImages: [],
    pendingQrBase64: null,
  }),

  actions: {
    setTemplate(templateId: number, imgCount: number): void {
      this.selectedTemplate = { id: templateId, imgCount };
    },

    clearTemplate(): void {
      this.selectedTemplate = null;
    },

    async addImage(imageData: string): Promise<void> {
      const img = await ImageLoaderService.loadImageFromUrl(imageData);
      this.uploadedImages.push({
        src: imageData,
        width: img.width,
        height: img.height,
      });
    },

    setDesign(index: number): void {
      this.selectedDesign = index;
    },

    setVariation(index: number): void {
      this.selectedVariation = index;
    },

    reset(): void {
      this.selectedTemplate = null;
      this.selectedVariation = 0;
      this.uploadedImages = [];
      this.selectedDesign = 0;
      this.pendingQrBase64 = null;
    },
  },
});
