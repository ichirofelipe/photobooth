/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

declare module '*.json' {
  const value: Record<string, unknown>;
  export default value;
}

declare module 'vue-konva';
declare module 'vue3-colorpicker' {
  import type { DefineComponent } from 'vue';
  export const ColorPicker: DefineComponent;
}
