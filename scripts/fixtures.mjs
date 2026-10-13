import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument, degrees, rgb, PDFName, PDFHexString } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';

export async function createFixtures(directory) {
  await mkdir(directory, { recursive: true });
  const canvas = createCanvas(240, 160);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#087f72';
  ctx.fillRect(0, 0, 240, 160);
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px sans-serif';
  ctx.fillText('LOCAL DOCUMENT', 12, 85);
  for (const [extension, mime] of [
    ['png', 'image/png'],
    ['jpg', 'image/jpeg'],
    ['webp', 'image/webp'],
  ])
    await writeFile(`${directory}/image.${extension}`, canvas.toBuffer(mime));
  // 2x2 24-bit BMP: rows padded to 4-byte alignment.
  const bmp = Buffer.alloc(70);
  bmp.write('BM');
  bmp.writeUInt32LE(70, 2);
  bmp.writeUInt32LE(54, 10);
  bmp.writeUInt32LE(40, 14);
  bmp.writeInt32LE(2, 18);
  bmp.writeInt32LE(2, 22);
  bmp.writeUInt16LE(1, 26);
  bmp.writeUInt16LE(24, 28);
  bmp.fill(200, 54);
  await writeFile(`${directory}/image.bmp`, bmp);
  await writeFile(
    `${directory}/image.gif`,
    Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64',
    ),
  );
  const pdf = await PDFDocument.create();
  for (let index = 0; index < 3; index++) {
    const page = pdf.addPage([320, 400]);
    page.drawRectangle({
      x: 20,
      y: 80,
      width: 280,
      height: 240,
      color: rgb(index * 0.25, 0.55, 0.45),
    });
    page.drawText(`PAGE ${index + 1}`, { x: 80, y: 250, size: 32 });
    if (index === 2) page.setRotation(degrees(90));
  }
  await writeFile(`${directory}/pages.pdf`, await pdf.save());
  // Password fixture: Standard Security Handler R2 rejects every password; tests only missing-password guidance.
  const locked = await PDFDocument.create();
  locked.addPage([100, 100]);
  const encryption = locked.context.obj({
    Filter: PDFName.of('Standard'),
    V: 1,
    R: 2,
    P: -4,
    O: PDFHexString.of('00'.repeat(32)),
    U: PDFHexString.of('00'.repeat(32)),
  });
  locked.context.trailerInfo.Encrypt = locked.context.register(encryption);
  locked.context.trailerInfo.ID = locked.context.obj([
    PDFHexString.of('11'.repeat(16)),
    PDFHexString.of('11'.repeat(16)),
  ]);
  await writeFile(
    `${directory}/locked.pdf`,
    await locked.save({ useObjectStreams: false }),
  );
  for (const compression of [1, 3, 4, 5, 8, 32773])
    await writeFile(
      `${directory}/pages-${compression}.tif`,
      buildTiff(compression),
    );
  await writeFile(`${directory}/broken.pdf`, '%PDF-1.7\nbroken');
  await writeFile(`${directory}/fake.png`, '%PDF-1.7\nbroken');
  await writeFile(`${directory}/unsafe.svg`, '<svg/>');
}

export function buildTiff(compression = 1) {
  const w = 40,
    h = 30;
  const entries = 11;
  const ifdSize = 2 + entries * 12 + 4;
  const blocks = [];
  for (let page = 0; page < 3; page++) {
    const raw = Buffer.alloc(w * h);
    raw.fill(page === 0 ? 40 : page === 1 ? 140 : 230);
    if (compression === 3 || compression === 4) {
      const eol = '000000000001';
      const bits =
        compression === 3
          ? (eol + '00101001').repeat(h) + eol.repeat(6)
          : '1'.repeat(h) + eol.repeat(2);
      const encoded = Buffer.alloc(Math.ceil(bits.length / 8));
      for (let i = 0; i < bits.length; i++)
        if (bits[i] === '1') encoded[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
      blocks.push(encoded);
    } else if (compression === 8) blocks.push(deflateSync(raw));
    else if (compression === 32773) {
      const encoded = [];
      for (let i = 0; i < raw.length; i += 128) {
        const count = Math.min(128, raw.length - i);
        encoded.push(257 - count, raw[i]);
      }
      blocks.push(Buffer.from(encoded));
    } else if (compression === 5) {
      // Reset before each 9-bit literal so code width never grows; valid TIFF MSB LZW.
      const codes = [];
      for (const value of raw) codes.push(256, value);
      codes.push(257);
      const encoded = Buffer.alloc(Math.ceil((codes.length * 9) / 8));
      let bit = 0;
      for (const code of codes)
        for (let k = 8; k >= 0; k--) {
          encoded[Math.floor(bit / 8)] |= ((code >> k) & 1) << (7 - (bit % 8));
          bit++;
        }
      blocks.push(encoded);
    } else blocks.push(raw);
  }
  const buffer = Buffer.alloc(
    8 + 3 * ifdSize + blocks.reduce((sum, b) => sum + b.length, 0),
  );
  buffer.write('II');
  buffer.writeUInt16LE(42, 2);
  buffer.writeUInt32LE(8, 4);
  let pixelOffset = 8 + 3 * ifdSize;
  for (let i = 0; i < 3; i++) {
    const offset = 8 + i * ifdSize;
    buffer.writeUInt16LE(entries, offset);
    const tags = [
      [256, 4, w],
      [257, 4, h],
      [258, 3, compression === 3 || compression === 4 ? 1 : 8],
      [259, 3, compression],
      [262, 3, compression === 3 || compression === 4 ? 0 : 1],
      [273, 4, pixelOffset],
      [274, 3, i === 2 ? 6 : 1],
      [277, 3, 1],
      [278, 4, h],
      [279, 4, blocks[i].length],
      [284, 3, 1],
    ];
    tags.forEach(([tag, type, value], index) => {
      const start = offset + 2 + index * 12;
      buffer.writeUInt16LE(tag, start);
      buffer.writeUInt16LE(type, start + 2);
      buffer.writeUInt32LE(1, start + 4);
      if (type === 3) buffer.writeUInt16LE(value, start + 8);
      else buffer.writeUInt32LE(value, start + 8);
    });
    buffer.writeUInt32LE(
      i === 2 ? 0 : offset + ifdSize,
      offset + 2 + entries * 12,
    );
    blocks[i].copy(buffer, pixelOffset);
    pixelOffset += blocks[i].length;
  }
  return buffer;
}
