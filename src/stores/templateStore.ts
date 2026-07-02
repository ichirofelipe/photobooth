import { defineStore } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import { FilesystemService } from '@/services/filesystem';
import frameDataJson from '@/data/frameData.json';
import type { FrameTemplate, TemplateConfig } from '@/types';

const BUILTIN_COUNT = 4; // indices 0-3 in the default frame set are built-ins

interface StoredFrameData {
  schemaVersion?: number;
  frames: FrameTemplate[];
}

const defaultFrames: FrameTemplate[] = (frameDataJson as StoredFrameData).frames;

const CURRENT_SCHEMA_VERSION = 2;
const MAX_TEMPLATES = 8;
const MAX_ACTIVE = 4;

function normalizeFrameTemplate(
  frame: FrameTemplate,
  index: number,
  fallbackSource: 'builtin' | 'custom' = 'custom'
): FrameTemplate {
  return {
    ...JSON.parse(JSON.stringify(frame)),
    id: frame.id ?? uuidv4(),
    source: frame.source ?? (index < BUILTIN_COUNT ? 'builtin' : fallbackSource),
    headerEnabled: frame.headerEnabled ?? true,
  };
}

const normalizedDefaultFrames = defaultFrames.map((frame, index) =>
  normalizeFrameTemplate(frame, index, 'builtin')
);

function remapIndexAfterMove(index: number, fromIndex: number, toIndex: number): number {
  if (index === fromIndex) return toIndex;
  if (fromIndex < toIndex && index > fromIndex && index <= toIndex) return index - 1;
  if (fromIndex > toIndex && index >= toIndex && index < fromIndex) return index + 1;
  return index;
}

interface TemplateState {
  allFrames: FrameTemplate[];
  activeIndices: number[];
  initialized: boolean;
}

export const useTemplateStore = defineStore('template', {
  state: (): TemplateState => ({
    allFrames: JSON.parse(JSON.stringify(normalizedDefaultFrames)),
    activeIndices: [0, 1, 2, 3],
    initialized: false,
  }),

  getters: {
    activeFrames(state): { originalIndex: number; frame: FrameTemplate }[] {
      return state.activeIndices
        .filter((i) => i >= 0 && i < state.allFrames.length)
        .map((i) => ({ originalIndex: i, frame: state.allFrames[i] }));
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
      const raw = await FilesystemService.loadOrInitJson<StoredFrameData | FrameTemplate[]>(
        'customFrameData.json',
        { schemaVersion: CURRENT_SCHEMA_VERSION, frames: normalizedDefaultFrames } as StoredFrameData
      );

      const stored: StoredFrameData = Array.isArray(raw)
        ? { schemaVersion: 0, frames: raw as FrameTemplate[] }
        : (raw as StoredFrameData);

      let frames = stored.frames ?? defaultFrames;
      let needsSave = false;

      const normalizedFrames = frames.map((frame, index) =>
        normalizeFrameTemplate(frame, index, 'custom')
      );

      if (
        !stored.schemaVersion ||
        stored.schemaVersion < CURRENT_SCHEMA_VERSION ||
        normalizedFrames.some(
          (frame, index) =>
            frame.id !== frames[index].id ||
            frame.source !== frames[index].source ||
            frame.headerEnabled !== frames[index].headerEnabled
        )
      ) {
        frames = normalizedFrames;
        needsSave = true;
      }

      this.allFrames = frames;

      if (needsSave) {
        await FilesystemService.writeJsonFile<StoredFrameData>('customFrameData.json', {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          frames: this.allFrames,
        });
      }
    },

    async loadConfig(): Promise<void> {
      const defaultActive = this.allFrames.map((_, i) => i).slice(0, MAX_ACTIVE);
      const config = await FilesystemService.loadOrInitJson<TemplateConfig>(
        'templateConfig.json',
        { activeIndices: defaultActive }
      );
      this.activeIndices = config.activeIndices.filter(
        (i) => i >= 0 && i < this.allFrames.length
      );
      if (this.activeIndices.length === 0 && this.allFrames.length > 0) {
        this.activeIndices = [0];
      }
    },

    async saveFrames(): Promise<void> {
      await FilesystemService.writeJsonFile<StoredFrameData>('customFrameData.json', {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        frames: this.allFrames,
      });
    },

    async saveConfig(): Promise<void> {
      await FilesystemService.writeJsonFile<TemplateConfig>('templateConfig.json', {
        activeIndices: this.activeIndices,
      });
    },

    sanitizeForEntitlement(hasTemplateEditor: boolean): void {
      if (hasTemplateEditor) return;

      const builtinIndices = this.allFrames
        .map((frame, index) => ({ frame, index }))
        .filter(({ frame }) => frame.source === 'builtin')
        .map(({ index }) => index);

      const before = this.activeIndices.length;
      this.activeIndices = this.activeIndices.filter((index) =>
        builtinIndices.includes(index)
      );

      if (this.activeIndices.length === 0 && builtinIndices.length > 0) {
        this.activeIndices = [builtinIndices[0]];
      }

      if (this.activeIndices.length !== before) {
        void this.saveConfig();
      }
    },

    async addTemplate(template: FrameTemplate): Promise<boolean> {
      if (this.allFrames.length >= MAX_TEMPLATES) return false;
      this.allFrames.push(
        normalizeFrameTemplate(template, this.allFrames.length, 'custom')
      );
      await this.saveFrames();
      return true;
    },

    async updateTemplate(index: number, template: FrameTemplate): Promise<boolean> {
      if (index < 0 || index >= this.allFrames.length) return false;
      this.allFrames[index] = normalizeFrameTemplate(
        template,
        index,
        this.allFrames[index].source
      );
      await this.saveFrames();
      return true;
    },

    async moveTemplate(fromIndex: number, toIndex: number): Promise<boolean> {
      if (fromIndex < 0 || fromIndex >= this.allFrames.length) return false;
      if (toIndex < 0 || toIndex >= this.allFrames.length) return false;
      if (fromIndex === toIndex) return false;

      const [frame] = this.allFrames.splice(fromIndex, 1);
      this.allFrames.splice(toIndex, 0, frame);
      this.activeIndices = this.activeIndices
        .map((index) => remapIndexAfterMove(index, fromIndex, toIndex))
        .sort((a, b) => a - b);

      await this.saveFrames();
      await this.saveConfig();
      return true;
    },

    async deleteTemplate(index: number): Promise<boolean> {
      if (index < 0 || index >= this.allFrames.length) return false;
      if (this.allFrames.length <= 1) return false;
      this.allFrames.splice(index, 1);
      this.activeIndices = this.activeIndices
        .filter((i) => i !== index)
        .map((i) => (i > index ? i - 1 : i));
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
