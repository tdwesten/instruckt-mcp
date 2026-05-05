import { describe, it, expect } from "vitest";
import { Jimp } from "jimp";
import { padScreenshot } from "../src/screenshot.js";

async function makePng(width: number, height: number, color = 0xff0000ff): Promise<Buffer> {
  const img = new Jimp({ width, height, color });
  return Buffer.from(await img.getBuffer("image/png"));
}

async function dimensions(buf: Buffer): Promise<{ w: number; h: number }> {
  const img = await Jimp.read(buf);
  return { w: img.bitmap.width, h: img.bitmap.height };
}

describe("padScreenshot", () => {
  it("pads a tall narrow image to satisfy min width and aspect ratio", async () => {
    const buf = await makePng(50, 2000);
    const out = await padScreenshot(buf);
    const { w, h } = await dimensions(out);

    expect(w).toBeGreaterThanOrEqual(200);
    expect(h).toBe(2000);
    expect(h / w).toBeLessThanOrEqual(2);
  });

  it("pads a wide short image to satisfy min height and aspect ratio", async () => {
    const buf = await makePng(2000, 50);
    const out = await padScreenshot(buf);
    const { w, h } = await dimensions(out);

    expect(h).toBeGreaterThanOrEqual(200);
    expect(w).toBe(2000);
    expect(w / h).toBeLessThanOrEqual(2);
  });

  it("pads a tiny image up to the 200x200 minimum", async () => {
    const buf = await makePng(50, 50);
    const out = await padScreenshot(buf);
    const { w, h } = await dimensions(out);

    expect(w).toBe(200);
    expect(h).toBe(200);
  });

  it("returns the original buffer when already within constraints", async () => {
    const buf = await makePng(400, 300);
    const out = await padScreenshot(buf);
    expect(out).toBe(buf);
  });

  it("uses transparent padding", async () => {
    const buf = await makePng(50, 50, 0xff0000ff);
    const out = await padScreenshot(buf);
    const img = await Jimp.read(out);

    const corner = img.getPixelColor(0, 0);
    expect(corner & 0xff).toBe(0);

    const center = img.getPixelColor(100, 100);
    expect(center & 0xff).toBe(0xff);
  });
});
