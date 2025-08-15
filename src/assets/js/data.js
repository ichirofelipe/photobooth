import { defineStore } from 'pinia';

export const usePhotoboothStore = defineStore('photobooth', {
  state: () => ({
    selectedFrame: null,
    uploadedImages: [],
    designs: {},
    selectedDesign: 0,
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
      loadImgFunc(imageData).then(img => {
        this.uploadedImages.push(
          {
            src: imageData,
            width: img.width,
            height: img.height
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
    loadImgData (url) {
      return loadImgFunc(url);
    },
    async loadDesigns(imageUrls = []) {
      const loadPromises = imageUrls.map((src, index) => {
        return loadImgFunc(src).then(img => {
          this.designs[index] = img;
        });
      });
      await Promise.all(loadPromises);
    }
  },
});

const loadImgFunc = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve(img);
    }
    img.onerror = reject;
    img.src = url;
  })
}