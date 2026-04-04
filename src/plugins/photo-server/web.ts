export class PhotoServerWeb {
    async startServer() {
        console.warn('PhotoServer.startServer not available on web');
        return { started: false, url: null, ip: '127.0.0.1', port: 8080 };
    }
    async stopServer() {
        console.warn('PhotoServer.stopServer not available on web');
        return { stopped: true };
    }
    async savePhoto() {
        console.warn('PhotoServer.savePhoto not available on web');
        return { downloadUrl: null, filename: null };
    }
    async getServerInfo() {
        console.warn('PhotoServer.getServerInfo not available on web');
        return { running: false, ip: '127.0.0.1', port: 8080, url: null };
    }
}
