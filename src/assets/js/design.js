import { ref, onMounted } from 'vue';
import { frames } from '../../data/frameData.json';
import { frameDesigns } from '../../data/frameDesigns.json';
import { usePhotoboothStore } from './data';
import { Filesystem, Directory } from '@capacitor/filesystem';

// Get configuration for the base
export default function useDesign() {
    const booth = usePhotoboothStore();
    const baseWidth = ref(500);
    const baseHeight = ref(750);
    const minHeight = 1100;
    const responsiveWidth = ref(baseWidth.value);
    const responsiveHeight = ref(baseHeight.value);
    const diff = ref(0);
    const selectedFrameId = booth.selectedTemplate?.id ?? 0;
    const {frameData, variation, baseData} = frames[selectedFrameId];
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
        baseWidth.value = baseData.width;
        baseHeight.value = baseData.height;
        responsiveWidth.value = baseWidth.value-(baseWidth.value*diff.value);
        responsiveHeight.value = baseHeight.value-(baseHeight.value*diff.value);

        console.log(diff.value,window.innerHeight,baseWidth.value-(baseWidth.value*diff.value))
    }

    // Get configuration for the frame
    const getFrameConfig = (multiples = 0) => {
        const resWidth = frameData.width-(frameData.width*diff.value);
        const resHeight = frameData.height-(frameData.height*diff.value);
        const scaleFactorWidth = resWidth / frameData.width;
        const frameStrokeWidth = frameData.strokeSize;
        const x = (frameStrokeWidth / 2) + (resWidth * multiples);
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
    const testImages = ref([
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
    ])

    // Define image data
    const images = ref(booth.uploadedImages.length > 0 ? booth.uploadedImages : testImages );

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
    });

    const getHeaderConfig = (multiples = 0) => {
        const selectedHeader = frameDesigns[booth.selectedDesign].header;
        if(!booth.headerImgs[selectedHeader]) return;
        return getImageRectConfig(variation[booth.selectedVariation].headerData, diff.value, booth.headerImgs[selectedHeader], multiples)
    }

    const getLogoConfig = (multiples = 0) => {
        const selectedLogo = frameDesigns[booth.selectedDesign].logo;
        if(!booth.logoImgs[selectedLogo]) return;
        return getImageRectConfig(variation[booth.selectedVariation].logoData, diff.value, booth.logoImgs[selectedLogo], multiples)
    };

    // Get configuration for each image
    const getImageConfig = (index, multiples = 0, tmp) => {
        const newIndex = Number(index)+tmp;
        if(!variation[booth.selectedVariation].imagesData[index] || !loadedImages.value[newIndex]) return;

        const imgRectData = getImageRectConfig(variation[booth.selectedVariation].imagesData[index], diff.value, loadedImages.value[newIndex], multiples)

        return {
            ...imgRectData,
            cornerRadius: 1
        };
    };

    const getImageRectConfig = (imgFrameData, scale, imgData, multiples) => {
        const resWidth = imgFrameData.width-(imgFrameData.width*scale);
        const resHeight = imgFrameData.height-(imgFrameData.height*scale);
        const resX = imgFrameData.x-(imgFrameData.x*scale);
        const resY = imgFrameData.y-(imgFrameData.y*scale);

        const scaleFactorWidth = resWidth / imgData.width;
        const scaledImageHeight =  (scaleFactorWidth * imgData.height) ;
        const scaledImageWidth =  (scaleFactorWidth * imgData.width) ;
        const verticalOffset = (scaledImageHeight - resHeight) / 2;
        const horizontalOffset = (scaledImageWidth - resWidth) / 2;
        const imageOffsetX = getFrameConfig(multiples).x + resX;
        const imageOffsetY = getFrameConfig(multiples).y + resY;
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

    const handlePrint = async () => {
        const dataURL = layerRef.value.getNode().toDataURL({ pixelRatio: 8 });

        if (Capacitor.getPlatform() === 'web') {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Print</title>
                    <style>
                    @page {
                        size: 4in 6in; /* 4R photo size */
                        margin: 0; /* No margins */
                    }

                    body, html {
                        margin: 0;
                        padding: 0;
                        width: 4in;
                        height: 6in;
                    }

                    img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover; /* Crop/fill the space like a photo */
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
        }
        else {
            const base64Data = dataURL.split(',')[1];

            await Filesystem.writeFile({
                path: `konva_${Date.now()}.png`,
                data: base64Data,
                directory: Directory.Documents, // or Directory.External on Android
            });

            console.log("Saved successfully!");
        }
    };

    return {
        responsiveWidth,
        responsiveHeight,
        getFrameConfig,
        frameData,
        loadedImages,
        getImageConfig,
        handlePrint,
        layerRef,
        selectDesign,
        selectVariation,
        getLogoConfig,
        getHeaderConfig,
        variation
    }
}