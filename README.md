# Nebula & Asset Provider Service

A high-performance "sidecar" service designed to serve randomized high-fidelity space backgrounds and **cached ship renders** for the **Socket.Kill** intel platform.

## Features
- **Decoupled Architecture**: Isolated service prevents heavy image I/O and SSL overhead from blocking the main intel engine.
- **Ship Render Proxy**: Intercepts CCP image requests, caches them locally on Premium SSD, and serves them with `immutable` headers for 1ms performance.
- **Request Coalescing**: Prevents "Thundering Herd" syndrome by ensuring each unique Ship TypeID is only downloaded once, even during high-traffic fleet fights.
- **Cloudflare Edge Optimized**: Operates on Port 2053, leveraging Cloudflare's global edge network to offload bandwidth from the origin.

## Asset Credits
Background imagery used with the express permission of **Rixx Javix** (@RixxJavix). 
*Check out more of his incredible EVE Online photography and art at [Flickr](https://www.flickr.com/photos/rixxjavix/albums/).*

## API Endpoints

### `GET /random`
Returns a JSON object containing the URL and filename of a random nebula from the local collection.
**Response:**
```json
{
  "url": "[https://api.voidspark.org:2053/images/nebula_alpha.jpg](https://api.voidspark.org:2053/images/nebula_alpha.jpg)",
  "name": "nebula_alpha.jpg"
}