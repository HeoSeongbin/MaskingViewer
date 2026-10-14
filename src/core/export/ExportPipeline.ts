import { pageRenderer } from '../document/PageRenderer';
import {
  assertDimensions,
  checkAbort,
  context2d,
  makeCanvas,
} from '../document/DocumentModel';
import type { DocumentModel } from '../document/DocumentModel';
import type { PageEdit } from '../../stores/editStore';
import { DEFAULT_EDIT, pageKey } from '../../stores/editStore';
import { equalPixelsAsync, rgbPixels } from './pixels';
import { fingerprint } from './fingerprint';
import type { ExportPage } from './FinalizeExport';
import { composePage, finishExport } from './ExportWorker';
import type { OutputPixels } from './pixels';
import { editGeometry } from '../geometry/coordinateTransform';
import { apply } from '../geometry/transformMatrix';
import type { Size } from '../geometry/transformMatrix';

export type ExportFormat = 'png' | 'jpeg' | 'pdf' | 'tiff';
export interface ExportOptions {
  format: ExportFormat;
  all: boolean;
  dpi: 150 | 300;
}
export const MAX_EXPORT_BYTES = 128 * 1024 * 1024;
export function outputName(
  name: string,
  options: ExportOptions,
  count: number,
) {
  const base =
    name
      .replace(/\.[^.]+$/, '')
      .replace(/[\\/:*?"<>|]/g, '_')
      .split('')
      .map((character) => (character.charCodeAt(0) < 32 ? '_' : character))
      .join('')
      .slice(0, 120) || 'document';
  return `${base}_masked.${count > 1 && (options.format === 'png' || options.format === 'jpeg') ? 'zip' : options.format === 'jpeg' ? 'jpg' : options.format === 'tiff' ? 'tif' : options.format}`;
}
async function imageBytes(
  pixels: OutputPixels,
  format: 'png' | 'jpeg',
  edit: PageEdit,
  bounds: Size,
  source: Size,
  encoded?: Blob,
  signal = new AbortController().signal,
) {
  const canvas = makeCanvas(pixels.width, pixels.height);
  try {
    if (!encoded)
      context2d(canvas).putImageData(
        new ImageData(
          new Uint8ClampedArray(pixels.data),
          pixels.width,
          pixels.height,
        ),
        0,
        0,
      );
    const blob =
      encoded ??
      (await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error('이미지 인코딩에 실패했습니다.')),
          `image/${format}`,
          0.98,
        ),
      ));
    if (blob.type !== `image/${format}`)
      throw new Error('이 브라우저는 선택한 출력 형식을 지원하지 않습니다.');
    const bitmap = await createImageBitmap(blob);
    try {
      if (bitmap.width !== pixels.width || bitmap.height !== pixels.height)
        throw new Error('출력 크기 검증 실패');
      context2d(canvas).clearRect(0, 0, canvas.width, canvas.height);
      context2d(canvas).drawImage(bitmap, 0, 0);
      const decoded = context2d(canvas).getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      if (format === 'png')
        await equalPixelsAsync({ ...pixels, data: decoded }, pixels, signal);
      else if (decoded.some((v, i) => i % 4 === 3 && v !== 255))
        throw new Error('JPEG 재디코딩 검증 실패');
      if (format === 'jpeg') {
        const geometry = editGeometry(source, edit);
        for (const mask of edit.masks) {
          const sx = source.width / bounds.width,
            sy = source.height / bounds.height;
          for (
            let y = Math.floor(mask.y * sy);
            y < Math.ceil((mask.y + mask.height) * sy);
            y++
          )
            for (
              let x = Math.floor(mask.x * sx);
              x < Math.ceil((mask.x + mask.width) * sx);
              x++
            ) {
              const point = apply(geometry.matrix, { x: x + 0.5, y: y + 0.5 });
              const offset =
                (Math.floor(point.y) * pixels.width + Math.floor(point.x)) * 4;
              for (let c = 0; c < 3; c++)
                if (
                  Math.abs(decoded[offset + c]! - pixels.data[offset + c]!) > 64
                )
                  throw new Error(
                    'JPEG 마스킹 픽셀 검증 실패. 무손실 PNG/PDF/TIFF로 출력하세요.',
                  );
            }
        }
      }
    } finally {
      bitmap.close();
    }
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    canvas.width = canvas.height = 0;
  }
}
async function runExport(
  document: DocumentModel,
  edits: Record<string, PageEdit>,
  options: ExportOptions,
  signal: AbortSignal,
  progress: (message: string) => void,
) {
  const indices = options.all
    ? Array.from({ length: document.pageCount }, (_, i) => i)
    : [document.currentPage];
  if (indices.length > 200)
    throw new Error('한 번에 최대 200페이지를 출력할 수 있습니다.');
  const pages: ExportPage[] = [];
  const files: { name: string; data: Uint8Array }[] = [];
  let retained = 0;
  for (const index of indices) {
    checkAbort(signal);
    progress(
      `페이지 ${indices.indexOf(index) + 1}/${indices.length} 처리 및 검증 중`,
    );
    const page = await pageRenderer.renderExport(
      document.id,
      index,
      options.dpi,
      signal,
      Math.min(
        Math.floor((MAX_EXPORT_BYTES - retained * 3) / 20),
        typeof Worker === 'undefined' ? 1_000_000 : 16_000_000,
      ),
    );
    try {
      assertDimensions(page.canvas.width, page.canvas.height);
      // At most one decoded page plus copies, and capped retained results.
      if (
        retained + page.canvas.width * page.canvas.height * 20 >
        MAX_EXPORT_BYTES
      )
        throw new Error(
          '출력 메모리 예산(128MiB)을 초과합니다. 현재 페이지만 또는 낮은 PDF DPI로 출력하세요.',
        );
      const edit = edits[pageKey(document.id, index)] ?? DEFAULT_EDIT;
      const source = {
        width: page.canvas.width,
        height: page.canvas.height,
        data: context2d(page.canvas).getImageData(
          0,
          0,
          page.canvas.width,
          page.canvas.height,
        ).data,
      };
      page.canvas.width = page.canvas.height = 0;
      const composed = await composePage(
        {
          ...source,
        },
        page.metadata,
        edit,
        options.format === 'jpeg'
          ? 'jpeg'
          : options.format === 'tiff'
            ? 'tiff'
            : 'png',
        signal,
      );
      const pixels = composed.pixels;
      checkAbort(signal);
      if (options.format === 'tiff') {
        pages.push({
          pixels,
          pixelWidth: pixels.width,
          pixelHeight: pixels.height,
          png: new Uint8Array(),
          width: 0,
          height: 0,
        });
        retained += pixels.data.byteLength;
      } else {
        const data = await imageBytes(
          pixels,
          options.format === 'jpeg' ? 'jpeg' : 'png',
          edit,
          page.metadata,
          { width: source.width, height: source.height },
          composed.blob,
          signal,
        );
        if (options.format === 'pdf') {
          const swap = edit.rotation % 180 !== 0;
          const factor = page.metadata.unit === 'pt' ? 1 : 72 / options.dpi;
          pages.push({
            pixelWidth: pixels.width,
            pixelHeight: pixels.height,
            rgbHash: await fingerprint(rgbPixels(pixels)),
            png: data,
            width: (swap ? page.metadata.height : page.metadata.width) * factor,
            height:
              (swap ? page.metadata.width : page.metadata.height) * factor,
          });
          retained += data.byteLength + 64;
        } else {
          files.push({
            name: `page_${String(index + 1).padStart(4, '0')}.${options.format === 'jpeg' ? 'jpg' : 'png'}`,
            data,
          });
          retained += data.byteLength;
        }
      }
      if (retained * 3 > MAX_EXPORT_BYTES)
        throw new Error(
          '전체 결과가 출력 메모리 예산을 초과합니다. 페이지 수를 줄이세요.',
        );
      if (typeof Worker === 'undefined' && retained > 8 * 1024 * 1024)
        throw new Error(
          'Worker 미지원 환경에서는 전체 출력 중간 결과를 8MiB 이하로 제한합니다.',
        );
    } finally {
      page.canvas.width = page.canvas.height = 0;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  checkAbort(signal);
  progress('파일 조립 및 최종 검증 중');
  const { bytes, mime } = await finishExport(
    pages,
    files,
    options.format,
    signal,
  );
  checkAbort(signal);
  if (bytes.byteLength * 3 > MAX_EXPORT_BYTES)
    throw new Error('최종 파일이 출력 메모리 예산을 초과합니다.');
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: mime }),
    name: outputName(document.name, options, indices.length),
  };
}
let exporting = false;
export async function exportDocument(...args: Parameters<typeof runExport>) {
  checkAbort(args[3]);
  if (exporting) throw new Error('다른 출력 작업이 종료된 뒤 다시 시도하세요.');
  exporting = true;
  try {
    return await runExport(...args);
  } finally {
    exporting = false;
  }
}
