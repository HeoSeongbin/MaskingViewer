export type DocumentFormat =
  'png' | 'jpeg' | 'bmp' | 'gif' | 'webp' | 'pdf' | 'tiff';
export interface PageMetadata {
  width: number;
  height: number;
  unit: 'px' | 'pt';
  rotation: number;
}
export interface DocumentModel {
  id: string;
  name: string;
  size: number;
  format: DocumentFormat;
  pageCount: number;
  currentPage: number;
  notice?: string;
}
export interface DocumentAdapter {
  pageCount: number;
  notice?: string;
  getPageMetadata(index: number, signal: AbortSignal): Promise<PageMetadata>;
  renderPage(
    index: number,
    maxEdge: number,
    signal: AbortSignal,
    dpi?: number,
  ): Promise<HTMLCanvasElement>;
  dispose(): Promise<void>;
}
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_PIXELS = 16_000_000;
export const MAX_PAGES = 5000;
export function assertDimensions(width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 16384 ||
    height > 16384 ||
    width * height > MAX_PIXELS
  ) {
    throw new Error(
      '페이지 크기가 안전한 처리 한도(1,600만 픽셀 / 한 변 16,384)를 초과하거나 잘못되었습니다.',
    );
  }
}
export function assertPage(index: number, count: number) {
  if (!Number.isInteger(index) || index < 0 || index >= count)
    throw new Error('페이지 범위를 벗어났습니다.');
}
export function abortError() {
  return new DOMException('작업이 취소되었습니다.', 'AbortError');
}
export function checkAbort(signal: AbortSignal) {
  if (signal.aborted) throw abortError();
}
export function previewSize(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
export function makeCanvas(width: number, height: number) {
  assertDimensions(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
export function context2d(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context)
    throw new Error('이 브라우저에서는 Canvas를 사용할 수 없습니다.');
  return context;
}
