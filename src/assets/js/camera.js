import { ref, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router'
import { usePhotoboothStore } from './data';

export default function useCamera() {
    const router = useRouter()
    const booth = usePhotoboothStore();
    const videoRef = ref(null);
    const canvasRef = ref(null);
    const duration = 1; // countdown in seconds
    const timeLeft = ref(duration);
    let timer = ref(null);
    let stream = null;
    let imageCount = 0;
    let shutterFlag = ref(false);

    const startCamera = async () => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.value) {
            videoRef.value.srcObject = stream;
            startCountdown();
            }
        } catch (err) {
            console.error('Error accessing camera:', err);
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
    };


    const startCountdown = () => {
        if (timer.value) return;
        shutterFlag.value = false;
        timer.value = setInterval(() => {
            if (timeLeft.value > 0) {
                console.log(timeLeft.value);
                timeLeft.value--;
            } else {
                clearInterval(timer.value);
                capturePhoto();
                if(imageCount < booth.selectedFrame.imgCount) {
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

    const capturePhoto = () => {
        const video = videoRef.value;
        const canvas = canvasRef.value;
        if (!video || !canvas) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Save as data URL
        const imageData = canvas.toDataURL('image/png');
        booth.setImage(imageData);
        imageCount++;
        shutterFlag.value = true;
    };

    // Clean up when the component is unmounted
    onBeforeUnmount(() => {
        stopCamera();
    });

    startCamera()

    return {
        shutterFlag,
        timer,
        timeLeft,
        videoRef,
        canvasRef
    }
}