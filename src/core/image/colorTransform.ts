export interface ColorEdit {
  invert: boolean;
  tone: 'original' | 'grayscale' | 'binary';
  brightness: number;
  contrast: number;
}
export const DEFAULT_COLOR: ColorEdit = {
  invert: false,
  tone: 'original',
  brightness: 0,
  contrast: 0,
};
export function transformPixels(data: Uint8ClampedArray, edit: ColorEdit) {
  const brightness = Math.max(-100, Math.min(100, edit.brightness)) * 2.55;
  const contrast = Math.max(-100, Math.min(100, edit.contrast)) * 2.55;
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const adjusted = (channel: number) => {
    const value = factor * (channel - 128) + 128 + brightness;
    return edit.tone === 'binary' ? (value >= 128 ? 255 : 0) : value;
  };
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]!,
      g = data[i + 1]!,
      b = data[i + 2]!;
    if (edit.invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }
    if (edit.tone !== 'original') {
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = g = b = luminance;
    }
    data[i] = adjusted(r);
    data[i + 1] = adjusted(g);
    data[i + 2] = adjusted(b);
  }
  return data;
}
