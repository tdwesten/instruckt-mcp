import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InstrucktStorage } from "../src/storage.js";

let dir: string;
let storage: InstrucktStorage;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "instruckt-test-"));
  storage = new InstrucktStorage(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("InstrucktStorage", () => {
  it("returns empty array when no annotations exist", async () => {
    const result = await storage.getAll();
    expect(result).toEqual([]);
  });

  it("adds an annotation and returns it with an id", async () => {
    const annotation = await storage.add({
      url: "http://localhost:3000",
      x: 50,
      y: 100,
      element: "button.submit",
      element_path: "body > div > button",
      comment: "Fix this button",
    });

    expect(annotation.id).toBeDefined();
    expect(annotation.comment).toBe("Fix this button");
    expect(annotation.resolved).toBe(false);
    expect(annotation.created_at).toBeDefined();
  });

  it("persists annotations to disk", async () => {
    await storage.add({
      url: "http://localhost:3000",
      x: 50,
      y: 100,
      element: "button",
      element_path: "body > button",
      comment: "Test",
    });

    const raw = await readFile(join(dir, "annotations.json"), "utf-8");
    const data = JSON.parse(raw);
    expect(data).toHaveLength(1);
    expect(data[0].comment).toBe("Test");
  });

  it("extracts base64 screenshot to a PNG file", async () => {
    const base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const annotation = await storage.add({
      url: "http://localhost:3000",
      x: 0,
      y: 0,
      element: "div",
      element_path: "body > div",
      comment: "Has screenshot",
      screenshot: base64,
    });

    expect(annotation.screenshot).toBe(`${annotation.id}.png`);
    const screenshotPath = join(dir, "screenshots", `${annotation.id}.png`);
    const file = await readFile(screenshotPath);
    expect(file.length).toBeGreaterThan(0);
  });

  it("returns only pending annotations", async () => {
    const a1 = await storage.add({
      url: "http://localhost:3000",
      x: 0, y: 0,
      element: "div", element_path: "body > div",
      comment: "Pending",
    });
    await storage.add({
      url: "http://localhost:3000",
      x: 0, y: 0,
      element: "span", element_path: "body > span",
      comment: "Also pending",
    });
    await storage.resolve(a1.id);

    const pending = await storage.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].comment).toBe("Also pending");
  });

  it("updates an annotation", async () => {
    const a = await storage.add({
      url: "http://localhost:3000",
      x: 0, y: 0,
      element: "div", element_path: "body > div",
      comment: "Original",
    });

    const updated = await storage.update(a.id, { comment: "Updated" });
    expect(updated.comment).toBe("Updated");

    const all = await storage.getAll();
    expect(all[0].comment).toBe("Updated");
  });

  it("sets resolved and status when resolving an annotation", async () => {
    const a = await storage.add({
      url: "http://localhost:3000",
      x: 0, y: 0,
      element: "div", element_path: "body > div",
      comment: "Resolve me",
    });

    const resolved = await storage.resolve(a.id);
    const all = await storage.getAll();
    expect(resolved).toMatchObject({ resolved: true, status: "resolved" });
    expect(all[0]).toMatchObject({ resolved: true, status: "resolved" });

    const raw = await readFile(join(dir, "annotations.json"), "utf-8");
    expect(JSON.parse(raw)[0]).toMatchObject({ resolved: true, status: "resolved" });
  });

  it("keeps resolved and status in sync when updating an annotation", async () => {
    const a = await storage.add({
      url: "http://localhost:3000",
      x: 0, y: 0,
      element: "div", element_path: "body > div",
      comment: "Update me",
    });

    expect(await storage.update(a.id, { resolved: true })).toMatchObject({
      resolved: true,
      status: "resolved",
    });
    expect(await storage.update(a.id, { status: "pending" })).toMatchObject({
      resolved: false,
      status: "pending",
    });
    expect(await storage.update(a.id, { status: "resolved" })).toMatchObject({
      resolved: true,
      status: "resolved",
    });
    expect(await storage.update(a.id, { resolved: false })).toMatchObject({
      resolved: false,
      status: "pending",
    });
  });

  it("normalizes legacy resolved annotations when reading", async () => {
    const a = await storage.add({
      url: "http://localhost:3000",
      x: 0, y: 0,
      element: "div", element_path: "body > div",
      comment: "Legacy annotation",
    });
    const filePath = join(dir, "annotations.json");
    const annotations = JSON.parse(await readFile(filePath, "utf-8"));
    annotations[0] = { ...annotations[0], resolved: true, status: "pending" };
    await writeFile(filePath, JSON.stringify(annotations, null, 2), "utf-8");

    const all = await storage.getAll();
    expect(all[0]).toMatchObject({ id: a.id, resolved: true, status: "resolved" });

    const persisted = JSON.parse(await readFile(filePath, "utf-8"));
    expect(persisted[0]).toMatchObject({ resolved: true, status: "resolved" });
  });

  it("removes dismissed annotations and their screenshots", async () => {
    const base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const a = await storage.add({
      url: "http://localhost:3000",
      x: 0, y: 0,
      element: "div", element_path: "body > div",
      comment: "Dismiss me",
      screenshot: base64,
    });

    const dismissed = await storage.update(a.id, { status: "dismissed" });
    expect(dismissed.severity).toBe("dismissed");
    expect(await storage.getAll()).toEqual([]);
    expect(await storage.getScreenshot(a.id)).toBeNull();
  });

  it("reads screenshot as buffer", async () => {
    const base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const a = await storage.add({
      url: "http://localhost:3000",
      x: 0, y: 0,
      element: "div", element_path: "body > div",
      comment: "Screenshot",
      screenshot: base64,
    });

    const buf = await storage.getScreenshot(a.id);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf!.length).toBeGreaterThan(0);
  });

  it("returns null for missing screenshot", async () => {
    const buf = await storage.getScreenshot("nonexistent");
    expect(buf).toBeNull();
  });

  it("throws when updating a nonexistent annotation", async () => {
    await expect(storage.update("nonexistent", { comment: "x" })).rejects.toThrow();
  });
});
