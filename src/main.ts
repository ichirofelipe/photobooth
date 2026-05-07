import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import VueKonva from 'vue-konva';
import './tailwind.css';
import './style.scss';
import { registerCapacitorListeners } from './assets/js/capacitor-listeners';
import '@mdi/font/css/materialdesignicons.css';
import { useEntitlementStore } from './stores/entitlementStore';

const app = createApp(App);
const pinia = createPinia();

registerCapacitorListeners();

app.use(pinia);

// Entitlements must be loaded before the first navigation fires so that
// router guards can evaluate feature access on startup.
(async () => {
  const entitlementStore = useEntitlementStore();
  try {
    await entitlementStore.init();
  } catch (error) {
    console.warn('[entitlements] Initial load failed; continuing with router fallback.', error);
    entitlementStore.configError =
      entitlementStore.configError ??
      'Failed to load entitlements on startup. Restart the app or verify the activation setup.';
    entitlementStore.initialized = true;
  }

  app.use(router);
  app.use(VueKonva);
  await router.isReady();
  app.mount('#app');
})();
