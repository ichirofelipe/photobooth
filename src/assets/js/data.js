import { defineStore } from 'pinia';
import designData from '../../data/designData.json';
import rawNetworkData from '../../data/networkData.json';
import { frames } from '../../data/frameData.json';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

export const usePhotoboothStore = defineStore('photobooth', {
  state: () => ({
    initialized: false,
    baseHeaderDir: "/images/designs/",
    baseFooterDir: "/images/footer/",
    baseHomeLogoDir: "/images/homeLogo/",
    //test values
    testImages: [
        {
            src: '/images/captures/sample1.webp',
            width: 1200,
            height: 1197,
        },
        {
            src: '/images/captures/sample2.webp',
            width: 1200,
            height: 1197,
        },
        {
            src: '/images/captures/sample3.webp',
            width: 1200,
            height: 1197,
        },
        {
            src: '/images/captures/sample4.webp',
            width: 1200,
            height: 1197,
        },
        {
            src: '/images/captures/sample1.webp',
            width: 1200,
            height: 1197,
        },
        {
            src: '/images/captures/sample2.webp',
            width: 1200,
            height: 1197,
        },
        {
            src: '/images/captures/sample3.webp',
            width: 1200,
            height: 1197,
        },
        {
            src: '/images/captures/sample4.webp',
            width: 1200,
            height: 1197,
        },
    ],
    
    // CHANGING VARIABLES
    selectedTemplate: null,
    selectedVariation: 0,
    selectedDesign: 0,
    uploadedImages: [],


    // SETUP PAGE
    selectedColorIndex: null,
    selectedFooterIndex: null,
    selectedHeaderIndex: null,
    currentTemplateIndex: 3,
    currentTemplate: frames[3],
    loadedTestImages: [],

    // INIT VARIABLES (one time)
    uploadData: {
      headerData: [],
      footerData: [],
      homeLogoData: null
    },
    headerData: [],
    footerData: [],
    homeLogoData: null,
    mainData: [],
    networkData: [],
  }),

  actions: {
    async init() {
      if (!this.initialized) {
        await this.reloadMainData();
        this.loadTestImages();
        console.log('Photobooth store initialized', this.mainData);
        this.initialized = true;
      }
    },
    setTemplate(templateId, imgCount) {
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
    setColor(colorIndex) {
      this.selectedColorIndex = colorIndex;
    },
    setFrame(direction) {
      switch (direction) {
            case 'prev':
                this.currentTemplateIndex = this.currentTemplateIndex > 0 ? this.currentTemplateIndex - 1 : 3;
                this.currentTemplate = frames[this.currentTemplateIndex];
                console.log('Current setup template:', this.currentTemplateIndex);
                break;
            case 'next':
                this.currentTemplateIndex = this.currentTemplateIndex < 3 ? this.currentTemplateIndex + 1 : 0;
                this.currentTemplate = frames[this.currentTemplateIndex];
                console.log('Current setup template:', this.currentTemplateIndex);
                break;
        }
    },
    setHeader(headerIndex) {
      this.selectedHeaderIndex = headerIndex;
    },
    setFooter(footerIndex) {
      this.selectedFooterIndex = footerIndex;
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
    getImagesForCurrentTemplate() {
      const imagesData = this.currentTemplate.variation[this.selectedVariation].imagesData || [];
      return this.loadedTestImages.slice(0, imagesData.length);
    },
    loadImgData (url) {
      return loadImgFunc(url);
    },
    async loadDesign(imageUrl) {
      return loadImgFunc(imageUrl).then(img => {
        this.designs.push(img);
      });
    },
    async reloadMainData() {
      await this.dumpDir();

      await this.loadDesignData();
      await this.loadNetworkData();
      // LOAD HEADER IMGS
      await this.loadImageHelper('header', this.baseHeaderDir);
      // LOAD FOOTER IMGS
      await this.loadImageHelper('footer', this.baseFooterDir);
      // LOAD HOME LOGO IMGS
      await this.loadImageHelper('homeLogo', this.baseHomeLogoDir);
    },
    loadTestImages() {
      this.testImages.forEach((img, index) => {
        this.loadImgData(img.src).then((imgData) => {
          this.loadedTestImages[index] = imgData;
        });
      });
    },
    async loadDesignData() {
      try {
            // Try to read the JSON from the app's writable directory
            const result = await Filesystem.readFile({
                path: 'designData.json',
                directory: Directory.Data,
                encoding: Encoding.UTF8,
            });

            // Parse and return the saved JSON
            const data = JSON.parse(result.data);
            console.log('Loaded design data from filesystem:', data);
            // if(data.length > 0)
            // {
            //   console.log('Initial load of design data');
            //   this.mainData = data;
            // }
            // else
            // {
            //   throw new Error("Data not found")
            // }
            if(this.mainData.length === 0)
            {
                this.mainData = data;
            }
            else
            {
                const { colorData, headerData, footerData, homeLogoData } = data;
                this.mainData.colorData = colorData;
                this.mainData.headerData = headerData;
                this.mainData.footerData = footerData;
                this.mainData.homeLogoData = homeLogoData;
            }

            console.log('Design data loaded from filesystem:', this.mainData);

        } catch (e){
            // If not found, write the default JSON to the writable directory
            await Filesystem.writeFile({
                path: 'designData.json',
                data: JSON.stringify(designData, null, 4), // 4-space indent
                directory: Directory.Data,
                encoding: Encoding.UTF8,
            });

            // Return the default JSON
            this.mainData = JSON.parse(JSON.stringify(designData));
        }
    },
    async loadImageHelper(key, directory) {
        const data = this.mainData[`${key}Data`];

        console.log(Array.isArray(data), 'loading setup images for', key, data);
        if(Array.isArray(data))
        {
            for (let index = 0; index < data.length; index++) {
                const imgName = data[index];
                const url = `${directory}${imgName}`;

                let img;
                try{
                    img = await this.loadImgData(url);
                }
                catch(e){
                    console.log(`Cannot load ${key} image from base files trying to load in data directory:`, e);

                    try {
                        img = await loadImage(`${key}Data/${imgName}`);
                        console.log(`Loaded ${key} image from data directory:`, imgName);
                    }
                    catch(err){
                        console.error(`Cannot load ${key} image:`, err);
                        img = null;
                    }
                }
                console.log('Loaded', );
                if(this.mainData[`${key}Images`]===undefined)this.mainData[`${key}Images`] = [];
                this.mainData[`${key}Images`][index] = img;
            }
        }
        else
        {
            const url = `${directory}${data}`;
            console.log('Loading single image for', key, url);
            let img;
            try{
                img = await this.loadImgData(url);
            }
            catch(e){
                console.log(`Cannot load ${key} image from base files trying to load in data directory:`, e);

                try {
                    img = await loadImage(`${key}Data/${data}`);
                    console.log(`Loaded ${key} image from data directory:`, data);
                }
                catch(err){
                    console.error(`Cannot load ${key} image:`, err);
                    img = null;
                }
            }
            this.mainData[`${key}Image`] = img;
        }
    },
    async loadNetworkData () {
        try {
            // Try to read the JSON from the app's writable directory
            const result = await Filesystem.readFile({
                path: 'networkData.json',
                directory: Directory.Data,
                encoding: Encoding.UTF8,
            });

            // Parse and return the saved JSON
            const data = JSON.parse(result.data);
            this.networkData = data;
            console.log('Network data loaded from filesystem:', this.networkData);

        } catch {
            // If not found, write the default JSON to the writable directory
            await Filesystem.writeFile({
                path: 'networkData.json',
                data: JSON.stringify(rawNetworkData, null, 4), // 4-space indent
                directory: Directory.Data,
                encoding: Encoding.UTF8,
            });

            this.networkData = JSON.parse(JSON.stringify(rawNetworkData));
            // Return the default JSON
            console.log('Network data written to filesystem:', this.networkData);
        }
    },
    async saveJson (fileName, data) {
        await Filesystem.writeFile({
            path: fileName,
            data: data,
            directory: Directory.Data, // or Directory.Data
            encoding: 'utf8',
        });
    },
    async deleteDesignJson () {
        try {
            await Filesystem.deleteFile({
                path: 'designData.json',
                directory: Directory.Data
            });
        } catch (err) {
            console.error('Delete failed:', err);
        }
    },

    async dumpDir(path = '') {
      const { files } = await Filesystem.readdir({
        path,
        directory: Directory.Data,
      });

      for (const file of files) {
        const fullPath = path ? `${path}/${file}` : file;

        console.log(fullPath);
        // try {
        //   const stat = await Filesystem.stat({
        //     path: fullPath,
        //     directory: Directory.Data,
        //   });

        //   if (stat.type === 'directory') {
        //     console.log(`📁 ${fullPath}/`);
        //     await this.dumpDir(fullPath); // ✅ MUST use this
        //   } 
        //   else if (fullPath.endsWith('.json')) {
        //     const result = await Filesystem.readFile({
        //       path: fullPath,
        //       directory: Directory.Data,
        //       encoding: Encoding.UTF8,
        //     });
        //     console.log(`📄 ${fullPath}:`, JSON.parse(result.data));
        //   } 
        //   else {
        //     console.log(`🖼️ ${fullPath} (binary skipped)`);
        //   }
        // } catch (e) {
        //   console.warn(`⚠️ Failed: ${fullPath}`, e);
        // }
      }
    }
  }
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

const loadImage = async (filePath) => {
    const result = await Filesystem.readFile({
        path: filePath,
        directory: Directory.Data
    });
    // gets MIME type (png, jpg, svg, etc)
    const ext = filePath.split('.').pop().toLowerCase();
    let mime = 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
    if (ext === 'svg') mime = 'image/svg+xml';

    // build usable image url
    const imgSrc = `data:${mime};base64,${result.data}`;

    // return actual Image() using your existing function
    return loadImgFunc(imgSrc);
}