import { defineStore } from 'pinia';
import { FilesystemService } from '@/services/filesystem';
import { ImageLoaderService } from '@/services/imageLoader';
import defaultDesignData from '@/data/designData.json';
import frameDataJson from '@/data/frameData.json';
import type { DesignData, FrameTemplate } from '@/types';

const frames = (frameDataJson as { frames: FrameTemplate[] }).frames;

const BASE_DIRS: Record<string, string> = {
  header: '/images/designs/',
  footer: '/images/footer/',
  homeLogo: '/images/homeLogo/',
};

const TEST_IMAGES: string[] = [
  '/images/captures/sample1.webp',
  '/images/captures/sample2.webp',
  '/images/captures/sample3.webp',
  '/images/captures/sample4.webp',
  '/images/captures/sample1.webp',
  '/images/captures/sample2.webp',
  '/images/captures/sample3.webp',
  '/images/captures/sample4.webp',
];

export { frames };

interface DesignState {
  initialized: boolean;
  mainData: DesignData | Record<string, never>;
  loadedTestImages: HTMLImageElement[];
  selectedColorIndex: number | null;
  selectedHeaderIndex: number | null;
  selectedFooterIndex: number | null;
  currentTemplateIndex: number;
}

export const useDesignStore = defineStore('design', {
  state: (): DesignState => ({
    initialized: false,
    mainData: {} as Record<string, never>,
    loadedTestImages: [],
    selectedColorIndex: null,
    selectedHeaderIndex: null,
    selectedFooterIndex: null,
    currentTemplateIndex: 3,
  }),

  getters: {
    currentTemplate: (state): FrameTemplate => frames[state.currentTemplateIndex],
  },

  actions: {
    async init(): Promise<void> {
      if (this.initialized) return;
      await this.reloadMainData();
      this.loadTestImages();
      this.initialized = true;
    },

    setFrame(direction: 'prev' | 'next'): void {
      if (direction === 'prev') {
        this.currentTemplateIndex = this.currentTemplateIndex > 0 ? this.currentTemplateIndex - 1 : 3;
      } else {
        this.currentTemplateIndex = this.currentTemplateIndex < 3 ? this.currentTemplateIndex + 1 : 0;
      }
    },

    setColor(index: number | null): void {
      this.selectedColorIndex = index;
    },

    setHeader(index: number): void {
      this.selectedHeaderIndex = index;
    },

    setFooter(index: number): void {
      this.selectedFooterIndex = index;
    },

    getImagesForCurrentTemplate(selectedVariation: number): HTMLImageElement[] {
      const imagesData = this.currentTemplate.variation[selectedVariation].imagesData || [];
      return this.loadedTestImages.slice(0, imagesData.length);
    },

    async reloadMainData(): Promise<void> {
      await this.logDataDirectory();
      await this.loadDesignData();
      await this.loadImages('header');
      await this.loadImages('footer');
      await this.loadImages('homeLogo');
    },

    async loadDesignData(): Promise<void> {
      const data = await FilesystemService.loadOrInitJson<DesignData>('designData.json', defaultDesignData as DesignData);

      if (!('colorData' in this.mainData)) {
        this.mainData = data;
      } else {
        const current = this.mainData as DesignData;
        current.colorData = data.colorData;
        current.headerData = data.headerData;
        current.footerData = data.footerData;
        current.homeLogoData = data.homeLogoData;
      }
    },

    async loadImages(key: string): Promise<void> {
      const directory = BASE_DIRS[key];
      const mainData = this.mainData as DesignData;
      const dataKey = `${key}Data` as keyof DesignData;
      const data = mainData[dataKey];

      if (Array.isArray(data)) {
        const imagesKey = `${key}Images` as keyof DesignData;
        if (!(mainData as Record<string, unknown>)[imagesKey]) {
          (mainData as Record<string, unknown>)[imagesKey] = [];
        }
        const images = (mainData as Record<string, unknown>)[imagesKey] as (HTMLImageElement | null)[];
        for (let i = 0; i < data.length; i++) {
          const imgName = data[i] as string;
          images[i] = await ImageLoaderService.loadImageWithFallback(
            `${directory}${imgName}`,
            `${key}Data/${imgName}`
          );
        }
      } else if (data) {
        const imageKey = `${key}Image` as string;
        (mainData as Record<string, unknown>)[imageKey] = await ImageLoaderService.loadImageWithFallback(
          `${directory}${data}`,
          `${key}Data/${data}`
        );
      }
    },

    loadTestImages(): void {
      TEST_IMAGES.forEach((src, index) => {
        ImageLoaderService.loadImageFromUrl(src).then((imgData) => {
          this.loadedTestImages[index] = imgData;
        });
      });
    },

    async saveDesignData(): Promise<void> {
      await FilesystemService.writeJsonFile('designData.json', this.mainData);
    },

    async deleteDesignData(): Promise<void> {
      try {
        await FilesystemService.deleteJsonFile('designData.json');
      } catch (err) {
        console.error('Delete failed:', err);
      }
    },

    async uploadImageFiles(key: string, files: FileList | File[], isArray: boolean = true): Promise<void> {
      const mainData = this.mainData as DesignData;
      if (isArray) {
        for (let i = 0; i < files.length; i++) {
          await this.writeImageFile(key, files[i]);
          (mainData as Record<string, unknown[]>)[`${key}Data`].push(files[i].name);
        }
      } else {
        await this.writeImageFile(key, files[0]);
        (mainData as Record<string, unknown>)[`${key}Data`] = files[0].name;
      }
      await this.saveDesignData();
      await this.reloadMainData();
    },

    async writeImageFile(key: string, file: File): Promise<string> {
      const base64 = await ImageLoaderService.readFileAsBase64(file);
      await FilesystemService.writeBinaryFile(`${key}Data/${file.name}`, base64);
      return base64;
    },

    async addColor(hex: string): Promise<void> {
      const mainData = this.mainData as DesignData;
      mainData.colorData.push({ hex, header: null, footer: null });
      await this.saveDesignData();
    },

    async deleteColor(): Promise<void> {
      if (this.selectedColorIndex === null) return;
      const mainData = this.mainData as DesignData;
      mainData.colorData.splice(this.selectedColorIndex, 1);
      await this.saveDesignData();
      this.selectedColorIndex = null;
    },

    async saveColorSettings(): Promise<void> {
      const mainData = this.mainData as DesignData;
      const colorData = mainData.colorData[this.selectedColorIndex!];
      if (!colorData) return;
      if (colorData.header !== null && colorData.footer !== null) return;

      colorData.header = this.selectedHeaderIndex;
      colorData.footer = this.selectedFooterIndex;
      await this.saveDesignData();
    },

    async logDataDirectory(path: string = ''): Promise<void> {
      try {
        const files = await FilesystemService.listDirectory(path);
        files.forEach((file) => console.log(path ? `${path}/${file}` : file));
      } catch {
        // Directory may not exist yet
      }
    },
  },
});
