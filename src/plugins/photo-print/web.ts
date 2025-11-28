export class PhotoPrintWeb {
    async print() {
        console.warn("Silent printing not available on web.");
        return { success: false };
    }
}