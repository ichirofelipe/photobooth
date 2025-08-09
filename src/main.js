import { createApp } from 'vue'
import { createPinia } from 'pinia';
import App from './App.vue'
import router from './router';
import VueKonva from 'vue-konva';
import './style.css'

const app = createApp(App);

app.use(router);
app.use(VueKonva);
app.use(createPinia());
app.mount('#app');
