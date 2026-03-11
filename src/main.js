import { createApp } from 'vue'
import { createPinia } from 'pinia';
import App from './App.vue'
import router from './router';
import VueKonva from 'vue-konva';
import './style.css'
import { registerCapacitorListeners } from './assets/js/capacitor-listeners';
import '@mdi/font/css/materialdesignicons.css'

const app = createApp(App);

registerCapacitorListeners();

app.use(router);
app.use(VueKonva);
app.use(createPinia());
app.mount('#app');
