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

function makeMockApp() {
  const routes: Record<string, RouteHandler> = {};
  return {
    get(path: string, handler: RouteHandler) {
      routes[`GET ${path}`] = handler;
    },
    post(path: string, handler: RouteHandler) {
      routes[`POST ${path}`] = handler;
    },
    patch(path: string, handler: RouteHandler) {
      routes[`PATCH ${path}`] = handler;
    },
    routes,
  };
}

type RouteHandler = (req: any, res: any) => void | Promise<void>;

function makeRes() {
  const calls: { status?: number; json?: unknown } = {};
  const res = {
    status(code: number) {
      calls.status = code;
      return res;
    },
    json(payload: unknown) {
      calls.json = payload;
      return res;
    },
    calls,
  };
  return res;
}

describe("createEmberMiddleware", () => {
  it("returns a function compatible with Ember CLI server/index.js signature", () => {
    const middleware = createEmberMiddleware({ dir });
    expect(typeof middleware).toBe("function");
  });

  it("registers GET /api/annotations and returns empty list initially", async () => {
    const app = makeMockApp();
    createEmberMiddleware({ dir })(app as any);

    const handler = app.routes["GET /api/annotations"];
    expect(handler).toBeDefined();

    const res = makeRes();
    await handler({} as any, res as any);

    expect(res.calls.json).toEqual([]);
  });
});
