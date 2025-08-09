import { useRouter, useRoute } from 'vue-router'
import { onMounted } from 'vue';
import { usePhotoboothStore } from './data';
import { frameDesigns } from '../data/frameDesigns.json';

export default function usePhotoboothApp() {
  const router = useRouter()
  const route = useRoute();
  const booth = usePhotoboothStore();

  onMounted(async () => {
    await booth.loadDesigns(frameDesigns.map(design => design.src));
  });

  function goBack() {
    router.back()
  }

  return {
    goBack,
    route,
  }
}