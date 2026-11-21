const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create a valid uncompressed PNG buffer using pure Node.js (no native deps)
function createManagerPosIcon(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8-bit depth
  ihdrData[9] = 2; // Truecolor (RGB)
  ihdrData[10] = 0; // Deflate compression
  ihdrData[11] = 0; // Filter method
  ihdrData[12] = 0; // No interlace

  const ihdr = makeChunk('IHDR', ihdrData);

  // Scanlines: filter byte (0) + width * 3 bytes
  const scanlineLength = 1 + width * 3;
  const rawData = Buffer.alloc(scanlineLength * height);

  const cx = width / 2;
  const cy = height / 2;
  const cornerRadius = width * 0.22;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // No filter

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;

      // Base: Emerald Gradient (#059669 to #047857)
      const gradT = y / height;
      let r = Math.round(5 + (4 - 5) * gradT);
      let g = Math.round(150 + (120 - 150) * gradT);
      let b = Math.round(105 + (87 - 105) * gradT);

      // Check distance from center for modern rounded squircle / circle icon
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const halfW = width * 0.44;
      const halfH = height * 0.44;

      // Inner POS Terminal Screen Box (Slate #0f172a)
      const isScreen =
        x >= width * 0.22 &&
        x <= width * 0.78 &&
        y >= height * 0.24 &&
        y <= height * 0.72;

      // Gold Terminal Base & Stand
      const isBase =
        x >= width * 0.32 &&
        x <= width * 0.68 &&
        y >= height * 0.74 &&
        y <= height * 0.82;

      // Golden "M" POS emblem in center
      const inMEmblem =
        y >= height * 0.34 &&
        y <= height * 0.62 &&
        (
          (Math.abs(x - width * 0.32) < width * 0.035) || // Left bar of M
          (Math.abs(x - width * 0.68) < width * 0.035) || // Right bar of M
          // Diagonal strokes of M meeting in center
          (y >= height * 0.36 && Math.abs((y - height * 0.36) - Math.abs(x - cx) * 1.5) < width * 0.04 && x >= width * 0.32 && x <= width * 0.68)
        );

      // Status LED circle
      const isLed = Math.sqrt(Math.pow(x - width * 0.70, 2) + Math.pow(y - height * 0.30, 2)) < width * 0.025;

      if (inMEmblem) {
        // Gold / Amber (#fbbf24)
        r = 251;
        g = 191;
        b = 36;
      } else if (isLed) {
        // Bright Green LED
        r = 34;
        g = 197;
        b = 94;
      } else if (isBase) {
        // Amber Stand
        r = 245;
        g = 158;
        b = 11;
      } else if (isScreen) {
        // Dark Slate Screen (#1e293b)
        r = 30;
        g = 41;
        b = 59;
      }

      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const length = data.length;
  const buf = Buffer.alloc(8 + length + 4);
  buf.writeUInt32BE(length, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);

  const crc = crc32(buf.subarray(4, 8 + length));
  buf.writeUInt32BE(crc, 8 + length);
  return buf;
}

// Standard CRC32
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = c ^ buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate PWA PNG icons for Manager POS
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createManagerPosIcon(192, 192));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createManagerPosIcon(512, 512));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createManagerPosIcon(180, 180));
console.log('Manager POS high-quality PNG icons generated.');
