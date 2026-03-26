import { ref, onMounted, onUnmounted, type Ref } from 'vue';

interface OrientationReturn {
  isMobile: Ref<boolean>;
  isPortrait: Ref<boolean>;
}

export default function useOrientation(): OrientationReturn {
  const isMobile = ref(false);
  const isPortrait = ref(true);

  function updateOrientation(): void {
    if (window.screen.orientation) {
      isPortrait.value = window.screen.orientation.type.startsWith('portrait');
    } else {
      isPortrait.value = window.matchMedia('(orientation: portrait)').matches;
    }
  }

  function checkMobile(): void {
    isMobile.value = /Android|iPhone|iPad|iPod|Windows Phone|webOS/i.test(navigator.userAgent);
  }

  onMounted(() => {
    checkMobile();
    updateOrientation();

    if (window.screen.orientation) {
      window.screen.orientation.addEventListener('change', updateOrientation);
    } else {
      window.matchMedia('(orientation: portrait)').addEventListener('change', updateOrientation);
    }
  });

  onUnmounted(() => {
    if (window.screen.orientation) {
      window.screen.orientation.removeEventListener('change', updateOrientation);
    }
  });

  return { isMobile, isPortrait };
}
