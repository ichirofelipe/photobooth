import { createRouter, createWebHistory } from 'vue-router';
import Home from '../pages/Start.vue';
import About from '../pages/TemplateSelection.vue';
import Camera from '../pages/Camera.vue';
import Design from '../pages/Design.vue';

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/templates', name: 'About', component: About },
  { path: '/camera', name: 'Camera', component: Camera },
  { path: '/design', name: 'Design', component: Design },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;