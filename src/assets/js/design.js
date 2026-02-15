import { ref, onMounted } from 'vue';
import { frames } from '../../data/frameData.json';
import { usePhotoboothStore } from './data';
import { Filesystem, Directory } from '@capacitor/filesystem';
import designData from '../../data/designData.json';
import { useRouter } from 'vue-router';

// Get configuration for the base
export default function useDesign() {
    const router = useRouter()
    const mainData = ref();
    const booth = usePhotoboothStore();
    const isPrintPressed = ref(false);
    const baseWidth = ref(500);
    const baseHeight = ref(750);
    const minHeight = 1100;
    const responsiveWidth = ref(baseWidth.value);
    const responsiveHeight = ref(baseHeight.value);
    const diff = ref(0);
    const selectedFrameId = booth.selectedTemplate?.id ?? 2;
    const { frameData, variation, baseData } = frames[selectedFrameId];

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
        const color = booth.selectedDesign !== null ? mainData.value.colorData[booth.selectedDesign].hex : '#ffffff';

        return {
            x: x,
            y: y,
            width: width,
            height: height,
            // fillPatternImage: frameDesigns[booth.selectedDesign] ?? null, //DEPRECATED
            fill: color,
            fillPatternScale: {x: scaleFactorWidth, y: scaleFactorWidth}, //DEPRECATED
            stroke: 'black',
            strokeWidth: frameStrokeWidth,
            cornerRadius: 0
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

    function darkenHex(hex, factor) {
        const num = parseInt(hex.slice(1), 16);
        const r = Math.max(0, ((num >> 16) & 255) * (1 - factor));
        const g = Math.max(0, ((num >> 8) & 255) * (1 - factor));
        const b = Math.max(0, (num & 255) * (1 - factor));
        return (
            "#" +
            [r, g, b]
            .map(x => Math.round(x).toString(16).padStart(2, "0"))
            .join("")
        );
    }

    const getHeaderConfig = (multiples = 0) => {
        if(booth.selectedDesign === null) return;
        const { headerImages } = mainData.value;
        const { header } = mainData.value.colorData[booth.selectedDesign];

        if(!headerImages[header]) return;
        return getImageRectConfig(variation[booth.selectedVariation].headerData, diff.value, headerImages[header], multiples)
    }

    const getFooterConfig = (multiples = 0) => {
        if(booth.selectedDesign === null) return;
        const { footerImages } = mainData.value;
        const { footer } = mainData.value.colorData[booth.selectedDesign];

        if(!footerImages[footer]) return;
        return getImageRectConfig(variation[booth.selectedVariation].footerData, diff.value, footerImages[footer], multiples)
    };

    // Get configuration for each image
    const getImageConfig = (index, multiples = 0, tmp) => {
        const newIndex = Number(index)+tmp;
        if(!variation[booth.selectedVariation].imagesData[index] || !loadedImages.value[newIndex]) return;

        const imgRectData = getImageRectConfig(variation[booth.selectedVariation].imagesData[index], diff.value, loadedImages.value[newIndex], multiples)
        const color = booth.selectedDesign !== null ? mainData.value.colorData[booth.selectedDesign].hex : '#ffffff';

        return {
            ...imgRectData,
            cornerRadius: 1,
            stroke: darkenHex(color, 0.5) ?? null,
            strokeWidth: 2,
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
        isPrintPressed.value = true;
        let dataURL = '';
        console.log('Frame Data:', frameData);
        if(frameData.rotate && Capacitor.getPlatform() === 'web')
        {
            const node = layerRef.value.getNode();
            const oldCanvas = node.toCanvas({ pixelRatio: 8, quality: 2 });
            const rotatedCanvas = document.createElement('canvas');

            // Swap width/height if rotating 90 or 270 degrees
            rotatedCanvas.width = oldCanvas.height;
            rotatedCanvas.height = oldCanvas.width;

            const ctx = rotatedCanvas.getContext('2d');

            // Move origin to center, rotate, then draw the image
            ctx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
            ctx.rotate(90 * Math.PI / 180); // 90° clockwise
            ctx.drawImage(oldCanvas, -oldCanvas.width / 2, -oldCanvas.height / 2);

            dataURL = rotatedCanvas.toDataURL('image/png');
        }
        else 
        {
            dataURL = layerRef.value.getNode().toDataURL({ pixelRatio: 8, quality: 2 });
        }
        
        if (Capacitor.getPlatform() === 'web') {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Print</title>
                    <style>
                    @page {
                        size: 6in 4in; /* 4R photo size */
                        margin: 0; /* No margins */
                    }

                    body, html {
                        margin: 0;
                        padding: 0;
                        width: 6in;
                        height: 4in;
                        background: black; /* helps hide margins if printer can’t do borderless */
                    }

                    img {
                        width: 97.5%;
                        height: 97%;
                        margin-top: 1.3%;
                        margin-left: .5%;
                        object-fit: contain; /* Fit whole image — no cropping */
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
            const base64 = dataURL.replace("data:image/png;base64,", "");

            // Save internally
            await Filesystem.writeFile({
                path: `konva_${Date.now()}.png`,
                data: base64,
                directory: Directory.Documents,
            });

            try {
                const result = await sendToPrintServer(base64);
                console.log("Printed!", result);
            } catch (err) {
                console.log("PRINT FAILED", err);
            }
            
            console.log("Saved & Printed successfully!");
            router.push("/");
        }
    };

    const sendToPrintServer = async (base64) => {
        try {
            const res = await fetch(`http://${booth.networkData.ipAddress}:3000/print`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ img: base64, orientation: frameData.rotate ? 'portrait' : 'landscape' }),
            });

            const json = await res.json();
            console.log("PRINT RESPONSE:", json);
        } catch (err) {
            console.error("PRINT ERROR:", err);
        }
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
                mainData.value.colorData = data.colorData.filter(data => data.header !== null && data.footer !== null);
            }
            else
            {
                const { colorData, headerData, footerData } = data;
                console.log('Loaded design data from filesystem:', data);
                mainData.value.colorData = colorData.filter(data => data.header !== null && data.footer !== null);
                mainData.value.headerData = headerData;
                mainData.value.footerData = footerData;
            }

        } catch {
            // If not found, write the default JSON to the writable directory
            await Filesystem.writeFile({
                path: 'designData.json',
                data: JSON.stringify(designData, null, 4), // 4-space indent
                directory: Directory.Data,
                encoding: 'utf8'
            });

            // Return the default JSON
            console.log('Design data written to filesystem:', designData);
            mainData.value = JSON.parse(JSON.stringify(designData));
            mainData.value.colorData = JSON.parse(JSON.stringify(designData)).colorData.filter(data => data.header !== null && data.footer !== null);
        }
    }

    const loadSetupImages = async () => {
        // LOAD HEADER IMGS
        await loadSetupImageHelper('header', booth.baseHeaderDir);
        // LOAD FOOTER IMGS
        await loadSetupImageHelper('footer', booth.baseFooterDir);

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
                console.error(`Error loading ${key} image:`, e);

                try {
                    img = await loadImage(`${key}Data/${imgName}`);
                    console.log('loaded image', img);
                }
                catch(err){
                    console.error(`Error loading ${key} image from filesystem:`, err);
                    img = null;
                }
            }
            mainData.value[`${key}Images`][index] = img;
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

    const verifyColor = (index) => {
        // if(!index) return 'no-data';
        const { colorData } = mainData.value;
        if(colorData.length === 0) return;

        const hasData = colorData[index].header !== null && colorData[index].footer !== null;
        console.log('hasData', hasData, index);
        return hasData ? '' : 'no-data';
    }

    return {
        responsiveWidth,
        responsiveHeight,
        getFrameConfig,
        frameData,
        getImageConfig,
        handlePrint,
        layerRef,
        getFooterConfig,
        getHeaderConfig,
        variation,
        mainData,
        loadDesignData,
        loadSetupImages,
        verifyColor,
        isPrintPressed
    }
}