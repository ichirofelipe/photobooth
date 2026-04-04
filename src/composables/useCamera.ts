import { ref, onBeforeUnmount, watch, type Ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAppStore } from '@/stores/appStore';
import { Capacitor } from '@capacitor/core';
import { UvcCameraPlugin } from '@/plugins/UvcCameraPlugin';

interface CameraReturn {
  shutterFlag: Ref<boolean>;
  timer: Ref<ReturnType<typeof setInterval> | null>;
  timeLeft: Ref<number>;
  videoRef: Ref<HTMLVideoElement | null>;
  canvasRef: Ref<HTMLCanvasElement | null>;
  UVCSrcRef: Ref<string>;
  startCamera: () => Promise<void>;
  imageCount: Ref<number>;
}

export default function useCamera(): CameraReturn {
  const router = useRouter();
  const route = useRoute();
  const appStore = useAppStore();

  const videoRef = ref<HTMLVideoElement | null>(null);
  const canvasRef = ref<HTMLCanvasElement | null>(null);
  const UVCSrcRef = ref('');
  const duration = 8;
  const timeLeft = ref(duration);
  const stopCameraPage = ['Home', 'Template'];

  const timer = ref<ReturnType<typeof setInterval> | null>(null);
  let stream: MediaStream | null = null;
  const imageCount = ref(0);
  const shutterFlag = ref(false);
  let isCameraRunning = false;
  let hasCountDownStarted = false;
  let frameListener: { remove: () => void } | undefined;

  const startCamera = async (): Promise<void> => {
    if (isCameraRunning) return;

    if (Capacitor.getPlatform() === 'web') {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.value) {
          videoRef.value.srcObject = stream;

          // Wait for the video to actually start rendering frames
          videoRef.value.addEventListener('loadeddata', () => {
            if (!hasCountDownStarted) {
              hasCountDownStarted = true;
              startCountdown();
            }
          }, { once: true });

          await videoRef.value.play();
          isCameraRunning = true;
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
      }
    } else {
      const { devices } = await UvcCameraPlugin.listUvcDevices();
      const d = JSON.parse(devices)[0];
      console.log(d);

      const USBState = await UvcCameraPlugin.debugUsbState();
      console.log(USBState);

      if (!d) {
        console.warn('No UVC devices found');
      }

      frameListener = await UvcCameraPlugin.addListener('frame', (frame: { data: string }) => {
        UVCSrcRef.value = `data:image/jpeg;base64,${frame.data}`;

        // Start countdown on the first real frame — camera is ready and rendering
        if (!hasCountDownStarted) {
          hasCountDownStarted = true;
          startCountdown();
        }
      });

      await UvcCameraPlugin.startPreview({});

      const { granted } = await UvcCameraPlugin.hasUsbPermission();
      console.log('hasUsbPermission:', granted);
    }
  };

  const stopCamera = async (): Promise<void> => {
    if (Capacitor.getPlatform() === 'web') {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
    } else {
      try {
        await UvcCameraPlugin.stopPreview();
      } catch {
        // Ignore stop errors
      }
      if (frameListener && frameListener.remove) frameListener.remove();
    }

    isCameraRunning = false;
    hasCountDownStarted = false;
  };

  const startCountdown = (): void => {
    if (timer.value) return;
    shutterFlag.value = false;

    timer.value = setInterval(async () => {
      if (timeLeft.value > 0) {
        timeLeft.value--;
      } else {
        clearInterval(timer.value!);
        timer.value = null;

        await capturePhoto();
        if (imageCount.value < appStore.selectedTemplate!.imgCount) {
          resetCountdown();
          setTimeout(() => {
            startCountdown();
          }, 500);
        } else {
          resetCountdown();
          timer.value = null;
          redirect();
        }
      }
    }, 1000);
  };

  const resetCountdown = (): void => {
    clearInterval(timer.value!);
    timer.value = null;
    timeLeft.value = duration;
  };

  const redirect = (): void => {
    setTimeout(() => {
      router.push('/design');
    }, 1000);
  };

  const capturePhoto = async (): Promise<void> => {
    if (Capacitor.getPlatform() === 'web') {
      const video = videoRef.value;
      const canvas = canvasRef.value;
      if (!video || !canvas) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      if (!context) return;
      context.save();
      context.scale(-1, 1);
      context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      context.restore();

      const imageData = canvas.toDataURL('image/png');
      appStore.addImage(imageData);
      imageCount.value++;
      shutterFlag.value = true;
    } else {
      const res = await UvcCameraPlugin.capturePhoto();
      const url = Capacitor.convertFileSrc(res.file);
      await appStore.addImage(url);
      imageCount.value++;
      shutterFlag.value = true;
    }
  };

  onBeforeUnmount(() => {
    stopCamera();
    resetCountdown();
  });

  watch(
    () => route.fullPath,
    () => {
      if (stopCameraPage.includes(route.name as string)) {
        stopCamera();
      }
    }
  );

  return {
    shutterFlag,
    timer,
    timeLeft,
    videoRef,
    canvasRef,
    UVCSrcRef,
    startCamera,
    imageCount,
  };
}
