import { defineStore } from 'pinia';
import { headerData, logoData } from '../../data/designData.json';

export const usePhotoboothStore = defineStore('photobooth', {
  state: () => ({
    initialized: false,
    baseHeaderDir: "/images/designs/",
    baseLogoDir: "/images/logo/",
    
    // CHANGING VARIABLES
    selectedTemplate: null,
    selectedVariation: 0,
    selectedDesign: 0,
    uploadedImages: [],

    // INIT VARIABLES (one time)
    headerImgs: [],
    logoImgs: [],
  }),

  actions: {
    async init() {
      if (!this.initialized) {

        // LOAD HEADER IMGS
        await headerData.forEach( async (imgName, index) => {
          const headerUrl = `${this.baseHeaderDir}${imgName}`;
          await loadImgFunc(headerUrl).then(img => {
            this.headerImgs[index] = img;
          })
        })

        // LOAD LOGO IMGS
        await logoData.forEach( async (imgName, index) => {
          const logoUrl = `${this.baseLogoDir}${imgName}`;
          await loadImgFunc(logoUrl).then(img => {
            this.logoImgs[index] = img;
          })
        })
      }
    },
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
    setDesign(frame) {
      this.selectedDesign = frame;
    },
    setVariation(variation) {
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
    async loadDesign(imageUrl) {
      return loadImgFunc(imageUrl).then(img => {
        this.designs.push(img);
      });
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