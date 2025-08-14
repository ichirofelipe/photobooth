import { ref, onMounted } from "vue";

export default function rotatePopup() {
    const videoRef = ref(null);
    
    onMounted(() => {
        console.log("WOW")
        initRotatePhoneVideo();
    });

    

    return {
        videoRef
    }
}