import { checkAbort } from '../document/DocumentModel';
import { equalPixels } from './pixels';
import { fingerprint } from './fingerprint';
import type { OutputPixels } from './pixels';
import { encodeTiff } from './TiffExporter';
import type { ExportFormat } from './ExportPipeline';
export interface ExportPage {
  pixels?: OutputPixels;
  pixelWidth: number;
  pixelHeight: number;
  rgbHash?: string;
  png: Uint8Array;
  width: number;
  height: number;
}
export interface ExportFile {
  name: string;
  data: Uint8Array;
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
async function makePdf(pages: ExportPage[], signal: AbortSignal) {
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
  for (const [i, page] of decoded.getPages().entries()) {
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
        String(pages[i]!.pixelWidth) ||
      image.dict.get(PDFName.of('Height'))?.toString() !==
        String(pages[i]!.pixelHeight) ||
      image.dict.get(PDFName.of('ColorSpace'))?.toString() !== '/DeviceRGB' ||
      image.dict.get(PDFName.of('BitsPerComponent'))?.toString() !== '8'
    )
      throw new Error('PDF 이미지 검증 실패');
    const actual = pako.inflate(image.getContents());
    if (
      actual.length !== pages[i]!.pixelWidth * pages[i]!.pixelHeight * 3 ||
      (await fingerprint(actual)) !== pages[i]!.rgbHash
    )
      throw new Error('PDF 추출 이미지 픽셀 검증 실패');
  }
  return bytes;
}

export async function finalizeExport(
  pages: ExportPage[],
  files: ExportFile[],
  format: ExportFormat,
  signal: AbortSignal,
) {
  let bytes: Uint8Array;
  let mime: string;
  if (format === 'pdf') {
    bytes = await makePdf(pages, signal);
    mime = 'application/pdf';
  } else if (format === 'tiff') {
    bytes = encodeTiff(pages.map((page) => page.pixels!));
    await verifyTiff(
      bytes,
      pages.map((page) => page.pixels!),
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
    mime = `image/${format}`;
  }

  checkAbort(signal);
  return { bytes, mime };
}
