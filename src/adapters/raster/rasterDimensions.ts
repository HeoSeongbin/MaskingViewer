import { assertDimensions } from '../../core/document/DocumentModel';
import type { DocumentFormat } from '../../core/document/DocumentModel';
export function inspectRasterDimensions(
  bytes: Uint8Array,
  format: DocumentFormat,
) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  try {
    if (format === 'png') {
      width = view.getUint32(16);
      height = view.getUint32(20);
    }
    if (format === 'gif') {
      width = view.getUint16(6, true);
      height = view.getUint16(8, true);
    }
    if (format === 'bmp') {
      if (view.getUint32(14, true) === 12) {
        width = view.getUint16(18, true);
        height = view.getUint16(20, true);
      } else {
        width = view.getInt32(18, true);
        height = Math.abs(view.getInt32(22, true));
      }
    }
    if (format === 'webp') {
      const kind = String.fromCharCode(...bytes.slice(12, 16));
      if (kind === 'VP8X') {
        width = 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16);
        height = 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16);
      }
      if (kind === 'VP8 ') {
        width = view.getUint16(26, true) & 0x3fff;
        height = view.getUint16(28, true) & 0x3fff;
      }
      if (kind === 'VP8L') {
        const bits = view.getUint32(21, true);
        width = (bits & 0x3fff) + 1;
        height = ((bits >>> 14) & 0x3fff) + 1;
      }
    }
    if (format === 'jpeg') {
      let offset = 2;
      while (offset + 8 < bytes.length) {
        if (bytes[offset] !== 0xff) break;
        while (bytes[offset] === 0xff) offset++;
        const marker = bytes[offset++];
        if (marker === 0xd9 || marker === 0xda || marker === undefined) break;
        if (
          marker === 0xd8 ||
          marker === 0x01 ||
          (marker >= 0xd0 && marker <= 0xd7)
        )
          continue;
        const length = view.getUint16(offset);
        if (length < 2) break;
        if (
          marker >= 0xc0 &&
          marker <= 0xcf &&
          ![0xc4, 0xc8, 0xcc].includes(marker)
        ) {
          height = view.getUint16(offset + 3);
          width = view.getUint16(offset + 5);
          break;
        }
        offset += length;
      }
    }
  } catch {
    throw new Error('이미지 크기 헤더가 손상되었습니다.');
  }
  if (!width || !height)
    throw new Error(
      '이미지 크기를 안전하게 확인할 수 없습니다. JPEG 헤더 검사 한도는 1MB입니다.',
    );
  assertDimensions(width, height);
  return { width, height };
}
