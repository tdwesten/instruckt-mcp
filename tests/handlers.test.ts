import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InstrucktStorage } from "../src/storage.js";
import { createRequestHandlers } from "../src/handlers.js";

let dir: string;
let storage: InstrucktStorage;
let handlers: ReturnType<typeof createRequestHandlers>;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "instruckt-handler-test-"));
  storage = new InstrucktStorage(dir);
  handlers = createRequestHandlers(storage);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("handlers", () => {
  it("GET returns empty annotations", async () => {
    const result = await handlers.getAnnotations();
    expect(result).toEqual([]);
  });

  it("POST creates an annotation and returns it", async () => {
    const result = await handlers.createAnnotation({
      url: "http://localhost:3000",
      x: 10,
      y: 20,
      element: "div",
      element_path: "body > div",
      comment: "Fix this",
    });
    expect(result.id).toBeDefined();
    expect(result.comment).toBe("Fix this");
  });

  it("PATCH updates an annotation", async () => {
    const created = await handlers.createAnnotation({
      url: "http://localhost:3000",
      x: 0, y: 0,
      element: "div", element_path: "body > div",
      comment: "Original",
    });
    const updated = await handlers.updateAnnotation(created.id, {
      comment: "Updated",
    });
    expect(updated.comment).toBe("Updated");
  });

  it("GET returns created annotations", async () => {
    await handlers.createAnnotation({
      url: "http://localhost:3000",
      x: 0, y: 0,
      element: "div", element_path: "body > div",
      comment: "First",
    });
    await handlers.createAnnotation({
      url: "http://localhost:3000",
      x: 0, y: 0,
      element: "span", element_path: "body > span",
      comment: "Second",
    });
    const all = await handlers.getAnnotations();
    expect(all).toHaveLength(2);
  });
});
