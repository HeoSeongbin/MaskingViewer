import { transformPixels } from '../core/image/colorTransform';
import type { ColorEdit } from '../core/image/colorTransform';
self.onmessage = (
  event: MessageEvent<{ buffer: ArrayBuffer; edit: ColorEdit }>,
) => {
  const pixels = transformPixels(
    new Uint8ClampedArray(event.data.buffer),
    event.data.edit,
  );
  self.postMessage({ buffer: pixels.buffer }, { transfer: [pixels.buffer] });
};
