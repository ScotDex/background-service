const headerAgent = (req, res, next) => {
    const path = req.path;
    if (path.startsWith('/render/') || path.startsWith('/images/')) {
        res.set ({
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff',
            'Access-Control-Allow-Origin': '*'
        });
    }

    else if (path.startsWith('/stats/')|| path.startsWith('/eve/')) {
        res.set({
            'Cache-Control': 'public, max-age=300', // 5-minute window
            'Access-Control-Allow-Origin': '*'
        })
    }

    res.removeHeader('X-Powered-By');
    next();

}

module.exports = headerAgent;