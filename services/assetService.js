const { pipeline } = require('node:stream/promises');
const fs = require('fs');
const axios = require('axios');

const pendingRequests = new Map();

async function getAsset(id, localPath, remoteUrl) {
    if (fs.existsSync(localPath)) return true;
    if (pendingRequests.has(id)) {
        await pendingRequests.get(id);
        return true;
    }

    const fetchPromise = (async () => {
        try {
            const response = await axios({ url: remoteUrl, responseType: 'stream' });
            if (response.status !== 200) throw new Error('ESI Source Error');
            await pipeline(response.data, fs.createWriteStream(localPath));
        } finally {
            pendingRequests.delete(id);
        }
    })();

    pendingRequests.set(id, fetchPromise);
    return fetchPromise;
}

module.exports = { getAsset };