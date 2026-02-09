const fs = require('fs');
const path = require('path');

const spec = {
  openapi: '3.0.0',
  info: {
    title: 'Socket.Kill Public API',
    version: '1.5.0',
    description: 'High-performance EVE Online asset proxy serving ships, corporations, and market items.'
  },
  servers: [{ url: 'https://api.socketkill.com' }], // Standardized to your production URL
  paths: {
    "/render/ship/{typeId}": {
      "get": {
        "summary": "Get Ship Render",
        "description": "Returns a 64x64 PNG render of the specified ship type.",
        "parameters": [{
          "name": "typeId",
          "in": "path",
          "required": true,
          "schema": { "type": "integer" },
          "example": 603
        }],
        "responses": {
          "200": { "description": "Success", "content": { "image/png": {} } },
          "404": { "description": "Render not found" }
        }
      }
    },
    "/render/corp/{corpId}": {
      "get": {
        "summary": "Get Corp Logo",
        "description": "Returns a 64x64 PNG logo for the specified corporation.",
        "parameters": [{
          "name": "corpId",
          "in": "path",
          "required": true,
          "schema": { "type": "integer" },
          "example": 98388312
        }],
        "responses": {
          "200": { "description": "Success", "content": { "image/png": {} } },
          "404": { "description": "Logo not found" }
        }
      }
    },
    "/render/market/{typeId}": {
      "get": {
        "summary": "Get Market Icon",
        "description": "Returns a 64x64 PNG icon for inventory items (modules, ores, etc.).",
        "parameters": [{
          "name": "typeId",
          "in": "path",
          "required": true,
          "schema": { "type": "integer" },
          "example": 34
        }],
        "responses": {
          "200": { "description": "Success", "content": { "image/png": {} } },
          "404": { "description": "Icon unavailable" }
        }
      }
    }
  }
};

const outputDir = path.join(__dirname, 'docs');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

fs.writeFileSync(
  path.join(outputDir, 'openapi.json'),
  JSON.stringify(spec, null, 2)
);

console.log('✅ Spec updated with Market icons to ./docs/openapi.json');