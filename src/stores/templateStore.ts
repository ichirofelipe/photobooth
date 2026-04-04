import { defineStore } from 'pinia';
import { FilesystemService } from '@/services/filesystem';
import frameDataJson from '@/data/frameData.json';
import type { FrameTemplate, TemplateConfig } from '@/types';

const defaultFrames: FrameTemplate[] = (frameDataJson as { frames: FrameTemplate[] }).frames;

const MAX_TEMPLATES = 8;
const MAX_ACTIVE = 4;

interface TemplateState {
  allFrames: FrameTemplate[];
  activeIndices: number[];
  initialized: boolean;
}

export const useTemplateStore = defineStore('template', {
  state: (): TemplateState => ({
    allFrames: JSON.parse(JSON.stringify(defaultFrames)),
    activeIndices: [0, 1, 2, 3],
    initialized: false,
  }),

  getters: {
    activeFrames(state): { originalIndex: number; frame: FrameTemplate }[] {
      return state.activeIndices
        .filter(i => i >= 0 && i < state.allFrames.length)
        .map(i => ({ originalIndex: i, frame: state.allFrames[i] }));
    },
    canCreateMore(state): boolean {
      return state.allFrames.length < MAX_TEMPLATES;
    },
    canActivateMore(state): boolean {
      return state.activeIndices.length < MAX_ACTIVE;
    },
  },

  actions: {
    async init(): Promise<void> {
      if (this.initialized) return;
      await this.loadFrames();
      await this.loadConfig();
      this.initialized = true;
    },

    async loadFrames(): Promise<void> {
      this.allFrames = await FilesystemService.loadOrInitJson<FrameTemplate[]>(
        'customFrameData.json',
        defaultFrames
      );
    },

    async loadConfig(): Promise<void> {
      const defaultActive = this.allFrames.map((_, i) => i).slice(0, MAX_ACTIVE);
      const config = await FilesystemService.loadOrInitJson<TemplateConfig>(
        'templateConfig.json',
        { activeIndices: defaultActive }
      );
      this.activeIndices = config.activeIndices.filter(
        i => i >= 0 && i < this.allFrames.length
      );
      if (this.activeIndices.length === 0 && this.allFrames.length > 0) {
        this.activeIndices = [0];
      }
    },

    async saveFrames(): Promise<void> {
      await FilesystemService.writeJsonFile('customFrameData.json', this.allFrames);
    },

    async saveConfig(): Promise<void> {
      await FilesystemService.writeJsonFile<TemplateConfig>('templateConfig.json', {
        activeIndices: this.activeIndices,
      });
    },

    async addTemplate(template: FrameTemplate): Promise<boolean> {
      if (this.allFrames.length >= MAX_TEMPLATES) return false;
      this.allFrames.push(JSON.parse(JSON.stringify(template)));
      await this.saveFrames();
      return true;
    },

    async updateTemplate(index: number, template: FrameTemplate): Promise<boolean> {
      if (index < 0 || index >= this.allFrames.length) return false;
      this.allFrames[index] = JSON.parse(JSON.stringify(template));
      await this.saveFrames();
      return true;
    },

    async deleteTemplate(index: number): Promise<boolean> {
      if (index < 0 || index >= this.allFrames.length) return false;
      if (this.allFrames.length <= 1) return false;
      this.allFrames.splice(index, 1);
      this.activeIndices = this.activeIndices
        .filter(i => i !== index)
        .map(i => (i > index ? i - 1 : i));
      if (this.activeIndices.length === 0) {
        this.activeIndices = [0];
      }
      await this.saveFrames();
      await this.saveConfig();
      return true;
    },

    async toggleActive(index: number): Promise<void> {
      const pos = this.activeIndices.indexOf(index);
      if (pos >= 0) {
        if (this.activeIndices.length <= 1) return;
        this.activeIndices.splice(pos, 1);
      } else {
        if (this.activeIndices.length >= MAX_ACTIVE) return;
        this.activeIndices.push(index);
        this.activeIndices.sort((a, b) => a - b);
      }
      await this.saveConfig();
    },
  },
});
