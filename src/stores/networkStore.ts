import { defineStore } from 'pinia';
import { FilesystemService } from '@/services/filesystem';
import defaultNetworkData from '@/data/networkData.json';
import type { NetworkData } from '@/types';

interface NetworkState {
  networkData: NetworkData;
}

export const useNetworkStore = defineStore('network', {
  state: (): NetworkState => ({
    networkData: { ipAddress: '', qrEnabled: false },
  }),

  actions: {
    async load(): Promise<void> {
      this.networkData = await FilesystemService.loadOrInitJson<NetworkData>('networkData.json', defaultNetworkData as NetworkData);
    },

    async save(): Promise<void> {
      await FilesystemService.writeJsonFile('networkData.json', this.networkData);
    },

    updateField<K extends keyof NetworkData>(key: K, value: NetworkData[K]): void {
      this.networkData[key] = value;
      this.save();
    },
  },
});
