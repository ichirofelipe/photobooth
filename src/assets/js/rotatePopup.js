import { ref, onMounted } from "vue";

export default function rotatePopup() {
    const videoRef = ref(null);
    
    onMounted(() => {
        initRotatePhoneVideo();
    });

    

    return {
        videoRef
    }
}