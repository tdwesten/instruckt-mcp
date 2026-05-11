import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEmberMiddleware } from "../src/ember.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "instruckt-ember-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("createEmberMiddleware", () => {
  it("returns a function compatible with Ember CLI server/index.js signature", () => {
    const middleware = createEmberMiddleware({ dir });
    expect(typeof middleware).toBe("function");
  });
});
