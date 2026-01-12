const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

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

// 2. Start the HTTPS server
https.createServer(sslOptions, app).listen(2053, '0.0.0.0', () => {
    console.log("🔒 Nebula Provider Online via HTTPS on Port 2053");
});