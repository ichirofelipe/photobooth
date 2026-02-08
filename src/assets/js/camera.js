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
    const duration = 8; // countdown in seconds
    const timeLeft = ref(duration);
    const stopCameraPage = ['Home', "Template"];
    let timer = ref(null);
    let stream = null;
    let imageCount = ref(0);
    let shutterFlag = ref(false);
    let isCameraRunning = false;
    let hasCountDownStarted = false;
    let frameListener;

    const startCamera = async () => {
        console.log('Starting camera...');
        if (isCameraRunning) return;

        if (Capacitor.getPlatform() === 'web') {
            try {
                console.log('Accessing web camera...');
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
            const d = JSON.parse(devices)[0];
            console.log(d);
            
            const USBState = await UvcCameraPlugin.debugUsbState();
            console.log(USBState);
            if (!d) {
                console.warn('No UVC devices found');
                // return;
            }
            frameListener = await UvcCameraPlugin.addListener('frame', (frame) => {
                const img = new Image();
                UVCSrcRef.value = `data:image/jpeg;base64,${frame.data}`;

                if(!hasCountDownStarted)
                {
                    console.log("Starting countdown after loader delay");
                    hasCountDownStarted = true;
                    const timeOut = setTimeout( async () => {
                        startCountdown();
                        clearTimeout(timeOut);
                    }, loaderDelay);
                }
            });

            await UvcCameraPlugin.startPreview({});

            const { granted } = await UvcCameraPlugin.hasUsbPermission();
            console.log("hasUsbPermission:", granted);
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
        hasCountDownStarted = false;
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
                if(imageCount.value < booth.selectedTemplate.imgCount) {
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
            imageCount.value++;
            shutterFlag.value = true;
        }
        else
        {
            const res = await UvcCameraPlugin.capturePhoto();
            const url = Capacitor.convertFileSrc(res.file);
            await booth.setImage(url);
            imageCount.value++;
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
        startCamera,
        imageCount
    }
}