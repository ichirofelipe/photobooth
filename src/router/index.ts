import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import Home from '../pages/Start.vue';
import Template from '../pages/TemplateSelection.vue';
import Camera from '../pages/Camera.vue';
import Design from '../pages/Design.vue';
import Setup from '../pages/Setup.vue';
import QrResult from '../pages/QrResult.vue';
import TemplateEditor from '../pages/TemplateEditor.vue';
import PremiumAccess from '../pages/PremiumAccess.vue';
import { useEntitlementStore } from '../stores/entitlementStore';

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'Home', component: Home },
  { path: '/templates', name: 'Template', component: Template },
  { path: '/camera', name: 'Camera', component: Camera },
  { path: '/design', name: 'Design', component: Design },
  { path: '/setup', name: 'Setup', component: Setup },
  { path: '/qr', name: 'QrResult', component: QrResult },
  { path: '/template-editor', name: 'TemplateEditor', component: TemplateEditor },
  { path: '/premium/:target?', name: 'PremiumAccess', component: PremiumAccess },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Routes that require a valid base_app entitlement
const BASE_PROTECTED: (string | symbol)[] = [
  'Template',
  'Camera',
  'Design',
  'Setup',
  'QrResult',
  'TemplateEditor',
  'PremiumAccess',
];

router.beforeEach(async (to) => {
  const entitlements = useEntitlementStore();
  if (!entitlements.initialized) {
    await entitlements.init();
  }

  // Enforce base_app on all protected routes
  if (
    BASE_PROTECTED.includes(to.name as string) &&
    !entitlements.isValid('base_app')
  ) {
    return { name: 'Home' };
  }

  // Enforce template_editor on the editor page
  if (to.name === 'TemplateEditor' && !entitlements.isValid('template_editor')) {
    return { name: 'PremiumAccess', params: { target: 'template_editor' } };
  }

  // Enforce qr_download on the QR result page (defense-in-depth alongside handlePrint)
  if (to.name === 'QrResult' && !entitlements.isValid('qr_download')) {
    return { name: 'PremiumAccess', params: { target: 'qr_download' } };
  }
});

export default router;
