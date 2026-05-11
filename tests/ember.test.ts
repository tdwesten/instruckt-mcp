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

  it("registers POST /api/annotations and creates an annotation (201)", async () => {
    const app = makeMockApp();
    createEmberMiddleware({ dir })(app as any);

    const handler = app.routes["POST /api/annotations"];
    expect(handler).toBeDefined();

    const res = makeRes();
    await handler(
      makeReqWithBody({
        url: "http://localhost:4200",
        x: 10,
        y: 20,
        element: "div",
        element_path: "body > div",
        comment: "From Ember",
      }) as any,
      res as any,
    );

    expect(res.calls.status).toBe(201);
    expect((res.calls.json as any).id).toBeDefined();
    expect((res.calls.json as any).comment).toBe("From Ember");
  });

  it("POST parses JSON body from request stream when req.body is absent", async () => {
    const app = makeMockApp();
    createEmberMiddleware({ dir })(app as any);

    const handler = app.routes["POST /api/annotations"];
    const payload = JSON.stringify({
      url: "http://localhost:4200",
      x: 0,
      y: 0,
      element: "p",
      element_path: "body > p",
      comment: "Streamed",
    });

    const listeners: Record<string, Function> = {};
    const req = {
      on(event: string, cb: Function) {
        listeners[event] = cb;
      },
    };
    const res = makeRes();
    const pending = handler(req as any, res as any);

    listeners.data(Buffer.from(payload));
    listeners.end();
    await pending;

    expect(res.calls.status).toBe(201);
    expect((res.calls.json as any).comment).toBe("Streamed");
  });
});

function makeReqWithBody(body: unknown) {
  return {
    body,
    on() {
      // no-op — body already parsed
    },
  };
}
