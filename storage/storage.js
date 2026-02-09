const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const STATUS_DIR = path.join(ROOT_DIR, 'cache');
const CACHE_DIR = path.join(STATUS_DIR, 'renders');
const CORP_DIR = path.join(STATUS_DIR, 'corps');
const MARKET_DIR = path.join(STATUS_DIR, 'market');

const paths = {
    statusDir: STATUS_DIR,
    rendersDir: CACHE_DIR,
    corpsDir: CORP_DIR,
    marketDir: MARKET_DIR,
    npcKillsFile: path.join(STATUS_DIR, 'npc_kills.json'),
    npcLifetimeFile: path.join(STATUS_DIR, 'npc_lifetime.json'),
    serverStatusFile: path.join(STATUS_DIR, 'server_status.json')
};


const initStorage = () => {
    const dirs = [CACHE_DIR, CORP_DIR, STATUS_DIR, MARKET_DIR];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`[STORAGE INIT] created: ${dir}`);
        }
    });
}

initStorage();

module.exports = { paths, initStorage };