// Generates simple solid-color RecruitPro icons as valid PNG files.
// Runs automatically before `npm run build` (see package.json prebuild).
// This keeps the repo free of committed binary assets while still producing
// real PNGs that Chrome accepts.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "public", "icons");

// RecruitPro primary indigo (#4F46E5) with a lighter mark.
const BG = [79, 70, 229];
const MARK = [255, 255, 255];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makePng(size) {
  // Build raw RGBA scanlines with a filter byte (0) per row.
  const bytesPerPixel = 4;
  const stride = size * bytesPerPixel;
  const raw = Buffer.alloc((stride + 1) * size);
  const mid = size / 2;
  const markRadius = size * 0.28;
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const dx = x - mid + 0.5;
      const dy = y - mid + 0.5;
      const inMark = Math.sqrt(dx * dx + dy * dy) <= markRadius;
      const [r, g, b] = inMark ? MARK : BG;
      const off = y * (stride + 1) + 1 + x * bytesPerPixel;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const png = makePng(size);
  writeFileSync(resolve(OUT_DIR, `icon${size}.png`), png);
  console.log(`generated icons/icon${size}.png (${png.length} bytes)`);
}
