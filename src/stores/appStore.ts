import { defineStore } from 'pinia';
import { ImageLoaderService } from '@/services/imageLoader';
import type { SelectedTemplate, UploadedImage } from '@/types';

interface AppState {
  selectedTemplate: SelectedTemplate | null;
  selectedVariation: number;
  selectedDesign: number;
  uploadedImages: UploadedImage[];
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    selectedTemplate: null,
    selectedVariation: 0,
    selectedDesign: 0,
    uploadedImages: [],
  }),

  actions: {
    setTemplate(templateId: number, imgCount: number): void {
      this.selectedTemplate = { id: templateId, imgCount };
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
    },
  },
});
