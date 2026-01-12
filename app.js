const express = require (`express`);
const fs = require(`fs`);
const path = require(`path`);
const app = express();
const cors = require(`cors`);


app.use(cors());

const BG_DIR = path.join(__dirname, 'backgrounds');
app.use ('/images', express.static(BG_DIR));

app.get('/random', (req, res) => {
    fs.readdir(BG_DIR, (err, files) => {
        if (err || !files.length) return res.status(500).json({ error: "No images found"})
        const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
        const images = files.filter(f => validExtensions.includes(path.extname(f).toLowerCase()));
        const randomImage = images[Math.floor(Math.random() * images.length)];
        res.json({
            url: `http://localhost:8080/images/${randomImage}`,
            name: randomImage
        });
    });
});

app.listen(8080, '0.0.0.0', () => console.log("Nebula Provider Online"));