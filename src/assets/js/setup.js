import { ref, onMounted } from 'vue';
import { usePhotoboothStore } from './data';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import designData from '../../data/designData.json';

// Get configuration for the base
export default function useSetup() {
    const booth = usePhotoboothStore();
    const minHeight = 1100;
    const responsiveWidth = ref(booth.currentTemplate.baseData.width);
    const responsiveHeight = ref(booth.currentTemplate.baseData.height);
    const diff = ref(0);
    const uploadData = ref({
        headerData: [],
        footerData: [],
        homeLogoData: null
    });

    onMounted(() => {
        updateSizing();
        window.addEventListener("resize", updateSizing);
    })

    const updateSizing = () => {
        const tmpDiff = (minHeight-window.innerHeight)/minHeight;
        diff.value = tmpDiff >= 0 ? tmpDiff : 0;
        responsiveWidth.value = booth.currentTemplate.baseData.width-(booth.currentTemplate.baseData.width*diff.value);
        responsiveHeight.value = booth.currentTemplate.baseData.height-(booth.currentTemplate.baseData.height*diff.value);

        console.log(diff.value,window.innerHeight,booth.currentTemplate.baseData.width-(booth.currentTemplate.baseData.width*diff.value))
    }

    // Get configuration for the frame
    const getFrameConfig = () => {
        updateSizing();
        console.log('getting frame config', booth.currentTemplate.frameData, diff.value);
        const resWidth = booth.currentTemplate.frameData.width-(booth.currentTemplate.frameData.width*diff.value);
        const resHeight = booth.currentTemplate.frameData.height-(booth.currentTemplate.frameData.height*diff.value);

        const scaleFactorWidth = resWidth / booth.currentTemplate.frameData.width;
        const frameStrokeWidth = booth.currentTemplate.frameData.strokeSize;
        const x = ((responsiveWidth.value - (resWidth)) / 2) + (frameStrokeWidth / 2);
        const y = ((responsiveHeight.value - resHeight) / 2) + (frameStrokeWidth / 2);
        const width = resWidth - frameStrokeWidth;
        const height = resHeight - frameStrokeWidth;
        const color = booth.selectedColorIndex !== null ? booth.mainData.colorData[booth.selectedColorIndex]?.hex : '#ffffff';

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

    const getHeaderConfig = () => {
        console.log('getting header config');
        if(booth.selectedColorIndex === null) return;
        const { headerImages } = booth.mainData;
        const data = booth.mainData.colorData[booth.selectedColorIndex];

        let headerIndex = booth.selectedHeaderIndex;
        if(data?.header === null)
        {
            if(headerIndex === null) return;
        }
        else
        {
            headerIndex = data?.header ?? null;
        }

        if(!headerImages[headerIndex]) return;
        console.log('header data', booth.currentTemplate.variation[booth.selectedVariation].headerData, diff.value, headerImages[headerIndex]);
        return getImageRectConfig(booth.currentTemplate.variation[booth.selectedVariation].headerData, diff.value, headerImages[headerIndex])
    }

    const getFooterConfig = () => {
        console.log('getting footer config');
        if(booth.selectedColorIndex === null) return;
        const { footerImages } = booth.mainData;
        const data = booth.mainData.colorData[booth.selectedColorIndex];

        let footerIndex = booth.selectedFooterIndex;
        if(data?.footer === null)
        {
            if(footerIndex === null) return;
        }
        else
        {
            footerIndex = data?.footer ?? null;
        }

        if(!footerImages[footerIndex]) return;
        console.log('footer data', booth.currentTemplate.variation[booth.selectedVariation].footerData, diff.value, footerImages[footerIndex]);
        return getImageRectConfig(booth.currentTemplate.variation[booth.selectedVariation].footerData, diff.value, footerImages[footerIndex])
    };

    // Get configuration for each image
    const getImageConfig = (imgData, index) => {
        if(!booth.currentTemplate.variation[booth.selectedVariation].imagesData[index]) return;
        console.log('getting image config for index', index, booth.loadedTestImages, booth.loadedTestImages[index]);
        const imgRectData = getImageRectConfig(booth.currentTemplate.variation[booth.selectedVariation].imagesData[index], diff.value, imgData);

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

    const verifyColor = (index) => {
        // if(!index) return 'no-data';
        const { colorData } = booth.mainData;
        if(!colorData) return;

        const hasData = colorData[index]?.header !== null && colorData[index]?.footer !== null;
        console.log('hasData', hasData, index);
        return hasData ? '' : 'no-data';
    }

    const addColor = async (newColor) => {
        const newColorData = {
            hex: newColor,
            header: null,
            footer: null,
        }
        booth.mainData.colorData.push(newColorData);
        await booth.saveJson("designData.json", JSON.stringify(booth.mainData, null, 4));
    }

    const deleteColor = async () => {
        if(booth.selectedColorIndex === null) return;
        booth.mainData.colorData.splice(booth.selectedColorIndex, 1);

        await booth.saveJson("designData.json", JSON.stringify(booth.mainData, null, 4));
        booth.setColor(null);
    }

    const saveColorSettings = async () => {
        if(verifyColor(booth.selectedColorIndex) === '') return;

        const newColorData = {
            color: booth.selectedColorIndex,
            header: booth.selectedHeaderIndex,
            footer: booth.selectedFooterIndex,
        };
        const colorData = booth.mainData.colorData[booth.selectedColorIndex];
        colorData.header = newColorData.header;
        colorData.footer = newColorData.footer;
        
        await booth.saveJson("designData.json", JSON.stringify(booth.mainData, null, 4));
    }

    const onFileChange = (event, key) => {
        uploadData.value[`${key}Data`] = event.target.files;
        console.log('Selected files for', key, uploadData.value[`${key}Data`]);
    }

    // Reads file and returns base64
    const readFileAsBase64 = async (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(",")[1]);
            reader.readAsDataURL(file);
        });
    }

    const uploadImages = async (key, isArray = true) => {
        if(isArray)
        {
            await writeMultiImageFiles(key);
        }
        else
        {
            await writeSingleImageFile(key);
        }
        console.log("check main before saving", booth.mainData)
        await booth.saveJson("designData.json", JSON.stringify(booth.mainData, null, 4));
        await booth.reloadMainData();
    }

    const writeSingleImageFile = async (key) => {
        booth.mainData[`${key}Image`] = await writeImgFile(key, uploadData.value[`${key}Data`][0]);
        booth.mainData[`${key}Data`] = uploadData.value[`${key}Data`][0].name;
    }

    const writeMultiImageFiles = async (key) => {
        for (const file of uploadData.value[`${key}Data`]) {
            booth.mainData[`${key}Image`] = await writeImgFile(key, file);
            booth.mainData[`${key}Data`].push(file.name);
        }
    }

    const writeImgFile = async (key, file) => {
        console.log('Uploading file for', key, file);
        const base64 = await readFileAsBase64(file);
        // Save the file into app storage
        await Filesystem.writeFile({
            path: `${key}Data/${file.name}`,
            data: base64,
            directory: Directory.Data,
            recursive: true
        });

        return base64;
        // await booth.saveJson(`${key}/${file.name}`, base64);
    }

    const onInputSetupText = (index, e) => {
        booth.networkData[index] = e.target.value;
        booth.saveJson("networkData.json", JSON.stringify(booth.networkData, null, 4));
    }

    const resetSetup = async () => {
        booth.setColor(null);
        await booth.deleteDesignJson();
        await booth.reloadMainData();
    }

    return {
        responsiveWidth,
        responsiveHeight,
        getFrameConfig,
        getImageConfig,
        layerRef,
        getFooterConfig,
        getHeaderConfig,
        addColor,
        verifyColor,
        saveColorSettings,
        deleteColor,
        uploadImages,
        onFileChange,
        resetSetup,
        onInputSetupText
    }
}