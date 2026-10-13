import {
  abortError,
  assertPage,
  checkAbort,
  context2d,
  makeCanvas,
  previewSize,
} from '../../core/document/DocumentModel';
import type { DocumentAdapter } from '../../core/document/DocumentModel';
import type { TiffPage } from './tiffValidation';

interface WorkerResult {
  id: number;
  pages?: TiffPage[];
  pixels?: ArrayBuffer;
  error?: string;
}
export async function openTiff(
  file: File,
  signal: AbortSignal,
): Promise<DocumentAdapter> {
  if (typeof Worker === 'undefined')
    throw new Error(
      'TIFF 처리를 위해 Web Worker를 지원하는 브라우저가 필요합니다.',
    );
  let worker: Worker | null = null;
  let sequence = 0;
  let disposed = false;
  const terminate = () => {
    worker?.terminate();
    worker = null;
  };
  const request = (
    payload: { buffer?: ArrayBuffer; index?: number },
    cancel: AbortSignal,
  ): Promise<WorkerResult> => {
    checkAbort(cancel);
    if (!worker || disposed) return Promise.reject(abortError());
    const current = worker;
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        terminate();
        cleanup();
        reject(new Error('TIFF 처리 시간이 초과되었습니다.'));
      }, 30_000);
      const cleanup = () => {
        clearTimeout(timeout);
        cancel.removeEventListener('abort', abort);
        current.removeEventListener('message', message);
        current.removeEventListener('error', failed);
      };
      const abort = () => {
        terminate();
        cleanup();
        reject(abortError());
      };
      const failed = () => {
        terminate();
        cleanup();
        reject(new Error('TIFF Worker를 실행할 수 없습니다.'));
      };
      const message = (event: MessageEvent<WorkerResult>) => {
        if (event.data.id !== id) return;
        cleanup();
        if (event.data.error) reject(new Error(event.data.error));
        else resolve(event.data);
      };
      cancel.addEventListener('abort', abort, { once: true });
      current.addEventListener('message', message);
      current.addEventListener('error', failed);
      current.postMessage(
        { id, ...payload },
        payload.buffer ? [payload.buffer] : [],
      );
    });
  };
  const start = async (cancel: AbortSignal) => {
    checkAbort(cancel);
    if (disposed) throw abortError();
    const buffer = await file.arrayBuffer();
    checkAbort(cancel);
    worker = new Worker(
      new URL('../../workers/tiff.worker.ts', import.meta.url),
      { type: 'module' },
    );
    return request({ buffer }, cancel);
  };
  let pages: TiffPage[];
  try {
    const result = await start(signal);
    if (!result.pages) throw new Error('TIFF 페이지 정보가 없습니다.');
    pages = result.pages;
  } catch (error) {
    terminate();
    throw error;
  }
  return {
    pageCount: pages.length,
    async getPageMetadata(index, cancel) {
      assertPage(index, pages.length);
      checkAbort(cancel);
      if (disposed) throw abortError();
      const page = pages[index]!;
      const swap = page.orientation >= 5;
      return {
        width: swap ? page.height : page.width,
        height: swap ? page.width : page.height,
        unit: 'px',
        rotation: 0,
      };
    },
    async renderPage(index, maxEdge, cancel) {
      assertPage(index, pages.length);
      checkAbort(cancel);
      if (disposed) throw abortError();
      if (!worker) await start(cancel);
      const result = await request({ index }, cancel);
      checkAbort(cancel);
      if (!result.pixels) throw new Error('TIFF 픽셀 정보가 없습니다.');
      const page = pages[index]!;
      const raw = makeCanvas(page.width, page.height);
      context2d(raw).putImageData(
        new ImageData(
          new Uint8ClampedArray(result.pixels),
          page.width,
          page.height,
        ),
        0,
        0,
      );
      const swap = page.orientation >= 5;
      const w = swap ? page.height : page.width;
      const h = swap ? page.width : page.height;
      const size = previewSize(w, h, maxEdge);
      const canvas = makeCanvas(size.width, size.height);
      const context = context2d(canvas);
      context.scale(size.width / w, size.height / h);
      const matrices: number[][] = [
        [1, 0, 0, 1, 0, 0],
        [-1, 0, 0, 1, w, 0],
        [-1, 0, 0, -1, w, h],
        [1, 0, 0, -1, 0, h],
        [0, 1, 1, 0, 0, 0],
        [0, 1, -1, 0, w, 0],
        [0, -1, -1, 0, w, h],
        [0, -1, 1, 0, 0, h],
      ];
      const matrix = matrices[page.orientation - 1]!;
      context.transform(
        matrix[0]!,
        matrix[1]!,
        matrix[2]!,
        matrix[3]!,
        matrix[4]!,
        matrix[5]!,
      );
      context.drawImage(raw, 0, 0);
      raw.width = 0;
      raw.height = 0;
      return canvas;
    },
    async dispose() {
      disposed = true;
      terminate();
    },
  };
}
