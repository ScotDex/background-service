const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { pipeline } = require('node:stream/promises');
const axios = require('axios'); // Ensure this is installed: npm install axios
const cron = require('node-cron');

// --- Express App ---

const app = express();
app.use(cors());

// --- Persistence Layer ---
const CACHE_DIR = path.join(__dirname, 'cache', 'renders');
const CORP_DIR = path.join(__dirname, 'cache', 'corps');
const STATUS_DIR = path.join(__dirname, 'cache');

const STATUS_CACHE_FILE = path.join(__dirname, 'cache', 'server_status.json');

// -- Directory Creation ---
if (!fs.existsSync(STATUS_DIR)) fs.mkdirSync(STATUS_DIR, { recursive: true });
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
    const localPath = path.join(CORP_DIR, `${corpId}.png`);

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

async function refreshServerStatus() {
    console.log(`[${new Date().toISOString()}] Refreshing EVE Status...`);
    try {
        const response = await axios.get('https://esi.evetech.net/latest/status/', {
            headers: {
                'X-Compatibility-Date': '2025-12-16',
                'User-Agent': 'voidspark.org',
            }
        });

        const statusData = {
            players: response.data.players,
            version: response.data.server_version,
            startTime: response.data.start_time,
            lastUpdated: new Date().toISOString(),
        };
        await fs.promises.writeFile(STATUS_CACHE_FILE, JSON.stringify(statusData, null, 2));
        console.log(`[${new Date().toISOString()}] Server Status Updated`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error refreshing server status: ${error.message}`);
    } 
}

app.get('/api/eve/status', async (req, res) => {
    try {
        if (!fs.existsSync(STATUS_CACHE_FILE)) {
            return res.status(503).json({ error: "Server status data initializing..." });
        }
        const data = await fs.promises.readFile(STATUS_CACHE_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err){
        res.status(500).json({ error: err.message });
    }  
});

// Schedule: Every 15 minutes (Minute 0, 15, 30, 45)
cron.schedule('*/15 * * * *', refreshServerStatus);

// Initial run to ensure the file exists for the first users
refreshServerStatus();

// --- Boot ---
https.createServer(sslOptions, app).listen(2053, '0.0.0.0', () => {
    console.log("Image Proxy Online: https://api.voidspark.org:2053");
});

