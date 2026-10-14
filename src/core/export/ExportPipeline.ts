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
import { composePixels, equalPixels, rgbPixels } from './pixels';
import type { OutputPixels } from './pixels';
import { editGeometry } from '../geometry/coordinateTransform';
import { apply } from '../geometry/transformMatrix';
import type { Size } from '../geometry/transformMatrix';
import { encodeTiff } from './TiffExporter';

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
) {
  const canvas = makeCanvas(pixels.width, pixels.height);
  try {
    context2d(canvas).putImageData(
      new ImageData(
        new Uint8ClampedArray(pixels.data),
        pixels.width,
        pixels.height,
      ),
      0,
      0,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error('이미지 인코딩에 실패했습니다.')),
        `image/${format}`,
        0.98,
      ),
    );
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
      if (format === 'png') equalPixels({ ...pixels, data: decoded }, pixels);
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
async function verifyTiff(bytes: Uint8Array, pages: OutputPixels[]) {
  const { default: UTIF } = await import('utif');
  const buffer = new Uint8Array(bytes).buffer;
  const ifds = UTIF.decode(buffer);
  if (ifds.length !== pages.length) throw new Error('TIFF 페이지 검증 실패');
  ifds.forEach((ifd, i) => {
    UTIF.decodeImage(buffer, ifd);
    equalPixels(
      {
        width: ifd.width,
        height: ifd.height,
        data: new Uint8ClampedArray(UTIF.toRGBA8(ifd)),
      },
      pages[i]!,
    );
  });
}
async function makePdf(
  pages: {
    pixels: OutputPixels;
    png: Uint8Array;
    width: number;
    height: number;
  }[],
  signal: AbortSignal,
) {
  const { PDFDocument, PDFName, PDFRawStream, PDFDict } =
    await import('pdf-lib');
  const pdf = await PDFDocument.create();
  for (const page of pages) {
    checkAbort(signal);
    const image = await pdf.embedPng(page.png);
    pdf
      .addPage([page.width, page.height])
      .drawImage(image, { x: 0, y: 0, width: page.width, height: page.height });
  }
  // pdf-lib normalizes new pages with an empty Annots array; omit it entirely.
  for (const page of pdf.getPages()) page.node.delete(PDFName.of('Annots'));
  const bytes = await pdf.save({ useObjectStreams: false });
  const decoded = await PDFDocument.load(bytes, { updateMetadata: false });
  for (const key of [
    'Names',
    'AcroForm',
    'OpenAction',
    'AA',
    'Metadata',
    'OCProperties',
  ])
    if (decoded.catalog.has(PDFName.of(key)))
      throw new Error('PDF 카탈로그 보안 검증 실패');
  if (decoded.getPageCount() !== pages.length)
    throw new Error('PDF 페이지 검증 실패');
  const { default: pako } = await import('pako');
  decoded.getPages().forEach((page, i) => {
    checkAbort(signal);
    for (const key of ['Annots', 'AA', 'Metadata'])
      if (page.node.has(PDFName.of(key)))
        throw new Error('PDF 페이지 보안 검증 실패');
    const resources = page.node.Resources();
    if (
      resources?.has(PDFName.of('Font')) &&
      resources.lookup(PDFName.of('Font'), PDFDict).keys().length !== 0
    )
      throw new Error('PDF 텍스트 리소스 검증 실패');
    const objects = resources?.lookup(PDFName.of('XObject'), PDFDict);
    if (!objects || objects.keys().length !== 1)
      throw new Error('PDF 이미지 구조 검증 실패');
    const image = decoded.context.lookup(objects.values()[0]!);
    if (!(image instanceof PDFRawStream))
      throw new Error('PDF 이미지 스트림 검증 실패');
    if (
      image.dict.get(PDFName.of('Subtype'))?.toString() !== '/Image' ||
      image.dict.has(PDFName.of('SMask')) ||
      image.dict.get(PDFName.of('Width'))?.toString() !==
        String(pages[i]!.pixels.width) ||
      image.dict.get(PDFName.of('Height'))?.toString() !==
        String(pages[i]!.pixels.height) ||
      image.dict.get(PDFName.of('ColorSpace'))?.toString() !== '/DeviceRGB' ||
      image.dict.get(PDFName.of('BitsPerComponent'))?.toString() !== '8'
    )
      throw new Error('PDF 이미지 검증 실패');
    const actual = pako.inflate(image.getContents());
    const expected = rgbPixels(pages[i]!.pixels);
    if (
      actual.length !== expected.length ||
      actual.some((value, n) => value !== expected[n])
    )
      throw new Error('PDF 추출 이미지 픽셀 검증 실패');
  });
  return bytes;
}
export async function exportDocument(
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
  const pages: {
    pixels: OutputPixels;
    png: Uint8Array;
    width: number;
    height: number;
  }[] = [];
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
      Math.floor((MAX_EXPORT_BYTES - retained * 3) / 20),
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
      const pixels = composePixels(
        {
          width: page.canvas.width,
          height: page.canvas.height,
          data: context2d(page.canvas).getImageData(
            0,
            0,
            page.canvas.width,
            page.canvas.height,
          ).data,
        },
        page.metadata,
        edit,
      );
      checkAbort(signal);
      if (options.format === 'tiff') {
        pages.push({ pixels, png: new Uint8Array(), width: 0, height: 0 });
        retained += pixels.data.byteLength;
      } else {
        const data = await imageBytes(
          pixels,
          options.format === 'jpeg' ? 'jpeg' : 'png',
          edit,
          page.metadata,
          { width: page.canvas.width, height: page.canvas.height },
        );
        if (options.format === 'pdf') {
          const swap = edit.rotation % 180 !== 0;
          const factor = page.metadata.unit === 'pt' ? 1 : 72 / options.dpi;
          pages.push({
            pixels,
            png: data,
            width: (swap ? page.metadata.height : page.metadata.width) * factor,
            height:
              (swap ? page.metadata.width : page.metadata.height) * factor,
          });
          retained += pixels.data.byteLength + data.byteLength;
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
    } finally {
      page.canvas.width = page.canvas.height = 0;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  checkAbort(signal);
  progress('파일 조립 및 최종 검증 중');
  let bytes: Uint8Array;
  let mime: string;
  if (options.format === 'pdf') {
    bytes = await makePdf(pages, signal);
    mime = 'application/pdf';
  } else if (options.format === 'tiff') {
    bytes = encodeTiff(pages.map((page) => page.pixels));
    await verifyTiff(
      bytes,
      pages.map((page) => page.pixels),
    );
    mime = 'image/tiff';
  } else if (files.length > 1) {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    files.forEach((file) => zip.file(file.name, file.data));
    bytes = await zip.generateAsync({
      type: 'uint8array',
      compression: 'STORE',
    });
    const decoded = await JSZip.loadAsync(bytes, { checkCRC32: true });
    if (Object.keys(decoded.files).length !== files.length)
      throw new Error('ZIP 항목 검증 실패');
    for (const file of files) {
      checkAbort(signal);
      const data = await decoded.file(file.name)?.async('uint8array');
      if (
        !data ||
        data.length !== file.data.length ||
        data.some((value, i) => value !== file.data[i])
      )
        throw new Error('ZIP 이미지 검증 실패');
    }
    mime = 'application/zip';
  } else {
    bytes = files[0]!.data;
    mime = `image/${options.format}`;
  }
  checkAbort(signal);
  if (bytes.byteLength * 3 > MAX_EXPORT_BYTES)
    throw new Error('최종 파일이 출력 메모리 예산을 초과합니다.');
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: mime }),
    name: outputName(document.name, options, indices.length),
  };
}
