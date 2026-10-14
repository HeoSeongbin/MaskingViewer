import { abortError, checkAbort } from '../document/DocumentModel';
import type { OutputPixels } from './pixels';
import { composePixelsAsync } from './pixels';
import type { Size } from '../geometry/transformMatrix';
import type { PageEdit } from '../../stores/editStore';
import type { ExportPage, ExportFile } from './FinalizeExport';
import type { ExportFormat } from './ExportPipeline';
export interface ComposedPage {
  pixels: OutputPixels;
  blob?: Blob;
}
export function workerJob<T>(
  payload: object,
  transfers: Transferable[],
  signal: AbortSignal,
  timeoutMs = 60_000,
): Promise<T> {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(
        new URL('../../workers/export.worker.ts', import.meta.url),
        { type: 'module' },
      );
    } catch (reason) {
      reject(reason);
      return;
    }
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      worker.onmessage = worker.onerror = worker.onmessageerror = null;
      worker.terminate();
    };
    const fail = (error: unknown) => {
      cleanup();
      reject(error);
    };
    const abort = () => fail(abortError());
    const timer = setTimeout(
      () =>
        fail(
          new Error(
            '출력 Worker 처리 시간이 초과되었습니다. 페이지 범위나 DPI를 줄여 다시 시도하세요.',
          ),
        ),
      timeoutMs,
    );
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = () =>
      fail(new Error('출력 Worker 실행에 실패했습니다. 다시 시도하세요.'));
    worker.onmessageerror = () =>
      fail(new Error('출력 Worker 결과를 읽을 수 없습니다.'));
    worker.onmessage = (
      event: MessageEvent<{ result?: T; error?: string }>,
    ) => {
      if (event.data.error) fail(new Error(event.data.error));
      else if (event.data.result === undefined)
        fail(new Error('출력 Worker 결과가 없습니다.'));
      else {
        cleanup();
        resolve(event.data.result);
      }
    };
    try {
      worker.postMessage(payload, transfers);
    } catch (error) {
      fail(error);
    }
  });
}
export async function finishExport(
  pages: ExportPage[],
  files: ExportFile[],
  format: ExportFormat,
  signal: AbortSignal,
): Promise<{ bytes: Uint8Array; mime: string }> {
  if (typeof Worker === 'undefined') {
    const { finalizeExport } = await import('./FinalizeExport');
    return finalizeExport(pages, files, format, signal);
  }
  const buffers = [
    ...pages.flatMap((page) => [
      ...(page.pixels ? [page.pixels.data.buffer] : []),
      page.png.buffer,
    ]),
    ...files.map((file) => file.data.buffer),
  ];
  return workerJob(
    { operation: 'finalize', pages, files, format },
    [...new Set(buffers)] as ArrayBuffer[],
    signal,
  );
}
export async function composePage(
  source: OutputPixels,
  bounds: Size,
  edit: PageEdit,
  format: 'png' | 'jpeg' | 'tiff',
  signal: AbortSignal,
): Promise<ComposedPage> {
  if (typeof Worker === 'undefined') {
    if (source.width * source.height > 1_000_000)
      throw new Error(
        'Worker 미지원 환경에서는 출력 페이지를 100만 픽셀 이하로 제한합니다. Worker 지원 브라우저를 사용하세요.',
      );
    return { pixels: await composePixelsAsync(source, bounds, edit, signal) };
  }
  const buffer = source.data.buffer as ArrayBuffer;
  return workerJob<ComposedPage>(
    { operation: 'compose', source, bounds, edit, format },
    [buffer],
    signal,
  );
}
