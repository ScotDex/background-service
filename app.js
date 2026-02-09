const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const axios = require('axios'); // Ensure this is installed: npm install axios
const cron = require('node-cron');
const swaggerUi = require('swagger-ui-express');
const headerAgent = require('./middleware/headerAgent');
const { paths, initStorage } = require('./storage/storage');
const { getAsset } = require('./services/assetService');

initStorage();

const app = express();
app.set('etag', false);
app.use(cors());
app.use(headerAgent);
const specPath = path.join(__dirname, 'docs', 'openapi.json');
const swaggerSpec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

app.use('/docs', swaggerUi.serve, (req, res, next) => {
    const freshSpec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    swaggerUi.setup(freshSpec)(req, res, next);
});

const CACHE_DIR = paths.rendersDir;
const CORP_DIR = paths.corpsDir;
const STATUS_DIR = paths.statusDir;
const MARKET_DIR = paths.marketDir;
const NPC_KILLS_CACHE_FILE = paths.npcKillsFile;
const NPC_LIFETIME_FILE = paths.npcLifetimeFile;
const STATUS_CACHE_FILE = paths.serverStatusFile;

const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'ssl', 'socketkillcom.key')),
    cert: fs.readFileSync(path.join(__dirname, 'ssl', 'socketkillcom.pem'))
};

const BG_DIR = path.join(__dirname, 'backgrounds');
app.use('/images', express.static(BG_DIR));

app.get('/render/ship/:typeId', async (req, res) => {
    const { typeId } = req.params;
    const localPath = path.join(CACHE_DIR, `${typeId}.png`);
    const remoteUrl = `https://images.evetech.net/types/${typeId}/render?size=64`;

    try {
        await getAsset(`ship_${typeId}`, localPath, remoteUrl);
        res.sendFile(localPath);
    } catch (err) {
        res.set('Cache-Control', 'no-store').status(404).json({ error: "Ship render unavailable" });
    }
});

app.get('/render/corp/:corpId', async (req, res) => {
    const { corpId } = req.params;
    const localPath = path.join(CORP_DIR, `${corpId}.png`);
    const remoteUrl = `https://images.evetech.net/corporations/${corpId}/logo?size=64`;

    try {
        await getAsset(`corp_${corpId}`, localPath, remoteUrl);
        res.sendFile(localPath);
    } catch (err) {
        res.set('Cache-Control', 'no-store').status(404).json({ error: "Corp logo unavailable" });
    }
});

app.get('/render/market/:typeId', async (req, res) => {
    const { typeId } = req.params;
    const localPath = path.join(MARKET_DIR, `${typeId}.png`);
    // Note: Items use /icon, Ships use /render
    const remoteUrl = `https://images.evetech.net/types/${typeId}/icon?size=64`;

    try {
        // Use the 'market_' prefix to keep the Map keys unique
        await getAsset(`market_${typeId}`, localPath, remoteUrl);
        res.sendFile(localPath);
    } catch (err) {
        res.set('Cache-Control', 'no-store').status(404).json({ error: "Market icon unavailable" });
    }
});

async function refreshNPCKills () {
    console.log (`[${new Date().toISOString()}] Refreshing Global NPC Kills...`);
    try {
        const response = await axios.get('https://esi.evetech.net/latest/universe/system_kills/', {
            headers: { 'User-Agent': 'SocketKill.com' }
        });
        const rawData = response.data;
        const snapshotTotal = rawData.reduce((acc, system) => acc + (system.npc_kills || 0), 0);
        let lifetimeTotal = snapshotTotal; 
        if (fs.existsSync(NPC_LIFETIME_FILE)) {
            const storedData = JSON.parse(await fs.promises.readFile(NPC_LIFETIME_FILE, 'utf8'));
            lifetimeTotal = (storedData.lifetimeTotal || 0) + snapshotTotal;
        }
        const npcData = {
            total: snapshotTotal,
            lifetimeTotal: lifetimeTotal,
            systemsActive: rawData.length,
            lastUpdated: new Date().toISOString(),
        };
        await fs.promises.writeFile(NPC_LIFETIME_FILE, JSON.stringify(npcData, null, 2));
        await fs.promises.writeFile(NPC_KILLS_CACHE_FILE, JSON.stringify(npcData, null, 2));
        console.log(`[${new Date().toISOString()}] NPC Kills Updated`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error refreshing NPC Kills: ${error.message}`);
    }
}



app.get('/random', (req, res) => {
    fs.readdir(BG_DIR, (err, files) => {
        if (err || !files.length) return res.status(500).json({ error: "No images found" });
        const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
        const images = files.filter(f => validExtensions.includes(path.extname(f).toLowerCase()));
        const randomImage = images[Math.floor(Math.random() * images.length)];
        res.json({
            url: `https://api.socketkill.com/images/${randomImage}`,
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
                'User-Agent': 'socketkill.com',
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
app.get('/eve/status', async (req, res) => {
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
app.get('/stats/npc-kills', async (req, res) => {
    try {
        if (!fs.existsSync(NPC_KILLS_CACHE_FILE)) {
            return res.status(503).json({ error: "NPC data initializing..." });
        }
        const data = await fs.promises.readFile(NPC_KILLS_CACHE_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
cron.schedule('*/15 * * * *', refreshServerStatus);
cron.schedule('5 * * * *', refreshNPCKills);
refreshServerStatus();
refreshNPCKills();
https.createServer(sslOptions, app).listen(8080, '0.0.0.0', () => {
    console.log("Image Proxy Online: https://api.socketkill.com:8080");
});

