import { watch } from 'vue';
import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router';
import { useAppStore } from '@/stores/appStore';
import { useDesignStore } from '@/stores/designStore';
import pageConfigJson from '@/data/pageConfig.json';
import type { PageConfigEntry } from '@/types';

const pageConfig = (pageConfigJson as { pageConfig: PageConfigEntry[] }).pageConfig;

interface NavigationReturn {
  goBack: () => void;
  route: RouteLocationNormalizedLoaded;
}

export default function useNavigation(): NavigationReturn {
  const router = useRouter();
  const route = useRoute();
  const appStore = useAppStore();
  const designStore = useDesignStore();

  designStore.init();

  const pagesToResetData: string[] = pageConfig
    .filter((page) => page.resetData === true)
    .map((page) => page.name);

  watch(
    () => route.fullPath,
    () => {
      if (pagesToResetData.includes(route.name as string)) {
        appStore.reset();
      }
    }
  );

  function goBack(): void {
    pageConfig.find((page) => {
      if (page.name === route.name) {
        router.push(page.backLink!);
      }
    });
  }

  return { goBack, route };
}
