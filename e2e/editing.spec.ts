import { test, expect } from '@playwright/test';
import path from 'node:path';
import { createFixtures } from '../scripts/fixtures.mjs';
const fixtures = path.resolve('test-results/edit-fixtures');
test.beforeAll(async () => createFixtures(fixtures));
test.beforeEach(async ({ page }) => {
  await page.goto('./');
});
test('compound geometry and worker colors produce expected asymmetric pixels at HiDPI', async ({
  browser,
}) => {
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await page.goto(
    'http://127.0.0.1:4183' + (process.env.VITE_BASE_PATH || '/MaskingViewer/'),
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page
    .getByLabel('문서 파일 선택')
    .setInputFiles(path.join(fixtures, 'quadrants.png'));
  const stage = page.locator('.document-stage');
  await expect(stage).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: '100%', exact: true }).click();
  const sample = async (x: number, y: number) =>
    page.locator('.document-stage canvas').evaluate(
      (canvas: HTMLCanvasElement, point) => {
        const rect = canvas.getBoundingClientRect();
        const scale = canvas.width / rect.width;
        return Array.from(
          canvas
            .getContext('2d')!
            .getImageData(
              Math.round((rect.width / 2 + point.x) * scale),
              Math.round((rect.height / 2 + point.y) * scale),
              1,
              1,
            ).data,
        );
      },
      { x, y },
    );
  expect(await sample(-25, -15)).toEqual([255, 0, 0, 255]);
  await page.getByRole('button', { name: '오른쪽 90°' }).click();
  expect(await sample(15, -25)).toEqual([255, 0, 0, 255]);
  await page.getByRole('button', { name: '좌우 반전', exact: true }).click();
  expect(await sample(-15, -25)).toEqual([255, 0, 0, 255]);
  await page.getByRole('button', { name: '상하 반전', exact: true }).click();
  expect(await sample(-15, 25)).toEqual([255, 0, 0, 255]);
  await page.getByRole('button', { name: '색상 반전', exact: true }).click();
  await expect(stage).toHaveAttribute('aria-busy', 'false');
  expect(await sample(-15, 25)).toEqual([0, 255, 255, 255]);
  await page.getByLabel('색상 모드', { exact: true }).selectOption('grayscale');
  await expect(stage).toHaveAttribute('aria-busy', 'false');
  expect(await sample(-15, 25)).toEqual([201, 201, 201, 255]);
  await page.getByLabel('색상 모드', { exact: true }).selectOption('binary');
  await expect(stage).toHaveAttribute('aria-busy', 'false');
  expect(await sample(-15, 25)).toEqual([255, 255, 255, 255]);
  await page.getByRole('button', { name: '전체 편집 복원' }).click();
  await expect(stage).toHaveAttribute('aria-busy', 'false');
  expect(await sample(-25, -15)).toEqual([255, 0, 0, 255]);
  await page.getByLabel('밝기', { exact: true }).focus();
  await page.getByLabel('밝기', { exact: true }).press('Home');
  await expect(stage).toHaveAttribute('aria-busy', 'false');
  expect(await sample(-25, -15)).toEqual([0, 0, 0, 255]);
  await page.getByRole('button', { name: '실행 취소', exact: true }).click();
  await expect(stage).toHaveAttribute('aria-busy', 'false');
  expect(await sample(-25, -15)).toEqual([255, 0, 0, 255]);
  await page.getByLabel('대비', { exact: true }).press('Home');
  await expect(stage).toHaveAttribute('aria-busy', 'false');
  expect(await sample(-25, -15)).toEqual([128, 128, 128, 255]);
  await page.getByRole('button', { name: '색상 복원', exact: true }).click();
  await expect(stage).toHaveAttribute('aria-busy', 'false');
  expect(errors).toEqual([]);
  await context.close();
});
test('PDF page edit persistence, undo/redo and file close isolate histories', async ({
  page,
}) => {
  await page
    .getByLabel('문서 파일 선택')
    .setInputFiles(path.join(fixtures, 'pages.pdf'));
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await page.getByRole('button', { name: '오른쪽 90°' }).click();
  await page.getByRole('button', { name: '좌우 반전', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '1페이지 선택' }),
  ).toContainText('편집됨');
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'data-rotation',
    '0',
  );
  await page.getByRole('button', { name: '3페이지 선택' }).click();
  await expect(page.locator('.page-dimensions')).toContainText('400 × 320 pt');
  await page.getByRole('button', { name: '오른쪽 90°' }).click();
  await expect(page.locator('.page-dimensions')).toContainText(
    '편집 320 × 400',
  );
  await page.getByRole('button', { name: '1페이지 선택' }).click();
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'data-rotation',
    '90',
  );
  await expect(
    page.getByRole('button', { name: '좌우 반전', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Control+z');
  await expect(
    page.getByRole('button', { name: '좌우 반전', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Control+Shift+z');
  await expect(
    page.getByRole('button', { name: '좌우 반전', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'pages.pdf 닫기' }).click();
  await page
    .getByLabel('문서 파일 선택')
    .setInputFiles(path.join(fixtures, 'pages.pdf'));
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'data-rotation',
    '0',
  );
});
test('zoom presets, pointer anchored wheel, hand pan, scroll and mobile controls', async ({
  page,
}) => {
  await page
    .getByLabel('문서 파일 선택')
    .setInputFiles(path.join(fixtures, 'pages.pdf'));
  const stage = page.locator('.document-stage');
  await expect(stage).toHaveAttribute('aria-busy', 'false');
  await page.getByLabel('확대 비율').fill('200');
  await page.getByLabel('확대 비율').press('Enter');
  await expect(stage).toHaveAttribute('data-zoom', '2');
  const bounds = (await stage.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width * 0.5,
    bounds.y + bounds.height * 0.5,
  );
  const sourceCoordinates = async () => {
    const text = await page.locator('.page-dimensions').innerText();
    const match = text.match(/원본 좌표 ([\d.-]+), ([\d.-]+)/);
    return match ? [Number(match[1]), Number(match[2])] : [];
  };
  const beforeZoom = await sourceCoordinates();
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await expect
    .poll(async () => Number(await stage.getAttribute('data-zoom')))
    .toBeGreaterThan(2);
  const afterZoom = await sourceCoordinates();
  expect(afterZoom[0]).toBeCloseTo(beforeZoom[0]!, 0);
  expect(afterZoom[1]).toBeCloseTo(beforeZoom[1]!, 0);
  await page.getByRole('button', { name: '손 도구' }).click();
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width / 2 + 70,
    bounds.y + bounds.height / 2 + 50,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => Number(await stage.getAttribute('data-pan-x')))
    .toBeGreaterThan(0);
  const beforeScroll = Number(await stage.getAttribute('data-pan-y'));
  await page.mouse.wheel(0, 50);
  await expect
    .poll(async () => Number(await stage.getAttribute('data-pan-y')))
    .toBeLessThan(beforeScroll);
  await page.getByRole('button', { name: '너비 맞춤' }).click();
  await page.getByRole('button', { name: '화면 맞춤' }).click();
  await expect(stage).toHaveAttribute('data-pan-x', '0');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('button', { name: '상하 반전', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('color worker failures are recoverable and unsupported workers use bounded raster fallback', async ({
  page,
}) => {
  await page.route('**/color.worker-*.js', (route) => route.abort());
  await page
    .getByLabel('문서 파일 선택')
    .setInputFiles(path.join(fixtures, 'quadrants.png'));
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await page.getByRole('button', { name: '색상 반전', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('색상 처리에 실패');
  await page.getByRole('button', { name: '색상 복원', exact: true }).click();
  await expect(page.locator('.document-stage canvas')).toBeVisible();
  await page.addInitScript(() => {
    Object.defineProperty(window, 'Worker', {
      value: undefined,
      configurable: true,
    });
  });
  await page.reload();
  await page
    .getByLabel('문서 파일 선택')
    .setInputFiles(path.join(fixtures, 'quadrants.png'));
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await page.getByRole('button', { name: '색상 반전', exact: true }).click();
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await expect(page.locator('.document-stage canvas')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test('TIFF color preview and thumbnail pixels agree and page switching cancels stale work', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page
    .getByLabel('문서 파일 선택')
    .setInputFiles(path.join(fixtures, 'pages-8.tif'));
  const stage = page.locator('.document-stage');
  await expect(stage).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: '색상 반전', exact: true }).click();
  await expect(stage).toHaveAttribute('aria-busy', 'false');
  const centerPixel = (canvas: HTMLCanvasElement) =>
    Array.from(
      canvas
        .getContext('2d')!
        .getImageData(
          Math.floor(canvas.width / 2),
          Math.floor(canvas.height / 2),
          1,
          1,
        ).data,
    );
  expect(await stage.locator('canvas').evaluate(centerPixel)).toEqual([
    215, 215, 215, 255,
  ]);
  expect(
    await page
      .getByRole('button', { name: '1페이지 선택' })
      .locator('canvas')
      .evaluate(centerPixel),
  ).toEqual([215, 215, 215, 255]);
  await page.getByLabel('색상 모드', { exact: true }).selectOption('grayscale');
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await expect(stage).toHaveAttribute('aria-busy', 'false');
  expect(await stage.locator('canvas').evaluate(centerPixel)).toEqual([
    140, 140, 140, 255,
  ]);
  await page.getByRole('button', { name: '1페이지 선택' }).click();
  await expect(stage).toHaveAttribute('aria-busy', 'false');
  expect(await stage.locator('canvas').evaluate(centerPixel)).toEqual([
    215, 215, 215, 255,
  ]);
  expect(errors).toEqual([]);
});
