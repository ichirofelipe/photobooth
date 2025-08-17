import { ref, onMounted } from 'vue';
import { frames } from '../../data/frameData.json';
import { frameDesigns } from '../../data/frameDesigns.json';
import { usePhotoboothStore } from './data';

// Get configuration for the base
export default function useDesign() {
    const booth = usePhotoboothStore();
    const baseWidth = 550;
    const baseHeight = 600;
    const responsiveWidth = ref(baseWidth);
    const responsiveHeight = ref(baseHeight);
    const diff = ref(0);
    const selectedFrameId = booth.selectedTemplate?.id ?? 1;
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
        const minHeight = 900;
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
            fillPatternImage: booth.designs[booth.selectedDesign],
            fillPatternScale: {x: scaleFactorWidth, y: scaleFactorWidth},
            stroke: 'black',
            strokeWidth: frameStrokeWidth,
            cornerRadius: 3
        };
    }

    const layerRef = ref(null);
    const loadedImages = ref({});
    
    //test values
    const testImages = ref([
        {
            src: '/images/captures/cat_image.avif',
            width: 1200,
            height: 1197,
        },
        {
            src: '/images/captures/cat_image.avif',
            width: 1200,
            height: 1197,
        },
        {
            src: '/images/captures/cat_image.avif',
            width: 1200,
            height: 1197,
        },
        {
            src: '/images/captures/cat_image.avif',
            width: 1200,
            height: 1197,
        },
    ])

    // Define image data
    const images = ref(booth.uploadedImages.length > 0 ? booth.uploadedImages : testImages );
    const logo = ref(null);

    // Load images
    onMounted(() => {
        images.value.forEach((img, index) => {
            booth.loadImgData(img.src).then((imgData) => {
                loadedImages.value = {
                    ...loadedImages.value,
                    [index]: imgData
                };
            });
        });
        booth.loadImgData('/images/logo-white.png').then((img) => {
            logo.value = img;
        });
    });

    const getLogoConfig = () => {
        if(!logo.value) return;
        return getImageRectConfig(variation[booth.selectedVariation].logoData, diff.value, logo.value)
    };

    // Get configuration for each image
    const getImageConfig = (img, index) => {
        if(!variation[booth.selectedVariation].imagesData[index]) return;
        const imgRectData = getImageRectConfig(variation[booth.selectedVariation].imagesData[index], diff.value, img)

        return {
            ...imgRectData,
            stroke: 'black',
            strokeWidth: 1.25,
            strokeEnabled: true,
            cornerRadius: 3
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

    const handlePrint = () => {
        const dataURL = layerRef.value.getNode().toDataURL({ pixelRatio: 2 });

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Print</title>
                <style>
                body, html {
                    margin: 0;
                    padding: 0;
                    height: 100%;
                }
                img {
                    width: 100%;
                    height: auto;
                    display: block;
                }
                </style>
            </head>
            <body onload="window.print(); window.close();">
                <img src="${dataURL}" />
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    return {
        responsiveWidth,
        responsiveHeight,
        getFrameConfig,
        frameData,
        logo,
        loadedImages,
        getImageConfig,
        handlePrint,
        layerRef,
        frameDesigns,
        selectDesign,
        selectVariation,
        getLogoConfig,
        variation
    }
}