const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { pipeline } = require('node:stream/promises');
const { error } = require('node:console');
const axios = require('axios');

const app = express();
app.use(cors());

const CACHE_DIR = path.join(__dirname, 'cache', 'renders');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// 1. Load your credentials
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'ssl', 'voidspark.org.key')), // or .key
    cert: fs.readFileSync(path.join(__dirname, 'ssl', 'voidspark.org.pem'))
};

const BG_DIR = path.join(__dirname, 'backgrounds');
app.use('/images', express.static(BG_DIR));

app.get('/random', (req, res) => {
    fs.readdir(BG_DIR, (err, files) => {
        if (err || !files.length) return res.status(500).json({ error: "No images found" });
        const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
        const images = files.filter(f => validExtensions.includes(path.extname(f).toLowerCase()));
        const randomImage = images[Math.floor(Math.random() * images.length)];
        res.json({
            url: `https://api.voidspark.org:2053/images/${randomImage}`,
            name: randomImage
        });
    });
});

const pendingRequests = new Map();

app.get ('/render/ship/:typeId', async (req, res) => {
    const { typeId } = req.params;
    const localPath = path.join(CACHE_DIR, `${typeId}.png`);

    if (fs.existsSync(localPath)) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable'); 
        return res.sendFile(localPath);
    }

    if (pendingRequests.has(typeId)) {
        await pendingRequests.get(typeId);
        return res.sendFile(localPath);
    }

    const fetchPromise = (async () => {
        try {
            const ccpUrl = `https://images.evetech.net/types/${typeId}/render?size=64`;
            const response = await axios ({ url: ccpUrl, responseType: 'stream' });

            if (response.status !== 200) throw new error ('CCP Server Error');

            await pipeline(response.data, fs.createWriteStream(localPath));

        } catch (err) {
            console.Error (`Failed to fetch ship ${typeId}`);
            throw err
        } finally {
            pendingRequests.delete(typeId);
        }
    })();

    pendingRequests.set(typeId, fetchPromise);

    try {
        await fetchPromise;
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        res.sendFile(localPath);
    } catch (err) {
        res.set('Cache-Control', 'no-store'); // Don't cache failures
        res.status(404).json({ error: "Ship render unavailable" });
    }
});
// 2. Start the HTTPS server
https.createServer(sslOptions, app).listen(2053, '0.0.0.0', () => {
    console.log("🔒 Nebula Provider Online via HTTPS on Port 2053");
});