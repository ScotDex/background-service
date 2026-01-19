const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { pipeline } = require('node:stream/promises');
const axios = require('axios'); // Ensure this is installed: npm install axios

const app = express();
app.use(cors());

// --- Persistence Layer ---
const CACHE_DIR = path.join(__dirname, 'cache', 'renders');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
if (!fs.existsSync(CORP_DIR)) fs.mkdirSync(CORP_DIR, { recursive: true });

// --- SSL Config ---
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'ssl', 'voidspark.org.key')),
    cert: fs.readFileSync(path.join(__dirname, 'ssl', 'voidspark.org.pem'))
};

// --- Static Assets ---
const BG_DIR = path.join(__dirname, 'backgrounds');
app.use('/images', express.static(BG_DIR));

// --- Ship Render Proxy (LCP Fix) ---
const pendingRequests = new Map();

app.get('/render/ship/:typeId', async (req, res) => {
    const { typeId } = req.params;
    const localPath = path.join(CACHE_DIR, `${typeId}.png`);

    // 1. Serve from SSD if available
    if (fs.existsSync(localPath)) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable'); 
        return res.sendFile(localPath);
    }

    // 2. Coalesce Requests (Thundering Herd Protection)
    if (pendingRequests.has(typeId)) {
        await pendingRequests.get(typeId);
        return res.sendFile(localPath);
    }

    // 3. The Fetch Logic
    const fetchPromise = (async () => {
        try {
            const ccpUrl = `https://images.evetech.net/types/${typeId}/render?size=64`;
            const response = await axios({ url: ccpUrl, responseType: 'stream' });

            if (response.status !== 200) throw new Error('CCP Server Error');

            // Save to disk
            await pipeline(response.data, fs.createWriteStream(localPath));
        } catch (err) {
            console.error(`[PROXY ERROR] Ship ${typeId}: ${err.message}`);
            throw err;
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
        res.set('Cache-Control', 'no-store'); 
        res.status(404).json({ error: "Ship render unavailable" });
    }
});

// --- Corp Logo Proxy ---
app.get('/render/corp/:corpId', async (req, res) => {
    const { corpId } = req.params;
    const localPath = path.join(CORP_CACHE, `${corpId}.png`);

    // 1. Serve from SSD if available
    if (fs.existsSync(localPath)) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable'); 
        return res.sendFile(localPath);
    }

    // 2. Coalesce Requests (Reuse your existing pendingRequests Map)
    const requestKey = `corp_${corpId}`; // Unique key to prevent collision with ship IDs
    if (pendingRequests.has(requestKey)) {
        await pendingRequests.get(requestKey);
        return res.sendFile(localPath);
    }

    // 3. The Fetch Logic
    const fetchPromise = (async () => {
        try {
            // EVE Image Server endpoint for corporation logos
            const ccpUrl = `https://images.evetech.net/corporations/${corpId}/logo?size=64`;
            const response = await axios({ url: ccpUrl, responseType: 'stream' });

            if (response.status !== 200) throw new Error('CCP Server Error');

            await pipeline(response.data, fs.createWriteStream(localPath));
        } catch (err) {
            console.error(`[PROXY ERROR] Corp ${corpId}: ${err.message}`);
            throw err;
        } finally {
            pendingRequests.delete(requestKey);
        }
    })();

    pendingRequests.set(requestKey, fetchPromise);

    try {
        await fetchPromise;
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        res.sendFile(localPath);
    } catch (err) {
        res.set('Cache-Control', 'no-store'); 
        res.status(404).json({ error: "Corp logo unavailable" });
    }
});

// -- Image Rotation -- 
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

// --- Boot ---
https.createServer(sslOptions, app).listen(2053, '0.0.0.0', () => {
    console.log("Image Proxy Online: https://api.voidspark.org:2053");
});