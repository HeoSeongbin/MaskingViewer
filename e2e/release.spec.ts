import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { PDFDocument, PDFName, PDFDict, PDFRawStream } from 'pdf-lib';
import UTIF from 'utif';
import { createFixtures } from '../scripts/fixtures.mjs';
const fixtures = path.resolve('test-results/release-fixtures');
test.use({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
test.beforeAll(async () => createFixtures(fixtures));
async function capture(page: Page, name: string) {
  if (process.env.CAPTURE_PHASE7 !== '1') return;
  await mkdir('docs/screenshots/release', { recursive: true });
  await page.screenshot({
    path: `docs/screenshots/release/${name}.png`,
    scale: 'css',
  });
}
async function open(page: Page, name: string) {
  await page
    .getByLabel('문서 파일 선택')
    .setInputFiles(path.join(fixtures, name));
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-label',
    `${name} 1페이지 미리보기`,
  );
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-busy',
    'false',
  );
}
async function mask(
  page: Page,
  width: number,
  height: number,
  region = { x: 10, y: 10, width: 20, height: 15 },
) {
  await page.getByRole('button', { name: '100%', exact: true }).click();
  const rect = (await page.locator('.document-stage').boundingBox())!;
  await page
    .getByRole('button', { name: '사각형 마스킹', exact: true })
    .click();
  const x = rect.x + (rect.width - width) / 2,
    y = rect.y + (rect.height - height) / 2;
  await page.mouse.move(x + region.x, y + region.y);
  await page.mouse.down();
  await page.mouse.move(
    x + region.x + region.width,
    y + region.y + region.height,
    { steps: 4 },
  );
  await page.mouse.up();
  await expect(page.getByLabel('마스킹 x', { exact: true })).toHaveValue(
    String(region.x),
  );
}
async function download(page: Page, format: string, all = false) {
  await page.getByRole('button', { name: '다운로드', exact: true }).click();
  await page.getByLabel('출력 형식').selectOption(format);
  await page
    .getByLabel('출력 페이지 범위')
    .selectOption(all ? 'all' : 'current');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '검증 후 다운로드' }).click();
  const result = await pending;
  await expect(
    page.getByRole('status').filter({ hasText: '생성 및 검증 완료' }),
  ).toBeVisible();
  return {
    name: result.suggestedFilename(),
    bytes: await readFile((await result.path())!),
  };
}
test('release identity, local privacy, permanent PNG and reopening work on the served site', async ({
  page,
  request,
}, testInfo) => {
  const failures: string[] = [],
    writes: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  page.on('request', (request) => {
    if (
      request.url().startsWith('http') &&
      !['GET', 'HEAD'].includes(request.method())
    )
      writes.push(`${request.method()} ${request.url()}`);
  });
  await page.goto('./');
  await expect(page.getByRole('banner')).toContainText('브라우저 로컬 처리');
  await expect(page.getByRole('contentinfo')).toContainText('v0.3.0');
  await capture(page, 'welcome');
  const identityResponse = await request.get('build-info.json', {
    headers: { 'Cache-Control': 'no-cache' },
  });
  expect(identityResponse.ok()).toBe(true);
  const identity = (await identityResponse.json()) as {
    version: string;
    revision: string;
    dirty: boolean;
    basePath: string;
  };
  expect(identity.version).toBe('0.3.0');
  expect(identity.revision).toMatch(/^[a-f0-9]{40}$/);
  if (process.env.EXPECTED_REVISION) {
    expect(identity.revision).toBe(process.env.EXPECTED_REVISION);
    expect(identity.dirty).toBe(false);
  }
  await testInfo.attach('served-build.json', {
    body: JSON.stringify(identity, null, 2),
    contentType: 'application/json',
  });
  await open(page, 'quadrants.png');
  await mask(page, 100, 60);
  await page.getByRole('button', { name: '오른쪽 90°', exact: true }).click();
  await page.getByRole('button', { name: '좌우 반전', exact: true }).click();
  await page.getByRole('button', { name: '색상 반전', exact: true }).click();
  const result = await download(page, 'png');
  expect(result.name).toBe('quadrants_masked.png');
  const image = await loadImage(result.bytes),
    canvas = createCanvas(image.width, image.height),
    context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  expect([image.width, image.height]).toEqual([60, 100]);
  expect([...context.getImageData(15, 15, 1, 1).data]).toEqual([0, 0, 0, 255]);
  expect([...context.getImageData(5, 5, 1, 1).data]).toEqual([
    0, 255, 255, 255,
  ]);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByLabel('문서 파일 선택').setInputFiles({
    name: result.name,
    mimeType: 'image/png',
    buffer: result.bytes,
  });
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-label',
    `${result.name} 1페이지 미리보기`,
  );
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  expect(failures).toEqual([]);
  expect(writes).toEqual([]);
});
test('served PDF worker and multi-page image PDF export preserve rotated masking and remove text', async ({
  page,
}) => {
  await page.goto('./');
  await open(page, 'pages.pdf');
  await mask(page, 320, 400, { x: 40, y: 100, width: 240, height: 100 });
  await capture(page, 'editor-light');
  await page.getByRole('button', { name: '다크 모드로 변경' }).click();
  await capture(page, 'editor-dark');
  await page.getByRole('button', { name: '3페이지 선택', exact: true }).click();
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-label',
    'pages.pdf 3페이지 미리보기',
  );
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await mask(page, 400, 320);
  await page.getByRole('button', { name: '오른쪽 90°', exact: true }).click();
  await page.getByRole('button', { name: '좌우 반전', exact: true }).click();
  const result = await download(page, 'pdf', true);
  await capture(page, 'download');
  const pdf = await PDFDocument.load(result.bytes);
  expect(pdf.getPageCount()).toBe(3);
  const third = pdf.getPages()[2]!;
  expect([third.getWidth(), third.getHeight()]).toEqual([320, 400]);
  const resources = third.node.Resources()!;
  expect(resources.lookup(PDFName.of('Font'), PDFDict).keys()).toHaveLength(0);
  const object = pdf.context.lookup(
    resources.lookup(PDFName.of('XObject'), PDFDict).values()[0]!,
  );
  expect(object).toBeInstanceOf(PDFRawStream);
  const pixels = inflateSync((object as PDFRawStream).getContents());
  const offset = (31 * 667 + 31) * 3;
  expect([...pixels.slice(offset, offset + 3)]).toEqual([0, 0, 0]);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByLabel('문서 파일 선택').setInputFiles({
    name: result.name,
    mimeType: 'application/pdf',
    buffer: result.bytes,
  });
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-label',
    `${result.name} 1페이지 미리보기`,
  );
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-busy',
    'false',
  );
});
test('served TIFF worker, multi-page TIFF download and mobile reupload work', async ({
  page,
}) => {
  await page.goto('./');
  await open(page, 'pages-8.tif');
  await mask(page, 40, 30);
  await page.getByRole('button', { name: '3페이지 선택', exact: true }).click();
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  const result = await download(page, 'tiff', true),
    buffer = new Uint8Array(result.bytes).buffer;
  const pages = UTIF.decode(buffer);
  expect(pages).toHaveLength(3);
  UTIF.decodeImage(buffer, pages[0]!);
  expect([
    ...UTIF.toRGBA8(pages[0]!).slice(
      (15 * 40 + 15) * 4,
      (15 * 40 + 15) * 4 + 4,
    ),
  ]).toEqual([0, 0, 0, 255]);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByLabel('문서 파일 선택').setInputFiles({
    name: result.name,
    mimeType: 'image/tiff',
    buffer: result.bytes,
  });
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-label',
    `${result.name} 1페이지 미리보기`,
  );
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '다운로드', exact: true }).click();
  await capture(page, 'mobile');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
