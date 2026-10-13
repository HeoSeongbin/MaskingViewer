import { MAX_FILE_BYTES, checkAbort } from './DocumentModel';
import type { DocumentFormat } from './DocumentModel';

const extensions: Record<string, DocumentFormat> = {
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  bmp: 'bmp',
  gif: 'gif',
  webp: 'webp',
  pdf: 'pdf',
  tif: 'tiff',
  tiff: 'tiff',
};
const mimeTypes: Record<string, DocumentFormat> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/bmp': 'bmp',
  'image/x-ms-bmp': 'bmp',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'image/tiff': 'tiff',
  'application/x-tiff': 'tiff',
  'image/tif': 'tiff',
  'image/jpg': 'jpeg',
};
export function detectSignature(bytes: Uint8Array): DocumentFormat | null {
  const starts = (...values: number[]) =>
    values.every((value, index) => bytes[index] === value);
  const text = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  if (starts(137, 80, 78, 71, 13, 10, 26, 10)) return 'png';
  if (starts(255, 216, 255)) return 'jpeg';
  if (text(0, 2) === 'BM') return 'bmp';
  if (['GIF87a', 'GIF89a'].includes(text(0, 6))) return 'gif';
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'webp';
  if (text(0, 5) === '%PDF-') return 'pdf';
  if (starts(73, 73, 42, 0) || starts(77, 77, 0, 42)) return 'tiff';
  return null;
}
export function validateFormat(
  name: string,
  mime: string,
  bytes: Uint8Array,
): DocumentFormat {
  const ext = name.split('.').at(-1)?.toLowerCase() ?? '';
  const expected = extensions[ext];
  if (!expected)
    throw new Error(
      '지원하지 않는 확장자입니다. PNG, JPEG, BMP, GIF, WEBP, PDF, TIFF를 선택하세요.',
    );
  const actual = detectSignature(bytes);
  if (!actual)
    throw new Error(
      '파일 헤더를 확인할 수 없습니다. 손상되었거나 지원하지 않는 파일입니다.',
    );
  if (actual !== expected)
    throw new Error('파일 확장자와 실제 형식이 일치하지 않습니다.');
  if (mime && mime !== 'application/octet-stream' && mimeTypes[mime] !== actual)
    throw new Error('파일 MIME 형식과 실제 형식이 일치하지 않습니다.');
  return actual;
}
export async function inspectFile(file: File, signal: AbortSignal) {
  checkAbort(signal);
  if (!file.size) throw new Error('빈 파일은 열 수 없습니다.');
  if (file.size > MAX_FILE_BYTES)
    throw new Error('파일당 최대 크기는 100MB입니다.');
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  checkAbort(signal);
  return validateFormat(file.name, file.type, bytes);
}
