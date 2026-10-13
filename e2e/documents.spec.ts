import { test, expect } from '@playwright/test';
import { createFixtures } from '../scripts/fixtures.mjs';
import path from 'node:path';
const fixtures = path.resolve('test-results/fixtures');
test.beforeAll(async () => createFixtures(fixtures));
test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('opens every raster input format locally, rejects disguised and damaged inputs', async ({
  page,
}) => {
  for (const extension of ['png', 'jpg', 'bmp', 'gif', 'webp']) {
    await page
      .getByLabel('문서 파일 선택')
      .setInputFiles(path.join(fixtures, `image.${extension}`));
    await expect(
      page.getByRole('img', { name: `image.${extension} 1페이지 미리보기` }),
    ).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.document-stage canvas')).toBeVisible();
  }
  await page
    .getByLabel('문서 파일 선택')
    .setInputFiles(
      ['fake.png', 'broken.pdf', 'unsafe.svg'].map((name) =>
        path.join(fixtures, name),
      ),
    );
  await expect(page.getByRole('alert')).toContainText('확장자와 실제 형식');
  await expect(page.getByRole('alert')).toContainText('broken.pdf');
  await expect(page.getByRole('alert')).toContainText('지원하지 않는 확장자');
  await expect(
    page.getByRole('button', { name: 'image.png 닫기' }),
  ).toBeVisible();
});

test('PDF worker renders multiple pages, navigation retains file state, and closes documents', async ({
  page,
}) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  const offsite: string[] = [];
  page.on('request', (request) => {
    if (
      !request.url().startsWith('http://127.0.0.1:4183') &&
      !request.url().startsWith('blob:') &&
      !request.url().startsWith('data:')
    )
      offsite.push(request.url());
  });
  await page
    .getByLabel('문서 파일 선택')
    .setInputFiles(path.join(fixtures, 'pages.pdf'));
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await expect(page.getByLabel('페이지 번호')).toHaveValue('2');
  await page.getByRole('button', { name: '3페이지 선택' }).click();
  await expect(page.locator('.page-dimensions')).toContainText('400 × 320 pt');
  await page
    .getByLabel('문서 파일 선택')
    .setInputFiles(path.join(fixtures, 'image.png'));
  await page.getByRole('button', { name: /pages.pdf PDF/ }).click();
  await expect(page.getByLabel('페이지 번호')).toHaveValue('3');
  await page.getByLabel('페이지 번호').fill('9');
  await page.getByRole('button', { name: '이동', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('1부터 3');
  await page.getByLabel('페이지 번호').fill('1');
  await page.getByRole('button', { name: '이동', exact: true }).click();
  await expect(page.getByLabel('페이지 번호')).toHaveValue('1');
  await page.getByRole('button', { name: 'pages.pdf 닫기' }).click();
  await expect(page.getByLabel('페이지 번호')).toHaveValue('1');
  expect(failures).toEqual([]);
  expect(offsite).toEqual([]);
});

for (const codec of [1, 3, 4, 5, 8, 32773])
  test(`TIFF codec ${codec}: three real pages and orientation`, async ({
    page,
  }) => {
    await page
      .getByLabel('문서 파일 선택')
      .setInputFiles(path.join(fixtures, `pages-${codec}.tif`));
    await expect(page.locator('.document-stage')).toHaveAttribute(
      'aria-busy',
      'false',
    );
    await expect(page.locator('.page-dimensions')).toContainText('40 × 30 px');
    const stage = page.locator('.document-stage canvas');
    const pixel = () =>
      stage.evaluate((canvas: HTMLCanvasElement) => {
        const data = canvas
          .getContext('2d')!
          .getImageData(
            Math.floor(canvas.width / 2),
            Math.floor(canvas.height / 2),
            1,
            1,
          ).data;
        return Array.from(data);
      });
    await expect
      .poll(async () => (await pixel())[0])
      .toBe(codec === 3 || codec === 4 ? 255 : 40);
    await page.getByRole('button', { name: '다음 페이지' }).click();
    await expect(page.locator('.document-stage')).toHaveAttribute(
      'aria-busy',
      'false',
    );
    await expect
      .poll(async () => (await pixel())[0])
      .toBe(codec === 3 || codec === 4 ? 255 : 140);
    await page.getByRole('button', { name: '3페이지 선택' }).click();
    await expect(page.locator('.page-dimensions')).toContainText('30 × 40 px');
    await expect
      .poll(async () => (await pixel())[0])
      .toBe(codec === 3 || codec === 4 ? 255 : 230);
    await page.getByRole('button', { name: `pages-${codec}.tif 닫기` }).click();
    await expect(
      page.getByRole('heading', { name: /문서를 열고/ }),
    ).toBeVisible();
  });

test('password-protected PDF gives guidance without blocking subsequent upload', async ({
  page,
}) => {
  await page
    .getByLabel('문서 파일 선택')
    .setInputFiles(path.join(fixtures, 'locked.pdf'));
  await expect(page.getByRole('alert')).toContainText('암호로 보호된 PDF');
  await page
    .getByLabel('문서 파일 선택')
    .setInputFiles(path.join(fixtures, 'image.png'));
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-busy',
    'false',
  );
});

test('drag and drop multiple files and mobile layout', async ({ page }) => {
  // Browser-native File objects from generated PNG/PDF fixtures.
  const { readFile } = await import('node:fs/promises');
  const images = await Promise.all(
    ['image.png', 'pages.pdf'].map(async (name) => ({
      name,
      bytes: Array.from(await readFile(path.join(fixtures, name))),
    })),
  );
  const data = await page.evaluateHandle((items) => {
    const data = new DataTransfer();
    for (const item of items)
      data.items.add(new File([new Uint8Array(item.bytes)], item.name));
    return data;
  }, images);
  await page.locator('.app-root').dispatchEvent('drop', { dataTransfer: data });
  await expect(
    page.getByRole('button', { name: /pages.pdf PDF/ }),
  ).toBeVisible();
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
