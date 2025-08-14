import { ref, onMounted } from 'vue';
import {frameData1,frameData2,frameData3,frameData4} from '../../data/frameData.json';
import { frameDesigns } from '../../data/frameDesigns.json';
import { usePhotoboothStore } from './data';

// Get configuration for the base
export default function useDesign() {
    const baseWidth = 550;
    const baseHeight = 600;
    const responsiveWidth = ref(baseWidth);
    const responsiveHeight = ref(baseHeight);
    const diff = ref(0);

    onMounted(() => {
        updateSizing();
        window.addEventListener("resize", updateSizing);
    })

    const booth = usePhotoboothStore();
    const getSelectedFrame = (id) => {
        switch(id)
        {
            case 1:
                return frameData1;
            case 2:
                return frameData2;
            case 3:
                return frameData3;
            case 4:
                return frameData4;
        } 
    }

    const selectDesign = (designId) => {
        booth.setDesign(designId);
    }

    const selectedFrameId = booth.selectedFrame?.id ?? 1;
    const {frameData, imagesData} = getSelectedFrame(selectedFrameId);

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
    ])

    // Define image data
    const images = ref(booth.uploadedImages.length > 0 ? booth.uploadedImages : testImages );

    // Load images
    onMounted(() => {
        images.value.forEach((img, index) => {
            const imageObj = new Image();
            imageObj.onload = () => {
            loadedImages.value = {
                ...loadedImages.value,
                [index]: imageObj
            };
            };
            imageObj.src = img.src;
        });
    });

    // Get configuration for each image
    const getImageConfig = (img, index) => {
        if(!imagesData[index]) return;
        const resWidth = imagesData[index].width-(imagesData[index].width*diff.value);
        const resHeight = imagesData[index].height-(imagesData[index].height*diff.value);
        const resX = imagesData[index].x-(imagesData[index].x*diff.value);
        const resY = imagesData[index].y-(imagesData[index].y*diff.value);

        const scaleFactorWidth = resWidth / img.width;
        const scaledImageHeight =  (scaleFactorWidth * img.height) ;
        const verticalOffset = (scaledImageHeight - resHeight) / 2;
        const imageOffsetX = getFrameConfig().x + resX;
        const imageOffsetY = getFrameConfig().y + resY;
        
        const finalOffset = (verticalOffset/scaledImageHeight * img.height);
        return {
            fillPatternImage: loadedImages.value[index],
            fillPatternScale: { x: scaleFactorWidth, y: scaleFactorWidth},
            fillPatternOffset: { x: 0, y: finalOffset},
            x: imageOffsetX,
            y: imageOffsetY,
            width: resWidth,
            height: resHeight,
            stroke: 'black',
            strokeWidth: 1.25,
            strokeEnabled: true,
            cornerRadius: 3
        };
    };

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
        images,
        getImageConfig,
        handlePrint,
        layerRef,
        frameDesigns,
        selectDesign
    }
}