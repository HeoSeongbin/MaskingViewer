import { describe, it, expect } from 'vitest';
import {
  detectSignature,
  validateFormat,
  inspectFile,
} from '../core/document/fileFormat';
describe('file format validation', () => {
  it.each([
    ['png', [137, 80, 78, 71, 13, 10, 26, 10]],
    ['jpeg', [255, 216, 255]],
    ['bmp', [66, 77]],
    ['gif', [71, 73, 70, 56, 57, 97]],
    ['pdf', [37, 80, 68, 70, 45]],
    ['tiff', [73, 73, 42, 0]],
    ['tiff', [77, 77, 0, 42]],
    ['webp', [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]],
  ])('identifies %s by bytes', (format, bytes) =>
    expect(detectSignature(new Uint8Array(bytes as number[]))).toBe(format),
  );
  it('rejects disguised files and unsafe extensions', () => {
    const bytes = new Uint8Array([37, 80, 68, 70, 45]);
    expect(() => validateFormat('image.png', '', bytes)).toThrow('일치');
    expect(() => validateFormat('file.svg', '', bytes)).toThrow('지원하지');
    expect(() => validateFormat('file.pdf', 'image/png', bytes)).toThrow(
      'MIME',
    );
    expect(validateFormat('FILE.PDF', 'application/octet-stream', bytes)).toBe(
      'pdf',
    );
    expect(() => validateFormat('file.pdf', '', new Uint8Array())).toThrow(
      '헤더',
    );
  });
  it('rejects empty/oversized/cancelled files before reading their data', async () => {
    await expect(
      inspectFile(new File([], 'empty.png'), new AbortController().signal),
    ).rejects.toThrow('빈 파일');
    const large = new File([], 'large.pdf');
    Object.defineProperty(large, 'size', { value: 101 * 1024 * 1024 });
    await expect(
      inspectFile(large, new AbortController().signal),
    ).rejects.toThrow('100MB');
    const cancel = new AbortController();
    cancel.abort();
    await expect(inspectFile(large, cancel.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
