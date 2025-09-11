import { ref, onBeforeUnmount, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router'
import { usePhotoboothStore } from './data';
import { Capacitor } from '@capacitor/core';
import { UvcCameraPlugin } from '@/plugins/UvcCameraPlugin';

export default function useCamera() {
    const router = useRouter()
    const route = useRoute()
    const booth = usePhotoboothStore();
    const videoRef = ref(null);
    const canvasRef = ref(null);
    const UVCSrcRef = ref('');
    const loaderDelay = 5000;
    const duration = 1; // countdown in seconds
    const timeLeft = ref(duration);
    const stopCameraPage = ['Home', "Template"];
    let timer = ref(null);
    let stream = null;
    let imageCount = 0;
    let shutterFlag = ref(false);
    let isCameraRunning = false;
    let frameListener;

    const startCamera = async () => {
        if (isCameraRunning) return;

        if (Capacitor.getPlatform() === 'web') {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.value) {
                    videoRef.value.srcObject = stream;
                    startCountdown();
                    isCameraRunning = true;
                }
            } catch (err) {
                console.error('Error accessing camera:', err);
            }
        } else {
            const { devices } = await UvcCameraPlugin.listUvcDevices();
            const d = devices[0];
            if (!d) {
                console.warn('No UVC devices found');
                return;
            }
            frameListener = await UvcCameraPlugin.addListener('frame', (payload) => {
                if(payload.file)
                {
                    UVCSrcRef.value = Capacitor.convertFileSrc(payload.file) + "?" + Date.now();
                }
                else
                {
                    UVCSrcRef.value = 'data:image/jpeg;base64,' + payload.data;
                }
            });

            await UvcCameraPlugin.startPreview({
                vendorId: d.vendorId,
                productId: d.productId,
                mode: "file",
                width: 1280,
                height: 720,
                throttleMs: 100,
                jpegQuality: 100,
                minEmitIntervalMs: 100, // ~14 fps over the bridge
            });

            const timeOut = setTimeout( async () => {
                startCountdown();
                clearTimeout(timeOut);
            }, loaderDelay);
        }
    };

    const stopCamera = async () => {
        if (Capacitor.getPlatform() === 'web') {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }
        } else {
            try { await UvcCameraPlugin.stopPreview(); } catch {}
            if (frameListener && frameListener.remove) frameListener.remove();
        }

        isCameraRunning = false;
    };


    const startCountdown = () => {
        if (timer.value) return;
        shutterFlag.value = false;
        timer.value = setInterval( async () => {
            if (timeLeft.value > 0) {
                console.log(timeLeft.value);
                timeLeft.value--;
            } else {
                clearInterval(timer.value);
                timer.value = null;
                
                await capturePhoto()
                if(imageCount < booth.selectedTemplate.imgCount) {
                    resetCountdown();
                    setTimeout(() => {
                        startCountdown();
                    }, 500)
                }
                else
                {
                    resetCountdown();
                    timer.value = null;
                    redirect();
                }
            }
        }, 1000);
    };

    const resetCountdown = () => {
        clearInterval(timer.value);
        timer.value = null;
        timeLeft.value = duration;
    };

    const redirect = () => {
        setTimeout(() => {
            router.push('/design')
        }, 1000)
    }

    const capturePhoto = async () => {
        if (Capacitor.getPlatform() === 'web') {
            const video = videoRef.value;
            const canvas = canvasRef.value;
            if (!video || !canvas) return;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const context = canvas.getContext('2d');
            context.scale(-1, 1);
            context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
            context.restore();

            // Save as data URL
            const imageData = canvas.toDataURL('image/png');
            booth.setImage(imageData);
            imageCount++;
            shutterFlag.value = true;
        }
        else
        {
            const res = await UvcCameraPlugin.capturePhoto();
            const url = Capacitor.convertFileSrc(res.file);
            await booth.setImage(url);
            imageCount++;
            shutterFlag.value = true;
            
            // const result = await CameraPreview.capture({ quality: 45 });
            // const base64 = `data:image/jpeg;base64,${result.value}`;
            // await booth.setImage(base64);
            // imageCount++;
            // shutterFlag.value = true;
        }

    };

    // Clean up when the component is unmounted
    onBeforeUnmount(() => {
        stopCamera();
        resetCountdown();
    });
    
    watch(
        () => route.fullPath,
        (newPath, oldPath) => {
            if(stopCameraPage.includes(route.name)) {
                stopCamera();
            }
        }
    )

    return {
        shutterFlag,
        timer,
        timeLeft,
        videoRef,
        canvasRef,
        UVCSrcRef,
        startCamera
    }
}