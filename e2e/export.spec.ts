import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import {
  createCanvas,
  loadImage,
  DOMMatrix,
  ImageData,
  Path2D,
} from '@napi-rs/canvas';
import { PDFDocument, PDFName, PDFDict, PDFRawStream } from 'pdf-lib';
import JSZip from 'jszip';
import UTIF from 'utif';
import { createFixtures } from '../scripts/fixtures.mjs';
const fixtures = path.resolve('test-results/export-fixtures');
test.use({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
test.beforeAll(async () => {
  await createFixtures(fixtures);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([100, 80]);
  page.drawText('SECRET-316', { x: 10, y: 40, size: 12 });
  page.node.set(
    PDFName.of('Annots'),
    pdf.context.obj([
      {
        Type: 'Annot',
        Subtype: 'Text',
        Rect: [0, 0, 5, 5],
        Contents: 'SECRET-ANNOTATION',
      },
    ]),
  );
  await pdf.attach(new TextEncoder().encode('SECRET-ATTACHMENT'), 'secret.txt');
  pdf.setTitle('SECRET-METADATA');
  const group = pdf.context.register(
    pdf.context.obj({ Type: 'OCG', Name: 'SECRET-HIDDEN-LAYER' }),
  );
  pdf.catalog.set(
    PDFName.of('OCProperties'),
    pdf.context.obj({ OCGs: [group], D: { OFF: [group] } }),
  );
  await writeFile(path.join(fixtures, 'secret.pdf'), await pdf.save());
});
async function open(page: Page, name: string) {
  await page.goto('./');
  await page
    .getByLabel('문서 파일 선택')
    .setInputFiles(path.join(fixtures, name));
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await page.getByRole('button', { name: '100%', exact: true }).click();
}
async function mask(
  page: Page,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const rect = (await page.locator('.document-stage').boundingBox())!;
  await page
    .getByRole('button', { name: '사각형 마스킹', exact: true })
    .click();
  const left = rect.x + (rect.width - width) / 2,
    top = rect.y + (rect.height - height) / 2;
  await page.mouse.move(left + x, top + y);
  await page.mouse.down();
  await page.mouse.move(left + x + w, top + y + h, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByLabel('마스킹 x', { exact: true })).toHaveValue(
    String(x),
  );
}
async function download(page: Page, format: string, all = false, dpi = '150') {
  await page.getByRole('button', { name: '다운로드', exact: true }).click();
  await page.getByLabel('출력 형식').selectOption(format);
  await page
    .getByLabel('출력 페이지 범위')
    .selectOption(all ? 'all' : 'current');
  await page.getByLabel('출력 DPI').selectOption(dpi);
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: '검증 후 다운로드' }).click();
  const result = await promise;
  const file = (await result.path())!;
  await expect(
    page.getByRole('status').filter({ hasText: '생성 및 검증 완료' }),
  ).toBeVisible();
  return { bytes: await readFile(file), name: result.suggestedFilename() };
}
async function pixels(bytes: Uint8Array) {
  const image = await loadImage(Buffer.from(bytes));
  const canvas = createCanvas(image.width, image.height),
    ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  return {
    width: image.width,
    height: image.height,
    data: ctx.getImageData(0, 0, image.width, image.height).data,
  };
}
test('PNG/JPEG downloads replace sensitive pixels, include hidden masks and reopen', async ({
  page,
}) => {
  await open(page, 'quadrants.png');
  await mask(page, 100, 60, 10, 10, 20, 15);
  await page.getByRole('button', { name: '마스킹 숨기기' }).click();
  const png = await download(page, 'png');
  expect(png.name).toBe('quadrants_masked.png');
  const decoded = await pixels(png.bytes);
  expect([decoded.width, decoded.height]).toEqual([100, 60]);
  expect([
    ...decoded.data.slice((15 * 100 + 15) * 4, (15 * 100 + 15) * 4 + 4),
  ]).toEqual([0, 0, 0, 255]);
  expect([...decoded.data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  const jpeg = await download(page, 'jpeg');
  const jpg = await pixels(jpeg.bytes);
  for (const value of jpg.data.slice(
    (15 * 100 + 15) * 4,
    (15 * 100 + 15) * 4 + 3,
  ))
    expect(value).toBeLessThan(8);
  await page.getByLabel('문서 파일 선택').setInputFiles({
    name: png.name,
    mimeType: 'image/png',
    buffer: png.bytes,
  });
  await expect(page.locator('.viewer-toolbar')).toContainText(png.name);
});
test('rotation, flips and colors are baked into TIFF pixels and ordered multi-page ZIP', async ({
  page,
}) => {
  await open(page, 'quadrants.png');
  await mask(page, 100, 60, 10, 10, 20, 15);
  await page.getByRole('button', { name: '오른쪽 90°', exact: true }).click();
  await page.getByRole('button', { name: '좌우 반전', exact: true }).click();
  await page.getByRole('button', { name: '색상 반전', exact: true }).click();
  const tiff = await download(page, 'tiff');
  const buffer = new Uint8Array(tiff.bytes).buffer,
    ifds = UTIF.decode(buffer);
  UTIF.decodeImage(buffer, ifds[0]!);
  expect([ifds[0]!.width, ifds[0]!.height]).toEqual([60, 100]);
  const data = UTIF.toRGBA8(ifds[0]!);
  expect([...data.slice((5 * 60 + 5) * 4, (5 * 60 + 5) * 4 + 4)]).toEqual([
    0, 255, 255, 255,
  ]);
  expect([...data.slice((15 * 60 + 15) * 4, (15 * 60 + 15) * 4 + 4)]).toEqual([
    0, 0, 0, 255,
  ]);
  await open(page, 'pages.pdf');
  const zip = await download(page, 'png', true);
  expect(zip.name).toBe('pages_masked.zip');
  const archive = await JSZip.loadAsync(zip.bytes, { checkCRC32: true });
  expect(Object.keys(archive.files)).toEqual([
    'page_0001.png',
    'page_0002.png',
    'page_0003.png',
  ]);
  const first = await pixels(
    await archive.file('page_0001.png')!.async('uint8array'),
  );
  const third = await pixels(
    await archive.file('page_0003.png')!.async('uint8array'),
  );
  expect([first.width, first.height]).toEqual([667, 834]);
  expect([third.width, third.height]).toEqual([834, 667]);
});
test('PDF export removes searchable text, annotation, attachment and metadata and validates extracted RGB', async ({
  page,
}) => {
  await open(page, 'secret.pdf');
  await mask(page, 100, 80, 5, 15, 90, 50);
  const result = await download(page, 'pdf', false, '300');
  if (process.env.CAPTURE_PHASE5 === '1')
    await page.screenshot({
      path: path.resolve('docs/screenshots/phase-5.png'),
      scale: 'css',
    });
  const pdf = await PDFDocument.load(result.bytes);
  expect(pdf.getTitle()).not.toBe('SECRET-METADATA');
  expect(pdf.catalog.has(PDFName.of('Names'))).toBe(false);
  expect(pdf.catalog.has(PDFName.of('OCProperties'))).toBe(false);
  const outputPage = pdf.getPages()[0]!;
  expect(outputPage.node.has(PDFName.of('Annots'))).toBe(false);
  const images = outputPage.node
    .Resources()!
    .lookup(PDFName.of('XObject'), PDFDict);
  expect(images.keys()).toHaveLength(1);
  const image = pdf.context.lookup(images.values()[0]!);
  expect(image).toBeInstanceOf(PDFRawStream);
  const rgb = inflateSync((image as PDFRawStream).getContents());
  const width = 417;
  expect([
    ...rgb.slice((150 * width + 150) * 3, (150 * width + 150) * 3 + 3),
  ]).toEqual([0, 0, 0]);
  Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const originalTask = pdfjs.getDocument({
    data: new Uint8Array(await readFile(path.join(fixtures, 'secret.pdf'))),
    useSystemFonts: true,
  });
  try {
    const original = await originalTask.promise;
    const text = await (await original.getPage(1)).getTextContent();
    expect(
      text.items.map((item) => ('str' in item ? item.str : '')).join(' '),
    ).toContain('SECRET-316');
    expect(await original.getAttachments()).not.toBeNull();
    expect(await (await original.getPage(1)).getAnnotations()).toHaveLength(1);
  } finally {
    await originalTask.destroy();
  }
  const task = pdfjs.getDocument({
    data: new Uint8Array(result.bytes),
    useSystemFonts: true,
  });
  try {
    const document = await task.promise;
    const text = await (await document.getPage(1)).getTextContent();
    expect(text.items).toHaveLength(0);
    expect(await document.getAttachments()).toBeNull();
    expect(await (await document.getPage(1)).getAnnotations()).toHaveLength(0);
  } finally {
    await task.destroy();
  }
});
test('multi-page PDF and TIFF preserve page order and can be loaded as new documents', async ({
  page,
}) => {
  await open(page, 'pages-1.tif');
  const tiff = await download(page, 'tiff', true);
  const buffer = new Uint8Array(tiff.bytes).buffer,
    ifds = UTIF.decode(buffer);
  expect(ifds).toHaveLength(3);
  ifds.forEach((ifd, i) => {
    UTIF.decodeImage(buffer, ifd);
    expect(UTIF.toRGBA8(ifd)[0]).toBe([40, 140, 230][i]);
  });
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  const result = await download(page, 'pdf', true);
  const pdf = await PDFDocument.load(result.bytes);
  expect(pdf.getPageCount()).toBe(3);
  pdf.getPages().forEach((page, i) => {
    expect(page.getWidth()).toBeCloseTo(i === 2 ? 14.4 : 19.2, 12);
    expect(page.getHeight()).toBeCloseTo(i === 2 ? 19.2 : 14.4, 12);
  });
  await page.getByLabel('문서 파일 선택').setInputFiles({
    name: result.name,
    mimeType: 'application/pdf',
    buffer: result.bytes,
  });
  await expect(page.locator('.viewer-toolbar')).toContainText(result.name);
  await expect(page.getByLabel('페이지 번호')).toHaveValue('1');
});
test('verification errors block download and cancellation can recover', async ({
  page,
}) => {
  await open(page, 'quadrants.png');
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.getByRole('button', { name: '다운로드', exact: true }).click();
  await page.evaluate(() => {
    const original = window.createImageBitmap.bind(window);
    window.createImageBitmap = (async (input: Blob) => {
      const bitmap = await original(input);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      context.fillStyle = '#000000';
      context.fillRect(0, 0, 1, 1);
      return original(canvas);
    }) as typeof createImageBitmap;
  });
  await page.getByRole('button', { name: '검증 후 다운로드' }).click();
  await expect(page.getByRole('alert')).toContainText('픽셀 검증에 실패');
  expect(downloads).toBe(0);
  await open(page, 'pages.pdf');
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    void page.route('**/assets/ExportPipeline-*.js', async (route) => {
      resolve();
      await held;
      await route.continue();
    });
  });
  await page.getByRole('button', { name: '다운로드', exact: true }).click();
  await page.getByRole('button', { name: '검증 후 다운로드' }).click();
  await entered;
  await page.getByRole('button', { name: '출력 취소', exact: true }).click();
  release();
  await expect(
    page.getByRole('status').filter({ hasText: '출력을 취소했습니다.' }),
  ).toBeVisible();
  expect(downloads).toBe(0);
  await page.unroute('**/assets/ExportPipeline-*.js');
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  const result = await download(page, 'pdf');
  expect(result.name).toBe('pages_masked.pdf');
});
test('mobile dark export panel stays in viewport and downloads custom opaque masks', async ({
  page,
}) => {
  await open(page, 'quadrants.png');
  await mask(page, 100, 60, 10, 10, 20, 15);
  await page.getByLabel('마스킹 HEX').fill('#336699');
  await page.getByLabel('마스킹 HEX').press('Enter');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '다크 모드로 변경' }).click();
  const result = await download(page, 'png');
  const rect = (await page
    .getByRole('region', { name: '결과 다운로드' })
    .boundingBox())!;
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(390);
  expect(rect.y + rect.height).toBeLessThanOrEqual(844);
  const decoded = await pixels(result.bytes);
  expect([
    ...decoded.data.slice((15 * 100 + 15) * 4, (15 * 100 + 15) * 4 + 4),
  ]).toEqual([51, 102, 153, 255]);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('region', { name: '결과 다운로드' })).toHaveCount(
    0,
  );
});
