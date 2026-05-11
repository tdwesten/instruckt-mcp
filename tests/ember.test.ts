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

  it("registers PATCH /api/annotations/:id and updates the annotation", async () => {
    const app = makeMockApp();
    createEmberMiddleware({ dir })(app as any);

    const postHandler = app.routes["POST /api/annotations"];
    const postRes = makeRes();
    await postHandler(
      makeReqWithBody({
        url: "http://localhost:4200",
        x: 0, y: 0,
        element: "div", element_path: "body > div",
        comment: "Original",
      }) as any,
      postRes as any,
    );
    const id = (postRes.calls.json as any).id;

    const patchHandler = app.routes["PATCH /api/annotations/:id"];
    expect(patchHandler).toBeDefined();

    const res = makeRes();
    await patchHandler(
      { params: { id }, body: { comment: "Updated" }, on() {} } as any,
      res as any,
    );

    expect(res.calls.status).toBe(200);
    expect((res.calls.json as any).comment).toBe("Updated");
  });

  it("PATCH returns 400 when id is missing", async () => {
    const app = makeMockApp();
    createEmberMiddleware({ dir })(app as any);

    const handler = app.routes["PATCH /api/annotations/:id"];
    const res = makeRes();
    await handler(
      { params: {}, body: { comment: "x" }, on() {} } as any,
      res as any,
    );

    expect(res.calls.status).toBe(400);
    expect((res.calls.json as any).error).toBe("Missing annotation ID");
  });

  it("PATCH returns 404 when annotation is not found", async () => {
    const app = makeMockApp();
    createEmberMiddleware({ dir })(app as any);

    const handler = app.routes["PATCH /api/annotations/:id"];
    const res = makeRes();
    await handler(
      { params: { id: "does-not-exist" }, body: { comment: "x" }, on() {} } as any,
      res as any,
    );

    expect(res.calls.status).toBe(404);
    expect((res.calls.json as any).error).toBe("Annotation not found");
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
