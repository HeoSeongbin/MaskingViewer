import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { createFixtures } from '../scripts/fixtures.mjs';
import { displayGeometry } from '../src/core/geometry/coordinateTransform';
import { apply } from '../src/core/geometry/transformMatrix';
const fixtures = path.resolve('test-results/mask-fixtures');
test.use({ deviceScaleFactor: 2, viewport: { width: 1280, height: 900 } });
test.beforeAll(async () => createFixtures(fixtures));
test.beforeEach(async ({ page }) => {
  await page.goto('./');
});
async function open(page: Page, name = 'quadrants.png') {
  await page
    .getByLabel('문서 파일 선택')
    .setInputFiles(path.join(fixtures, name));
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await page.getByRole('button', { name: '100%', exact: true }).click();
}
async function screenPoint(
  page: Page,
  x: number,
  y: number,
  width = 100,
  height = 60,
) {
  const stage = page.locator('.document-stage'),
    rect = (await stage.boundingBox())!;
  const rotation = Number(await stage.getAttribute('data-rotation')) as
    0 | 90 | 180 | 270;
  const flipX =
    (await page
      .getByRole('button', { name: '좌우 반전', exact: true })
      .getAttribute('aria-pressed')) === 'true';
  const flipY =
    (await page
      .getByRole('button', { name: '상하 반전', exact: true })
      .getAttribute('aria-pressed')) === 'true';
  const display = displayGeometry(
    { width, height },
    { rotation, flipX, flipY },
    {
      mode: 'manual',
      zoom: Number(await stage.getAttribute('data-zoom')),
      pan: {
        x: Number(await stage.getAttribute('data-pan-x')),
        y: Number(await stage.getAttribute('data-pan-y')),
      },
    },
    rect,
  );
  const point = apply(display.matrix, { x, y });
  return { x: rect.x + point.x, y: rect.y + point.y };
}
async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}
async function fields(page: Page, values: number[]) {
  for (const [i, field] of ['x', 'y', 'width', 'height'].entries())
    await expect
      .poll(async () =>
        Number(
          await page
            .getByLabel(`마스킹 ${field}`, { exact: true })
            .inputValue(),
        ),
      )
      .toBeCloseTo(values[i]!, 3);
}
test('creates negative drags, moves, resizes and groups each gesture in history', async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole('button', { name: '사각형 마스킹', exact: true })
    .click();
  await drag(
    page,
    await screenPoint(page, 60, 40),
    await screenPoint(page, 20, 10),
  );
  await fields(page, [20, 10, 40, 30]);
  await page.getByRole('button', { name: '선택', exact: true }).click();
  await drag(
    page,
    await screenPoint(page, 40, 25),
    await screenPoint(page, 55, 30),
  );
  await fields(page, [35, 15, 40, 30]);
  await drag(
    page,
    await screenPoint(page, 75, 45),
    await screenPoint(page, 90, 50),
  );
  await fields(page, [35, 15, 55, 35]);
  await page.keyboard.press('Control+z');
  await fields(page, [35, 15, 40, 30]);
  await page.keyboard.press('Control+z');
  await fields(page, [20, 10, 40, 30]);
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: '마스킹 1 선택' })).toHaveCount(
    0,
  );
  await page.keyboard.press('Control+Shift+z');
  await page.getByRole('button', { name: '마스킹 1 선택' }).click();
  await fields(page, [20, 10, 40, 30]);
  await page.locator('.document-stage').focus();
  await page.keyboard.press('Delete');
  await expect(page.getByRole('button', { name: '마스킹 1 선택' })).toHaveCount(
    0,
  );
  await page.keyboard.press('Control+y');
});
test('mask colors, hiding, properties, reset and clear preserve safety and original data', async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole('button', { name: '사각형 마스킹', exact: true })
    .click();
  await drag(
    page,
    await screenPoint(page, 10, 10),
    await screenPoint(page, 40, 25),
  );
  const sample = async () => {
    const point = await screenPoint(page, 25, 17);
    return page
      .locator('.document-stage canvas')
      .evaluate((canvas: HTMLCanvasElement, point) => {
        const r = canvas.getBoundingClientRect(),
          s = canvas.width / r.width;
        return Array.from(
          canvas
            .getContext('2d')!
            .getImageData(
              Math.floor((point.x - r.x) * s),
              Math.floor((point.y - r.y) * s),
              1,
              1,
            ).data,
        );
      }, point);
  };
  await expect.poll(sample).toEqual([0, 0, 0, 255]);
  await page.getByRole('button', { name: '흰색', exact: true }).click();
  await expect.poll(sample).toEqual([255, 255, 255, 255]);
  await page.getByLabel('마스킹 HEX', { exact: true }).fill('#336699');
  await page.getByLabel('마스킹 HEX', { exact: true }).press('Enter');
  await expect.poll(sample).toEqual([51, 102, 153, 255]);
  await page.getByRole('button', { name: '색상 반전', exact: true }).click();
  await expect.poll(sample).toEqual([51, 102, 153, 255]);
  await page
    .getByRole('button', { name: '마스킹 숨기기', exact: true })
    .click();
  await expect.poll(sample).toEqual([0, 255, 255, 255]);
  await page.getByRole('button', { name: '색상 복원', exact: true }).click();
  await expect.poll(sample).toEqual([255, 0, 0, 255]);
  await page.getByRole('button', { name: '마스킹 표시', exact: true }).click();
  await expect.poll(sample).toEqual([51, 102, 153, 255]);
  await page.getByLabel('마스킹 x', { exact: true }).fill('20');
  await page.getByLabel('마스킹 x', { exact: true }).press('Enter');
  await fields(page, [20, 10, 30, 15]);
  await page.getByLabel('마스킹 width', { exact: true }).fill('999');
  await page.getByLabel('마스킹 width', { exact: true }).press('Enter');
  await expect(page.getByRole('alert')).toContainText('페이지 안');
  await fields(page, [20, 10, 30, 15]);
  await page
    .getByRole('button', { name: '전체 편집 복원', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '마스킹 1 선택' }),
  ).toBeVisible();
  await expect(
    page.getByRole('complementary', { name: '속성 패널' }),
  ).toContainText('원본은 유지되며 다운로드 시 새 픽셀로 마스킹을 적용합니다');
  await page
    .getByRole('button', { name: '현재 페이지 마스킹 전체 삭제', exact: true })
    .click();
  await expect(page.getByRole('button', { name: '마스킹 1 선택' })).toHaveCount(
    0,
  );
  await page.keyboard.press('Control+z');
  await expect(
    page.getByRole('button', { name: '마스킹 1 선택' }),
  ).toBeVisible();
});
test('creates masks after rotation, flips, zoom and pan without changing original coordinates', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: '오른쪽 90°' }).click();
  await page.getByRole('button', { name: '좌우 반전', exact: true }).click();
  await page.getByRole('button', { name: '상하 반전', exact: true }).click();
  await page.getByLabel('확대 비율').fill('400');
  await page.getByLabel('확대 비율').press('Enter');
  await page.getByRole('button', { name: '손 도구' }).click();
  const r = (await page.locator('.document-stage').boundingBox())!;
  await drag(
    page,
    { x: r.x + r.width / 2, y: r.y + r.height / 2 },
    { x: r.x + r.width / 2 + 20, y: r.y + r.height / 2 + 20 },
  );
  await page
    .getByRole('button', { name: '사각형 마스킹', exact: true })
    .click();
  await drag(
    page,
    await screenPoint(page, 15, 12),
    await screenPoint(page, 45, 35),
  );
  await fields(page, [15, 12, 30, 23]);
  await page.getByRole('button', { name: '각도 복원' }).click();
  await page.getByRole('button', { name: '100%', exact: true }).click();
  await fields(page, [15, 12, 30, 23]);
  await page.getByRole('button', { name: '마스킹 1 선택' }).click();
  const selected = await screenPoint(page, 30, 23);
  await drag(page, selected, await screenPoint(page, 40, 28));
  await fields(page, [25, 17, 30, 23]);
});
test('PDF and TIFF preserve masks per page and file and cancel unfinished gestures', async ({
  page,
}) => {
  await open(page, 'pages.pdf');
  await page
    .getByRole('button', { name: '사각형 마스킹', exact: true })
    .click();
  await drag(
    page,
    await screenPoint(page, 40, 50, 320, 400),
    await screenPoint(page, 160, 140, 320, 400),
  );
  await fields(page, [40, 50, 120, 90]);
  if (process.env.CAPTURE_PHASE4 === '1')
    await page.screenshot({
      path: path.resolve('docs/screenshots/phase-4.png'),
      scale: 'css',
    });
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await expect(page.getByRole('button', { name: '마스킹 1 선택' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: '1페이지 선택' }).click();
  await expect(
    page.getByRole('button', { name: '마스킹 1 선택' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '3페이지 선택' }).click();
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await page.getByRole('button', { name: '오른쪽 90°' }).click();
  await page
    .getByRole('button', { name: '사각형 마스킹', exact: true })
    .click();
  await drag(
    page,
    await screenPoint(page, 20, 30, 400, 320),
    await screenPoint(page, 110, 80, 400, 320),
  );
  await fields(page, [20, 30, 90, 50]);
  await open(page, 'pages-8.tif');
  await expect(page.getByRole('button', { name: '마스킹 1 선택' })).toHaveCount(
    0,
  );
  await page
    .getByRole('button', { name: '사각형 마스킹', exact: true })
    .click();
  const start = await screenPoint(page, 3, 3, 40, 30),
    end = await screenPoint(page, 30, 20, 40, 30);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.getByRole('button', { name: '마스킹 1 선택' })).toHaveCount(
    0,
  );
  await drag(page, start, end);
  await fields(page, [3, 3, 27, 17]);
  await page.getByRole('button', { name: /pages.pdf PDF/ }).click();
  await fields(page, [20, 30, 90, 50]);
  await page.getByRole('button', { name: '1페이지 선택' }).click();
  await page.getByRole('button', { name: '마스킹 1 선택' }).click();
  await fields(page, [40, 50, 120, 90]);
  await page.getByRole('button', { name: 'pages.pdf 닫기' }).click();
  await page.getByRole('button', { name: '마스킹 1 선택' }).click();
  await fields(page, [3, 3, 27, 17]);
});

test('bounds clamp, crossing resize, cancel and mobile fields do not lose mask data', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('확대 비율').fill('200');
  await page.getByLabel('확대 비율').press('Enter');
  await page
    .getByRole('button', { name: '사각형 마스킹', exact: true })
    .click();
  await drag(
    page,
    await screenPoint(page, 20, 10),
    await screenPoint(page, 150, 90),
  );
  await fields(page, [20, 10, 80, 50]);
  await page.getByRole('button', { name: '선택', exact: true }).click();
  await drag(
    page,
    await screenPoint(page, 20, 10),
    await screenPoint(page, 90, 50),
  );
  await fields(page, [90, 50, 10, 10]);
  await page.getByLabel('마스킹 x', { exact: true }).fill('89.1234567');
  await page.getByLabel('마스킹 x', { exact: true }).press('Enter');
  await page.getByLabel('마스킹 x', { exact: true }).focus();
  await page.getByLabel('마스킹 x', { exact: true }).press('Tab');
  await expect(page.getByLabel('마스킹 x', { exact: true })).toHaveValue(
    '89.1234567',
  );
  await page
    .getByRole('button', { name: '사각형 마스킹', exact: true })
    .click();
  const from = await screenPoint(page, 5, 5),
    to = await screenPoint(page, 40, 20);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y);
  await page
    .locator('.document-stage')
    .dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: '마스킹 2 선택' })).toHaveCount(
    0,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel('마스킹 HEX', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole('button', { name: '마스킹 1 선택' }),
  ).toBeVisible();
});
