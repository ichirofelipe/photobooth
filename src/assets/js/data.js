import { defineStore } from 'pinia';

export const usePhotoboothStore = defineStore('photobooth', {
  state: () => ({
    selectedTemplate: null,
    selectedVariation: 0,
    uploadedImages: [],
    designs: {},
    selectedDesign: 0,
  }),

  actions: {
    setTemplate(templateId, imgCount) {
      console.log(templateId, imgCount)
      this.selectedTemplate = {
        id: templateId,
        imgCount: imgCount
      };
    },
    async setImage(imageData) {
      await loadImgFunc(imageData).then(img => {
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
    setVariation(variation) {
      console.log("SELECTED")
      this.selectedVariation = variation;
    },
    reset() {
      this.selectedTemplate = null;
      this.selectedVariation = 0;
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