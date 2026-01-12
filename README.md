# Nebula Provider Service

A high-performance "sidecar" container designed to serve randomized high-fidelity space backgrounds for the **Socket.Kill** intel platform.

## Features
- **Decoupled Architecture**: Runs as an isolated service to prevent image I/O from blocking the main intel stream.
- **Randomized Selection**: Serves a random nebula from the local collection via a REST endpoint.
- **Static Asset Hosting**: Efficiently serves high-resolution imagery using Express static middleware.
- **CORS Enabled**: Configured for cross-origin requests to support modular frontend architectures.

## Asset Credits
Background imagery used with the express permission of **Rixx Javix** (@RixxJavix). 
*Check out more of his incredible EVE Online photography and art at https://www.flickr.com/photos/rixxjavix/albums/

## API Endpoints

### `GET /random`
Returns a JSON object containing the URL and filename of a random nebula.
**Response:**
```json
{
  "url": "http://<host>:8080/images/nebula_alpha.jpg",
  "name": "nebula_alpha.jpg"
}
