import { useRoute, useRouter } from 'vue-router'
import { usePhotoboothStore } from './data';
import { pageConfig } from '../../data/pageConfig.json';
import { watch } from 'vue';
import { ref, onMounted, onUnmounted } from "vue";

export default function usePhotoboothApp() {
  const router = useRouter()
  const route = useRoute();
  const booth = usePhotoboothStore();
  const isMobile = ref(false);
  const isPortrait = ref(true);
  booth.init();

  const pagesToResetData = pageConfig.map((page) => {
    if(page.resetData === true) {
      return page.name
    }
  })

  onMounted(async () => {
    // CALL FUNCTIONS
    checkMobile();
    // startFullscreen();
    updateOrientation();

    if (window.screen.orientation) {
      window.screen.orientation.addEventListener("change", updateOrientation);
    } else {
      window.matchMedia("(orientation: portrait)").addEventListener("change", updateOrientation);
    }
  });

  onUnmounted(() => {
    if (window.screen.orientation) {
      window.screen.orientation.removeEventListener("change", updateOrientation);
    } else {
      window.matchMedia("(orientation: portrait)").removeEventListener("change", updateOrientation);
    }
  });

  watch(
    () => route.fullPath,
    (newPath, oldPath) => {
      if(pagesToResetData.includes(route.name)) {
        console.log("RESET");
          booth.reset();
      }
    }
  )

  function goBack() {
    const backLink = pageConfig.find((page) => {
      if(page.name === route.name) {
        router.push(page.backLink)
      };
    })
  }

  function updateOrientation() {
    console.log("ORIENTATION CHANGE")
    if (window.screen.orientation) {
      isPortrait.value = window.screen.orientation.type.startsWith("portrait");
    } else {
      isPortrait.value = window.matchMedia("(orientation: portrait)").matches;
    }
  }

  function checkMobile() {
    isMobile.value = /Android|iPhone|iPad|iPod|Windows Phone|webOS/i.test(
      navigator.userAgent
    );
  }

  function startFullscreen() {
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
    }
  }

  return {
    goBack,
    route,
    isPortrait
  }
}