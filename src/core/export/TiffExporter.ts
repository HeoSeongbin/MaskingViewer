import type { OutputPixels } from './pixels';
import { rgbPixels } from './pixels';
// TIFF 6.0 baseline: little endian, RGB8, one uncompressed strip per page.
// Only generated pixels and these explicit tags enter the file.
export function encodeTiff(pages: readonly OutputPixels[]) {
  if (!pages.length) throw new Error('출력 페이지가 없습니다.');
  const directorySize = 2 + 10 * 12 + 4 + 6;
  const bytes = new Uint8Array(
    8 +
      pages.reduce(
        (sum, p) =>
          sum +
          directorySize +
          p.width * p.height * 3 +
          ((p.width * p.height * 3) % 2),
        0,
      ),
  );
  const view = new DataView(bytes.buffer);
  bytes.set([73, 73, 42, 0]);
  view.setUint32(4, 8, true);
  let offset = 8;
  pages.forEach((page, index) => {
    const rgb = rgbPixels(page),
      pixelOffset = offset + directorySize;
    const next = pixelOffset + rgb.length + (rgb.length % 2);
    view.setUint16(offset, 10, true);
    const tags = [
      [256, 4, 1, page.width],
      [257, 4, 1, page.height],
      [258, 3, 3, offset + directorySize - 6],
      [259, 3, 1, 1],
      [262, 3, 1, 2],
      [273, 4, 1, pixelOffset],
      [274, 3, 1, 1],
      [277, 3, 1, 3],
      [278, 4, 1, page.height],
      [279, 4, 1, rgb.length],
    ];
    tags.forEach(([tag, type, count, value], i) => {
      const at = offset + 2 + i * 12;
      view.setUint16(at, tag!, true);
      view.setUint16(at + 2, type!, true);
      view.setUint32(at + 4, count!, true);
      view.setUint32(at + 8, value!, true);
    });
    view.setUint32(offset + 122, index + 1 < pages.length ? next : 0, true);
    [0, 2, 4].forEach((n) =>
      view.setUint16(offset + directorySize - 6 + n, 8, true),
    );
    bytes.set(rgb, pixelOffset);
    offset = next;
  });
  return bytes;
}
