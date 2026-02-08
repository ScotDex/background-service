const fs = require('fs');
const path = require('path');

const spec = {
  openapi: '3.0.0',
  info: {
    title: 'Socket.Kill Public API',
    version: '1.4.0',
    description: 'High-performance EVE Online asset proxy.'
  },
  servers: [{ url: 'https://api.socketkill.com:2053' }],
  paths: {
    "/render/ship/{typeId}": {
      "get": {
        "summary": "Get Ship Render",
        "parameters": [{
          "name": "typeId",
          "in": "path",
          "required": true,
          "schema": { "type": "integer" }
        }],
        "responses": {
          "200": { "description": "Success", "content": { "image/png": {} } }
        }
      }
    },
    "/render/corp/{corpId}": {
      "get": {
        "summary": "Get Corp Logo",
        "parameters": [{
          "name": "corpId",
          "in": "path",
          "required": true,
          "schema": { "type": "integer" }
        }],
        "responses": {
          "200": { "description": "Success", "content": { "image/png": {} } }
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

console.log('✅ Spec pre-baked to ./docs/openapi.json');