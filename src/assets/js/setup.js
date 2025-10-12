import { ref, onMounted } from 'vue';
import { frames } from '../../data/frameData.json';
import { frameDesigns } from '../../data/frameDesigns.json';
import { usePhotoboothStore } from './data';
import { Filesystem, Directory } from '@capacitor/filesystem';

// Get configuration for the base
export default function useSetup() {
    const booth = usePhotoboothStore();
    const baseWidth = 600;
    const baseHeight = 900;
    const minHeight = 1100;
    const responsiveWidth = ref(baseWidth);
    const responsiveHeight = ref(baseHeight);
    const diff = ref(0);
    const selectedFrameId = booth.selectedTemplate?.id ?? 2;
    const {frameData, variation} = frames[selectedFrameId];
    const selectDesign = (designId) => {
        booth.setDesign(designId);
    }
    const selectVariation = (variationId) => {
        booth.setVariation(variationId);
    }

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
        return {
            x: x,
            y: y,
            width: width,
            height: height,
            // fillPatternImage: frameDesigns[booth.selectedDesign] ?? null, //DEPRECATED
            fill: frameDesigns[booth.selectedDesign]?.hex ?? null,
            fillPatternScale: {x: scaleFactorWidth, y: scaleFactorWidth}, //DEPRECATED
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
        const selectedHeader = frameDesigns[booth.selectedDesign].header;
        if(!booth.headerImgs[selectedHeader]) return;
        return getImageRectConfig(variation[booth.selectedVariation].headerData, diff.value, booth.headerImgs[selectedHeader])
    }

    const getLogoConfig = () => {
        const selectedLogo = frameDesigns[booth.selectedDesign].logo;
        if(!booth.logoImgs[selectedLogo]) return;
        return getImageRectConfig(variation[booth.selectedVariation].logoData, diff.value, booth.logoImgs[selectedLogo])
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

    return {
        responsiveWidth,
        responsiveHeight,
        getFrameConfig,
        frameData,
        loadedImages,
        getImageConfig,
        layerRef,
        selectDesign,
        selectVariation,
        getLogoConfig,
        getHeaderConfig,
        variation,
        frames
    }
}