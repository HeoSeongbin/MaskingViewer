import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import UTIF from 'utif';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createFixtures, buildTiff } from '../scripts/fixtures.mjs';
const fixtures = path.resolve('test-results/optimization-fixtures');
test.use({ viewport: { width: 1280, height: 900 } });
test.beforeAll(async () => {
  await createFixtures(fixtures);
  const canvas = createCanvas(2000, 2000),
    context = canvas.getContext('2d');
  context.fillStyle = '#123456';
  context.fillRect(0, 0, 2000, 2000);
  await writeFile(
    path.join(fixtures, 'large.png'),
    canvas.toBuffer('image/png'),
  );
  const pdf = await PDFDocument.create();
  for (let i = 0; i < 120; i++)
    pdf.addPage([512, 512]).drawText(`PAGE ${i + 1}`, { x: 20, y: 200 });
  await writeFile(path.join(fixtures, 'many.pdf'), await pdf.save());
  await writeFile(path.join(fixtures, 'many.tif'), buildTiff(1, 120));
});
async function open(page: import('@playwright/test').Page, name: string) {
  await page
    .getByLabel('문서 파일 선택')
    .setInputFiles(path.join(fixtures, name));
  await expect(page.locator('.document-stage')).toHaveAttribute(
    'aria-busy',
    'false',
  );
}
test('WCAG AA checks cover empty, editor, dark and mobile export states with keyboard focus', async ({
  page,
}) => {
  await page.goto('./');
  const audit = async () => {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  };
  await audit();
  await open(page, 'quadrants.png');
  await audit();
  await page.getByRole('button', { name: '다운로드', exact: true }).click();
  await expect(page.getByLabel('출력 형식')).toBeFocused();
  await audit();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: '다운로드', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: '다크 모드로 변경' }).click();
  await audit();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '다운로드', exact: true }).click();
  await audit();
});
test('Worker errors recover, Workerless fallback exports and blocks large pages', async ({
  page,
}) => {
  await page.goto('./');
  await open(page, 'quadrants.png');
  await page.evaluate(() => {
    const Original = window.Worker;
    window.Worker = class extends Original {
      constructor(url: string | URL, options?: WorkerOptions) {
        if (String(url).includes('export.worker'))
          throw new Error('injected Worker startup failure');
        super(url, options);
      }
    };
  });
  await page.getByRole('button', { name: '다운로드', exact: true }).click();
  await page.getByRole('button', { name: '검증 후 다운로드' }).click();
  await expect(page.getByRole('alert')).toContainText('injected Worker');
  await page.evaluate(() => {
    Object.defineProperty(window, 'Worker', {
      value: undefined,
      configurable: true,
    });
  });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '검증 후 다운로드' }).click();
  const file = (await (await download).path())!;
  const image = await loadImage(await readFile(file));
  expect(image.width).toBe(100);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await open(page, 'large.png');
  await page.getByRole('button', { name: '다운로드', exact: true }).click();
  await page.getByRole('button', { name: '검증 후 다운로드' }).click();
  await expect(page.getByRole('alert')).toContainText('100만 픽셀');
});
test('cancels a running Worker and releases Worker and Blob URL resources', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const counters = { workers: 0, urls: 0 };
    Object.assign(window, { resourceCounters: counters });
    const Original = window.Worker;
    window.Worker = class extends Original {
      private stopped = false;
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        counters.workers++;
      }
      override terminate() {
        if (!this.stopped) {
          this.stopped = true;
          counters.workers--;
        }
        super.terminate();
      }
    };
    const create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL),
      urls = new Set<string>();
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      urls.add(url);
      counters.urls = urls.size;
      return url;
    };
    URL.revokeObjectURL = (url) => {
      urls.delete(url);
      counters.urls = urls.size;
      revoke(url);
    };
  });
  await page.goto('./');
  await open(page, 'large.png');
  await page.getByRole('button', { name: '다운로드', exact: true }).click();
  await page.evaluate(() => {
    const state = {
      ticks: 0,
      longestGapMs: 0,
      previous: performance.now(),
      timer: 0,
    };
    state.timer = window.setInterval(() => {
      const now = performance.now();
      state.ticks++;
      state.longestGapMs = Math.max(state.longestGapMs, now - state.previous);
      state.previous = now;
    }, 16);
    Object.assign(window, { exportHeartbeat: state });
  });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '검증 후 다운로드' }).click();
  const result = await download;
  expect(result.suggestedFilename()).toBe('large_masked.png');
  const heartbeat = await page.evaluate(() => {
    const state = (
      window as unknown as {
        exportHeartbeat: { timer: number; ticks: number; longestGapMs: number };
      }
    ).exportHeartbeat;
    clearInterval(state.timer);
    return { ticks: state.ticks, longestGapMs: state.longestGapMs };
  });
  expect(heartbeat.ticks).toBeGreaterThan(1);
  expect(heartbeat.longestGapMs).toBeLessThan(1000);
  const outputImage = await loadImage(await readFile((await result.path())!));
  expect([outputImage.width, outputImage.height]).toEqual([2000, 2000]);
  const outputCanvas = createCanvas(1, 1),
    outputContext = outputCanvas.getContext('2d');
  outputContext.drawImage(outputImage, 0, 0);
  expect([...outputContext.getImageData(0, 0, 1, 1).data]).toEqual([
    18, 52, 86, 255,
  ]);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              resourceCounters: { workers: number; urls: number };
            }
          ).resourceCounters,
      ),
    )
    .toEqual({ workers: 0, urls: 0 });
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  // Hold the export Worker script response so cancellation is deterministic while the Worker is alive.
  let release: () => void = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  await page.route('**/assets/export.worker-*.js', async (route) => {
    entered();
    await hold;
    await route.continue();
  });
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.getByRole('button', { name: '다운로드', exact: true }).click();
  await page.getByRole('button', { name: '검증 후 다운로드' }).click();
  await started;
  await page.getByRole('button', { name: '출력 취소', exact: true }).click();
  release();
  await expect(
    page.getByRole('status').filter({ hasText: '출력을 취소했습니다.' }),
  ).toBeVisible();
  expect(downloads).toBe(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { resourceCounters: { workers: number } })
            .resourceCounters.workers,
      ),
    )
    .toBe(0);
});
test('OffscreenCanvas missing inside Worker preserves PNG output through Canvas fallback', async ({
  page,
}) => {
  await page.route('**/assets/export.worker-*.js', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        "Object.defineProperty(self, 'OffscreenCanvas', { value: undefined });\n" +
        (await response.text()),
    });
  });
  await page.goto('./');
  await open(page, 'quadrants.png');
  await page.getByRole('button', { name: '다운로드', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '검증 후 다운로드' }).click();
  const image = await loadImage(
    await readFile((await (await pending).path())!),
  );
  const canvas = createCanvas(image.width, image.height),
    context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  expect([...context.getImageData(0, 0, 1, 1).data]).toEqual([255, 0, 0, 255]);
});
test('120-page PDF/TIFF navigation stays lazy and repeated large-file close has bounded JS heap', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.goto('./');
  const cdp = await context.newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const baseline = await cdp.send('Runtime.getHeapUsage');
  const start = Date.now();
  let peak = baseline.usedSize;
  const outputs: Record<string, { bytes: number; elapsedMs: number }> = {};
  for (const name of ['many.pdf', 'many.tif']) {
    await open(page, name);
    await page.getByLabel('페이지 번호').fill('120');
    await page.getByRole('button', { name: '이동', exact: true }).click();
    await expect(page.getByLabel('페이지 번호')).toHaveValue('120');
    await expect(page.locator('.document-stage')).toHaveAttribute(
      'aria-busy',
      'false',
    );
    await expect(page.locator('.document-stage')).toHaveAttribute(
      'aria-label',
      `${name} 120페이지 미리보기`,
    );
    const thumbnailCount = await page.locator('.thumbnail-list button').count();
    expect(thumbnailCount).toBeGreaterThan(0);
    expect(thumbnailCount).toBeLessThanOrEqual(7);
    await page.getByRole('button', { name: '다운로드', exact: true }).click();
    await page.getByLabel('출력 페이지 범위').selectOption('all');
    const outputStart = Date.now(),
      output = page.waitForEvent('download', { timeout: 90_000 });
    await page.getByRole('button', { name: '검증 후 다운로드' }).click();
    const result = await output,
      bytes = await readFile((await result.path())!);
    outputs[name] = {
      bytes: bytes.length,
      elapsedMs: Date.now() - outputStart,
    };
    if (name.endsWith('.pdf'))
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(120);
    else expect(UTIF.decode(new Uint8Array(bytes).buffer)).toHaveLength(120);
    peak = Math.max(peak, (await cdp.send('Runtime.getHeapUsage')).usedSize);
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page
      .getByRole('button', { name: `${name} 닫기`, exact: true })
      .click();
  }
  for (let i = 0; i < 8; i++) {
    await open(page, 'large.png');
    peak = Math.max(peak, (await cdp.send('Runtime.getHeapUsage')).usedSize);
    await page
      .getByRole('button', { name: 'large.png 닫기', exact: true })
      .click();
  }
  await cdp.send('HeapProfiler.collectGarbage');
  const final = await cdp.send('Runtime.getHeapUsage');
  expect(final.usedSize - baseline.usedSize).toBeLessThan(32 * 1024 * 1024);
  const report = {
    browser:
      testInfo.project.use.channel ??
      process.env.PLAYWRIGHT_CHANNEL ??
      'default',
    viewport: '1280x900',
    pngPixels: 4_000_000,
    repeatedCloseCycles: 8,
    pdfPages: 120,
    tiffPages: 120,
    outputs,
    elapsedMs: Date.now() - start,
    baselineJsHeapBytes: baseline.usedSize,
    observedPeakJsHeapBytes: peak,
    finalJsHeapBytes: final.usedSize,
    note: 'CDP JS heap samples exclude native Canvas/decoder/GPU memory; not a total memory limit or universal benchmark.',
  };
  await testInfo.attach('phase6-performance.json', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });
  if (process.env.CAPTURE_PHASE6 === '1') {
    const directory = process.env.PHASE6_REPORT_DIR || 'docs/performance';
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, `phase-6-${report.browser}.json`),
      JSON.stringify(report, null, 2) + '\n',
    );
  }
});
