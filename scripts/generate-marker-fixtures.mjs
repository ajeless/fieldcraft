#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDirectory = path.join(repoRoot, "apps", "editor", "test-fixtures", "assets");

const transparent = [0, 0, 0, 0];

const fixtures = [
  {
    fileName: "marker-alpha.png",
    label: "A1",
    fill: [191, 67, 55, 255],
    ring: [244, 222, 217, 255],
    text: [255, 248, 244, 255]
  },
  {
    fileName: "marker-bravo.png",
    label: "B2",
    fill: [54, 95, 191, 255],
    ring: [219, 229, 248, 255],
    text: [246, 249, 255, 255]
  },
  {
    fileName: "marker-command.png",
    label: "C3",
    fill: [52, 129, 103, 255],
    ring: [219, 240, 232, 255],
    text: [244, 255, 250, 255]
  },
  {
    fileName: "marker-objective.png",
    label: "OBJ",
    fill: [179, 131, 34, 255],
    ring: [247, 236, 204, 255],
    text: [255, 251, 239, 255]
  }
];

const glyphs = {
  A: [
    "01110",
    "10001",
    "10001",
    "11111",
    "10001",
    "10001",
    "10001"
  ],
  B: [
    "11110",
    "10001",
    "10001",
    "11110",
    "10001",
    "10001",
    "11110"
  ],
  C: [
    "01111",
    "10000",
    "10000",
    "10000",
    "10000",
    "10000",
    "01111"
  ],
  J: [
    "00111",
    "00010",
    "00010",
    "00010",
    "10010",
    "10010",
    "01100"
  ],
  O: [
    "01110",
    "10001",
    "10001",
    "10001",
    "10001",
    "10001",
    "01110"
  ],
  "1": [
    "00100",
    "01100",
    "00100",
    "00100",
    "00100",
    "00100",
    "01110"
  ],
  "2": [
    "01110",
    "10001",
    "00001",
    "00010",
    "00100",
    "01000",
    "11111"
  ],
  "3": [
    "11110",
    "00001",
    "00001",
    "01110",
    "00001",
    "00001",
    "11110"
  ]
};

fs.mkdirSync(outputDirectory, { recursive: true });

for (const fixture of fixtures) {
  const image = createTokenFixture(fixture);
  fs.writeFileSync(path.join(outputDirectory, fixture.fileName), image);
}

function createTokenFixture(fixture) {
  const width = 96;
  const height = 96;
  const pixels = Buffer.alloc(width * height * 4);
  fill(pixels, width, height, transparent);

  fillRect(pixels, width, height, 8, 8, 80, 80, [22, 27, 31, 255]);
  fillCircle(pixels, width, height, 48, 48, 34, fixture.ring);
  fillCircle(pixels, width, height, 48, 48, 29, fixture.fill);

  drawTextCentered(
    pixels,
    width,
    fixture.label,
    fixture.label.length > 2 ? 4 : 6,
    fixture.label.length > 2 ? 35 : 27,
    fixture.text
  );

  return encodePng(width, height, pixels);
}

function drawTextCentered(pixels, width, text, scale, y, color) {
  const characters = [...text];
  const glyphWidth = 5 * scale;
  const gap = scale;
  const textWidth = characters.length * glyphWidth + (characters.length - 1) * gap;
  let x = Math.floor((width - textWidth) / 2);

  for (const character of characters) {
    drawGlyph(pixels, width, x, y, character, scale, color);
    x += glyphWidth + gap;
  }
}

function drawGlyph(pixels, width, x, y, character, scale, color) {
  const glyph = glyphs[character];
  if (!glyph) {
    throw new Error(`Missing glyph for ${character}`);
  }

  for (let row = 0; row < glyph.length; row += 1) {
    for (let column = 0; column < glyph[row].length; column += 1) {
      if (glyph[row][column] !== "1") {
        continue;
      }

      fillRect(
        pixels,
        width,
        pixels.length / 4 / width,
        x + column * scale,
        y + row * scale,
        scale,
        scale,
        color
      );
    }
  }
}

function fill(pixels, width, height, color) {
  fillRect(pixels, width, height, 0, 0, width, height, color);
}

function fillRect(pixels, width, height, x, y, rectWidth, rectHeight, color) {
  const minX = Math.max(0, x);
  const minY = Math.max(0, y);
  const maxX = Math.min(width, x + rectWidth);
  const maxY = Math.min(height, y + rectHeight);

  for (let currentY = minY; currentY < maxY; currentY += 1) {
    for (let currentX = minX; currentX < maxX; currentX += 1) {
      setPixel(pixels, width, currentX, currentY, color);
    }
  }
}

function fillCircle(pixels, width, height, centerX, centerY, radius, color) {
  const radiusSquared = radius * radius;

  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radiusSquared) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          setPixel(pixels, width, x, y, color);
        }
      }
    }
  }
}

function setPixel(pixels, width, x, y, color) {
  const index = (y * width + x) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function encodePng(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    signature,
    createChunk("IHDR", ihdr),
    createChunk("IDAT", idat),
    createChunk("IEND", Buffer.alloc(0))
  ]);
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
