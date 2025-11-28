import { ref, onMounted } from 'vue';
import { frames } from '../../data/frameData.json';
import { usePhotoboothStore } from './data';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import designData from '../../data/designData.json';

// Get configuration for the base
export default function useSetup() {
    const mainData = ref();
    const booth = usePhotoboothStore();
    const baseWidth = 600;
    const baseHeight = 900;
    const minHeight = 1100;
    const responsiveWidth = ref(baseWidth);
    const responsiveHeight = ref(baseHeight);
    const diff = ref(0);
    const selectedFrameId = booth.selectedTemplate?.id ?? 2;
    const { frameData, variation } = frames[selectedFrameId];
    const uploadData = ref({
        headerData: [],
        logoData: [],
    });

    onMounted(() => {
        updateSizing();
        window.addEventListener("resize", updateSizing);
    })

    const updateSizing = () => {
        const tmpDiff = (minHeight-window.innerHeight)/minHeight;
        diff.value = tmpDiff >= 0 ? tmpDiff : 0;
        responsiveWidth.value = baseWidth-(baseWidth*diff.value);
        responsiveHeight.value = baseHeight-(baseHeight*diff.value);

        console.log(diff.value,window.innerHeight,baseWidth-(baseWidth*diff.value))
    }

    // Get configuration for the frame
    const getFrameConfig = () => {
        const resWidth = frameData.width-(frameData.width*diff.value);
        const resHeight = frameData.height-(frameData.height*diff.value);

        const scaleFactorWidth = resWidth / frameData.width;
        const frameStrokeWidth = frameData.strokeSize;
        const x = ((responsiveWidth.value - (resWidth)) / 2) + (frameStrokeWidth / 2);
        const y = ((responsiveHeight.value - resHeight) / 2) + (frameStrokeWidth / 2);
        const width = resWidth - frameStrokeWidth;
        const height = resHeight - frameStrokeWidth;
        const color = booth.selectedColorIndex !== null ? mainData.value.colorData[booth.selectedColorIndex].hex : '#ffffff';

        return {
            x: x,
            y: y,
            width: width,
            height: height,
            fill: color,
            fillPatternScale: {x: scaleFactorWidth, y: scaleFactorWidth},
            stroke: 'black',
            strokeWidth: frameStrokeWidth,
            cornerRadius: 3
        };
    }

    const layerRef = ref(null);
    const loadedImages = ref({});
    
    //test values
    const testImages = [
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
    ]

    // Load images
    onMounted(() => {
        testImages.forEach((img, index) => {
            booth.loadImgData(img.src).then((imgData) => {
                loadedImages.value = {
                    ...loadedImages.value,
                    [index]: imgData
                };
            });
        });
    });

    const getHeaderConfig = () => {
        console.log('getting header config');
        if(booth.selectedColorIndex === null) return;
        const { headerImages } = mainData.value;
        const data = mainData.value.colorData[booth.selectedColorIndex];

        let headerIndex = booth.selectedHeaderIndex;
        if(data.header === null)
        {
            if(headerIndex === null) return;
        }
        else
        {
            headerIndex = data.header;
        }

        if(!headerImages[headerIndex]) return;
        console.log('header data', variation[booth.selectedVariation].headerData, diff.value, headerImages[headerIndex]);
        return getImageRectConfig(variation[booth.selectedVariation].headerData, diff.value, headerImages[headerIndex])
    }

    const getLogoConfig = () => {
        console.log('getting logo config');
        if(booth.selectedColorIndex === null) return;
        const { logoImages } = mainData.value;
        const data = mainData.value.colorData[booth.selectedColorIndex];

        let logoIndex = booth.selectedLogoIndex;
        if(data.logo === null)
        {
            if(logoIndex === null) return;
        }
        else
        {
            logoIndex = data.logo;
        }

        if(!logoImages[logoIndex]) return;
        console.log('logo data', variation[booth.selectedVariation].logoData, diff.value, logoImages[logoIndex]);
        return getImageRectConfig(variation[booth.selectedVariation].logoData, diff.value, logoImages[logoIndex])
    };

    // Get configuration for each image
    const getImageConfig = (img, index) => {
        if(!variation[booth.selectedVariation].imagesData[index]) return;
        const imgRectData = getImageRectConfig(variation[booth.selectedVariation].imagesData[index], diff.value, img)

        return {
            ...imgRectData,
            cornerRadius: 1
        };
    };

    const getImageRectConfig = (imgFrameData, scale, imgData) => {
        const resWidth = imgFrameData.width-(imgFrameData.width*scale);
        const resHeight = imgFrameData.height-(imgFrameData.height*scale);
        const resX = imgFrameData.x-(imgFrameData.x*scale);
        const resY = imgFrameData.y-(imgFrameData.y*scale);

        const scaleFactorWidth = resWidth / imgData.width;
        const scaledImageHeight =  (scaleFactorWidth * imgData.height) ;
        const scaledImageWidth =  (scaleFactorWidth * imgData.width) ;
        const verticalOffset = (scaledImageHeight - resHeight) / 2;
        const horizontalOffset = (scaledImageWidth - resWidth) / 2;
        const imageOffsetX = getFrameConfig().x + resX;
        const imageOffsetY = getFrameConfig().y + resY;
        const finalOffsetY = (verticalOffset/scaledImageHeight * imgData.height);
        const finalOffsetX = (horizontalOffset/scaledImageWidth * imgData.width);

        return {
            fillPatternImage: imgData,
            fillPatternScale: { x: scaleFactorWidth, y: scaleFactorWidth},
            fillPatternOffset: { x: finalOffsetX, y: finalOffsetY},
            fillPatternRepeat: 'no-repeat',
            x: imageOffsetX,
            y: imageOffsetY,
            width: resWidth,
            height: resHeight,
        };
    }

    const loadDesignData = async () => {
        try {
            // Try to read the JSON from the app's writable directory
            const result = await Filesystem.readFile({
                path: 'designData.json',
                directory: Directory.Data,
                encoding: 'utf8'
            });

            // Parse and return the saved JSON
            const data = JSON.parse(result.data);

            if(mainData.value === undefined)
            {
                mainData.value = data;
            }
            else
            {
                const { colorData, headerData, logoData } = data;
                mainData.value.colorData = colorData;
                mainData.value.headerData = headerData;
                mainData.value.logoData = logoData;
            }

        } catch (e){
            // If not found, write the default JSON to the writable directory
            await Filesystem.writeFile({
                path: 'designData.json',
                data: JSON.stringify(designData, null, 4), // 4-space indent
                directory: Directory.Data,
                encoding: 'utf8'
            });

            // Return the default JSON
            console.log('Design data written to filesystem:', designData, e);
            mainData.value = JSON.parse(JSON.stringify(designData));
        }
    }

    const loadSetupImages = async () => {
        // LOAD HEADER IMGS
        await loadSetupImageHelper('header', booth.baseHeaderDir);
        // LOAD LOGO IMGS
        await loadSetupImageHelper('logo', booth.baseLogoDir);

        console.log('updated mainData after loading images', mainData.value);
    }

    const loadSetupImageHelper = async (key, directory) => {
        const data = mainData.value[`${key}Data`];

        for (let index = 0; index < data.length; index++) {
            const imgName = data[index];
            const url = `${directory}${imgName}`;

            let img;
            try{
                img = await booth.loadImgData(url);
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
            mainData.value[`${key}Images`][index] = img;
        }
    }

    const verifyColor = (index) => {
        // if(!index) return 'no-data';
        const { colorData } = mainData.value;
        if(colorData.length === 0) return;

        const hasData = colorData[index].header !== null && colorData[index].logo !== null;
        console.log('hasData', hasData, index);
        return hasData ? '' : 'no-data';
    }

    const addColor = async (newColor) => {
        const newColorData = {
            hex: newColor,
            header: null,
            logo: null,
        }
        mainData.value.colorData.push(newColorData);
        await saveJson();
    }

    const deleteColor = async () => {
        if(booth.selectedColorIndex === null) return;
        mainData.value.colorData.splice(booth.selectedColorIndex, 1);

        await saveJson();
        booth.setColor(null);
    }

    const saveColorSettings = async () => {
        if(verifyColor(booth.selectedColorIndex) === '') return;

        const newColorData = {
            color: booth.selectedColorIndex,
            header: booth.selectedHeaderIndex,
            logo: booth.selectedLogoIndex,
        };
        const colorData = mainData.value.colorData[booth.selectedColorIndex];
        colorData.header = newColorData.header;;
        colorData.logo = newColorData.logo;
        
        await saveJson();
    }

    const onFileChange = (event, key) => {
        uploadData.value[key] = event.target.files;
    }

    // Reads file and returns base64
    const readFileAsBase64 = async (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(",")[1]);
            reader.readAsDataURL(file);
        });
    }

    const uploadImages = async (key) => {
        await writeImageFiles(key);
        await loadSetupImages();
    }

    const writeImageFiles = async (key) => {
        for (const file of uploadData.value[key]) {
            const base64 = await readFileAsBase64(file);

            // Save the file into app storage
            await Filesystem.writeFile({
                path: `${key}/${file.name}`,
                data: base64,
                directory: Directory.Data,
                recursive: true
            });

            mainData.value[key].push(file.name);
        }
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
        return booth.loadImgData(imgSrc);
    }

    const saveJson = async () => {
        await Filesystem.writeFile({
            path: 'designData.json',
            data: JSON.stringify(mainData.value, null, 4),
            directory: Directory.Data, // or Directory.Data
            encoding: Encoding.UTF8,
        });
        await loadDesignData();
        console.log("SAVE", mainData.value);
    }

    const deleteDesignJson = async () => {
        try {
            await Filesystem.deleteFile({
                path: 'designData.json',
                directory: Directory.Data
            });

            console.log('designData.json deleted');
        } catch (err) {
            console.error('Delete failed:', err);
        }
    }

    const resetSetup = async () => {
        booth.setColor(null);
        await deleteDesignJson();
        await loadDesignData();
        await loadSetupImages();
    }

    return {
        responsiveWidth,
        responsiveHeight,
        getFrameConfig,
        frameData,
        loadedImages,
        getImageConfig,
        layerRef,
        getLogoConfig,
        getHeaderConfig,
        addColor,
        mainData,
        verifyColor,
        loadDesignData,
        loadSetupImages,
        saveColorSettings,
        deleteColor,
        uploadImages,
        onFileChange,
        resetSetup
    }
}