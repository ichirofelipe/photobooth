import { createRouter, createWebHistory } from 'vue-router';
import Home from '../pages/Start.vue';
import Template from '../pages/TemplateSelection.vue';
import Camera from '../pages/Camera.vue';
import Design from '../pages/Design.vue';
import Setup from '../pages/Setup.vue';

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/templates', name: 'Template', component: Template },
  { path: '/camera', name: 'Camera', component: Camera },
  { path: '/design', name: 'Design', component: Design },
  { path: '/setup', name: 'Setup', component: Setup },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;