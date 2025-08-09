import { defineStore } from 'pinia';
import { onMounted } from 'vue';

export const usePhotoboothStore = defineStore('photobooth', {
  state: () => ({
    selectedFrame: null,
    uploadedImages: [],
    designs: {},
    selectedDesign: 0
  }),

  actions: {
    setFrame(frameId, imgCount) {
      console.log(frameId, imgCount)
      this.selectedFrame = {
        id: frameId,
        imgCount: imgCount
      };
    },
    setImage(imageData) {
      getImageDimensions(imageData).then(({width, height}) => {
        console.log(width, height)
        this.uploadedImages.push(
          {
            src: imageData,
            width: width,
            height: height
          }
        );
      })
    },
    setDesign(design) {
      this.selectedDesign = design;
    },
    reset() {
      this.selectedFrame = null;
      this.uploadedImages = [];
      this.selectedDesign = 0;
    },
    async loadDesigns(imageUrls = []) {
      const loadPromises = imageUrls.map((src, index) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            this.designs[index] = img;
            resolve();
          };
          img.src = src;
        });
      });

      await Promise.all(loadPromises);
    }
  },
});

const getImageDimensions = (dataUrl) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.width, height: img.height });
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
};