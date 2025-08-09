import { useRoute, useRouter } from 'vue-router'
import { onMounted } from 'vue';
import { usePhotoboothStore } from './data';
import { frameDesigns } from '../../data/frameDesigns.json';
import { pageConfig } from '../../data/pageConfig.json';
import { watch } from 'vue';

export default function usePhotoboothApp() {
  const router = useRouter()
  const route = useRoute();
  const booth = usePhotoboothStore();

  onMounted(async () => {
    await booth.loadDesigns(frameDesigns.map(design => design.src));
  });

  function goBack() {
    const backLink = pageConfig.find((page) => {
      if(page.name === route.name) {
        router.push(page.backLink)
      };
    })
  }

  const pagesToResetData = pageConfig.map((page) => {
    if(page.resetData === true) {
      return page.name
    }
  })

  watch(
    () => route.fullPath,
    (newPath, oldPath) => {
      if(pagesToResetData.includes(route.name)) {
        console.log("RESET");
          booth.reset();
      }
    }
  )

  return {
    goBack,
    route,
  }
}