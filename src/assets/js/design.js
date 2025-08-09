import { ref, onMounted } from 'vue';
import {frameData1,frameData2,frameData3,frameData4} from '../../data/frameData.json';
import { frameDesigns } from '../../data/frameDesigns.json';
import { usePhotoboothStore } from './data';

// Get configuration for the base
export default function useDesign() {
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

    const getStageConfig = () => {
        return {
            width: 550,
            height: 600,
        };
    }
    const getBaseConfig = () => {
        return {
            width: 550,
            height: 600,
            fill: 'white',
        };
    }

    // Get configuration for the frame
    const getFrameConfig = () => {
        const frameStrokeWidth = frameData.strokeSize;
        const x = ((getBaseConfig().width - frameData.width) / 2) + (frameStrokeWidth / 2);
        const y = ((getBaseConfig().height - frameData.height) / 2) + (frameStrokeWidth / 2);
        const width = frameData.width - frameStrokeWidth;
        const height = frameData.height - frameStrokeWidth;
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
        const scaleFactorWidth = imagesData[index].width / img.width;
        const scaledImageHeight =  (scaleFactorWidth * img.height) ;
        const verticalOffset = (scaledImageHeight - imagesData[index].height) / 2;
        const imageOffsetX = getFrameConfig().x + imagesData[index].x;
        const imageOffsetY = getFrameConfig().y + imagesData[index].y;
        
        const finalOffset = (verticalOffset/scaledImageHeight * img.height);
        return {
            fillPatternImage: loadedImages.value[index],
            fillPatternScale: { x: scaleFactorWidth, y: scaleFactorWidth},
            fillPatternOffset: { x: 0, y: finalOffset},
            x: imageOffsetX,
            y: imageOffsetY,
            width: imagesData[index].width,
            height: imagesData[index].height,
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
        getStageConfig,
        getBaseConfig,
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