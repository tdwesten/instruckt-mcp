import { Jimp } from "jimp";

const MIN_DIM = 200;
const MAX_RATIO = 2;

export async function padScreenshot(buf: Buffer): Promise<Buffer> {
  const img = await Jimp.read(buf);
  const w = img.bitmap.width;
  const h = img.bitmap.height;

  const targetW = Math.max(w, MIN_DIM, Math.ceil(h / MAX_RATIO));
  const targetH = Math.max(h, MIN_DIM, Math.ceil(w / MAX_RATIO));

  if (targetW === w && targetH === h) return buf;

  const canvas = new Jimp({ width: targetW, height: targetH, color: 0x00000000 });
  canvas.composite(img, Math.floor((targetW - w) / 2), Math.floor((targetH - h) / 2));
  return Buffer.from(await canvas.getBuffer("image/png"));
}
