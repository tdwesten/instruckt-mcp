# Ember.js 6+ adapter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voeg een Ember CLI dev-server middleware adapter toe, zodat een Ember 6+ project de instruckt annotations API met één import in `server/index.js` kan registreren.

**Architecture:** Nieuw bestand `src/ember.ts` exporteert `createEmberMiddleware(options)` dat een `(app) => void` functie retourneert (Ember CLI `server/index.js` signatuur). De functie registreert GET/POST/PATCH endpoints op de Express `app`, deelt `InstrucktStorage` + `createRequestHandlers` met de bestaande adapters, en bevat een inline JSON body parser om geen Express-dependency nodig te hebben.

**Tech Stack:** TypeScript, tsup (build), vitest (tests), Node.js stream-API voor body parsing. Geduck-typede Express interface — geen `express` / `@types/express` dependency.

## File Structure

- **Create**: `src/ember.ts` — adapter module
- **Create**: `tests/ember.test.ts` — unit tests met mock Express app
- **Modify**: `tsup.config.ts:5-8` — voeg `ember: "src/ember.ts"` toe als entry
- **Modify**: `package.json:21-32` — voeg `./ember` export-entry toe
- **Modify**: `README.md` — voeg Ember sectie toe naast Next.js, en regel in Quick Start tabel

---

### Task 1: Skeleton met types + body parser helper

**Files:**
- Create: `src/ember.ts`
- Test: `tests/ember.test.ts`

- [ ] **Step 1: Schrijf de eerste falende test (factory bestaat en retourneert een functie)**

In `tests/ember.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test, verwacht falen**

Run: `npx vitest run tests/ember.test.ts`
Expected: FAIL — module `../src/ember.js` bestaat niet.

- [ ] **Step 3: Minimale implementatie van `src/ember.ts`**

```ts
import { InstrucktStorage } from "./storage.js";
import { createRequestHandlers } from "./handlers.js";

interface EmberMiddlewareOptions {
  dir?: string;
  route?: string;
}

interface ExpressLikeRequest {
  url?: string;
  params?: Record<string, string>;
  body?: unknown;
  on(event: "data", cb: (chunk: Buffer) => void): void;
  on(event: "end", cb: () => void): void;
  on(event: "error", cb: (err: Error) => void): void;
}

interface ExpressLikeResponse {
  status(code: number): ExpressLikeResponse;
  json(payload: unknown): ExpressLikeResponse;
}

type RouteHandler = (
  req: ExpressLikeRequest,
  res: ExpressLikeResponse,
) => void | Promise<void>;

interface ExpressLikeApp {
  get(path: string, handler: RouteHandler): void;
  post(path: string, handler: RouteHandler): void;
  patch(path: string, handler: RouteHandler): void;
}

async function readJsonBody(req: ExpressLikeRequest): Promise<unknown> {
  if (req.body !== undefined && req.body !== null) return req.body;
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf-8");
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

export function createEmberMiddleware(options: EmberMiddlewareOptions = {}) {
  const dir = options.dir ?? ".instruckt";
  const route = options.route ?? "/api/annotations";
  const storage = new InstrucktStorage(dir);
  const handlers = createRequestHandlers(storage);

  return function (_app: ExpressLikeApp): void {
    // endpoints worden in volgende taken toegevoegd
  };
}
```

- [ ] **Step 4: Run test, verwacht slagen**

Run: `npx vitest run tests/ember.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/ember.ts tests/ember.test.ts
git commit -m "feat(ember): scaffold createEmberMiddleware factory"
```

---

### Task 2: GET endpoint registreren

**Files:**
- Modify: `src/ember.ts` (de returned `(app) => void` functie)
- Modify: `tests/ember.test.ts`

- [ ] **Step 1: Schrijf falende test voor GET registratie en response**

Voeg toe in `tests/ember.test.ts`:

```ts
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

it("registers GET /api/annotations and returns empty list initially", async () => {
  const app = makeMockApp();
  createEmberMiddleware({ dir })(app as any);

  const handler = app.routes["GET /api/annotations"];
  expect(handler).toBeDefined();

  const res = makeRes();
  await handler({} as any, res as any);

  expect(res.calls.json).toEqual([]);
});
```

- [ ] **Step 2: Run test, verwacht falen**

Run: `npx vitest run tests/ember.test.ts`
Expected: FAIL — handler is undefined.

- [ ] **Step 3: Implementeer GET in `src/ember.ts`**

Vervang de body van de returned function:

```ts
  return function (app: ExpressLikeApp): void {
    app.get(route, async (_req, res) => {
      const annotations = await handlers.getAnnotations();
      res.status(200).json(annotations);
    });
  };
```

- [ ] **Step 4: Run test, verwacht slagen**

Run: `npx vitest run tests/ember.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ember.ts tests/ember.test.ts
git commit -m "feat(ember): register GET endpoint"
```

---

### Task 3: POST endpoint registreren

**Files:**
- Modify: `src/ember.ts`
- Modify: `tests/ember.test.ts`

- [ ] **Step 1: Schrijf falende test voor POST**

Voeg toe in `tests/ember.test.ts`:

```ts
function makeReqWithBody(body: unknown) {
  return {
    body,
    on() {
      // no-op — body already parsed
    },
  };
}

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
```

- [ ] **Step 2: Run test, verwacht falen**

Run: `npx vitest run tests/ember.test.ts`
Expected: FAIL — POST handler undefined.

- [ ] **Step 3: Voeg POST registratie toe in `src/ember.ts`**

Binnen de returned function, na de `app.get` registratie:

```ts
    app.post(route, async (req, res) => {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const annotation = await handlers.createAnnotation(body as never);
      res.status(201).json(annotation);
    });
```

- [ ] **Step 4: Run tests, verwacht slagen**

Run: `npx vitest run tests/ember.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ember.ts tests/ember.test.ts
git commit -m "feat(ember): register POST endpoint with inline body parser"
```

---

### Task 4: PATCH endpoint registreren

**Files:**
- Modify: `src/ember.ts`
- Modify: `tests/ember.test.ts`

- [ ] **Step 1: Schrijf falende tests voor PATCH (success, missing id, not found)**

```ts
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
```

- [ ] **Step 2: Run tests, verwacht falen**

Run: `npx vitest run tests/ember.test.ts`
Expected: FAIL — PATCH handler undefined.

- [ ] **Step 3: Implementeer PATCH in `src/ember.ts`**

Binnen de returned function, na POST:

```ts
    app.patch(`${route}/:id`, async (req, res) => {
      const id = req.params?.id;
      if (!id) {
        res.status(400).json({ error: "Missing annotation ID" });
        return;
      }
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      try {
        const annotation = await handlers.updateAnnotation(id, body as never);
        res.status(200).json(annotation);
      } catch {
        res.status(404).json({ error: "Annotation not found" });
      }
    });
```

- [ ] **Step 4: Run tests, verwacht slagen**

Run: `npx vitest run tests/ember.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ember.ts tests/ember.test.ts
git commit -m "feat(ember): register PATCH endpoint with 400/404 handling"
```

---

### Task 5: Build- en package-config

**Files:**
- Modify: `tsup.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Voeg ember entry toe aan `tsup.config.ts`**

Regels 5-8 worden:

```ts
    entry: {
      index: "src/index.ts",
      nextjs: "src/nextjs.ts",
      ember: "src/ember.ts",
    },
```

- [ ] **Step 2: Voeg `./ember` export-entry toe aan `package.json`**

In het `exports` object, na de `./nextjs` entry, voeg toe:

```json
    "./ember": {
      "types": "./dist/ember.d.ts",
      "import": "./dist/ember.js",
      "require": "./dist/ember.cjs"
    }
```

- [ ] **Step 3: Verifieer dat de build slaagt en de juiste bestanden produceert**

Run: `npm run build`
Expected: build succeeds, `dist/ember.js`, `dist/ember.cjs`, `dist/ember.d.ts` bestaan.

Run: `ls dist/ember.*`
Expected: drie bestanden zichtbaar.

- [ ] **Step 4: Verifieer typecheck**

Run: `npm run typecheck`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add tsup.config.ts package.json
git commit -m "build(ember): expose ember entry via tsup and package exports"
```

---

### Task 6: README documentatie

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Voeg Ember toe aan de Quick Start tabel**

Onder `README.md` Quick Start tabel (rond regel 14-18):

Voeg na de Next.js rij toe:

```markdown
| [Ember.js 6+](#emberjs-6) | Dev-server middleware via `server/index.js` |
```

- [ ] **Step 2: Voeg Ember sectie toe na de Next.js sectie**

Voeg na regel 44 (`---` na de Next.js sectie, vóór `### Custom backend`):

````markdown
### Ember.js 6+

Add the adapter to your Ember CLI dev-server in `server/index.js`:

```js
const { createEmberMiddleware } = require('@tdwesten/instruckt-mcp/ember');

module.exports = createEmberMiddleware();
```

This registers `GET`, `POST`, and `PATCH /api/annotations` on the Ember CLI Express
dev-server. Options:

| Option | Type   | Default              | Description                       |
| ------ | ------ | -------------------- | --------------------------------- |
| route  | string | `/api/annotations`   | Base path for the endpoints       |
| dir    | string | `.instruckt`         | Storage directory                 |

**Development only.** Ember CLI's middleware runs during `ember serve`. For production,
use the [Custom backend](#custom-backend) setup with your own Node server.

Then wire up the MCP server in your Claude/agent config:

```json
{
  "mcpServers": {
    "instruckt": {
      "command": "npx",
      "args": ["instruckt-mcp"]
    }
  }
}
```

---
````

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(ember): document the Ember.js 6+ adapter"
```

---

### Task 7: End-to-end verificatie

**Files:** geen wijzigingen

- [ ] **Step 1: Run de volledige testsuite**

Run: `npm test`
Expected: alle tests slagen (inclusief de 7 nieuwe Ember-tests).

- [ ] **Step 2: Run typecheck en build**

Run: `npm run typecheck && npm run build`
Expected: zero errors, build succeeds.

- [ ] **Step 3: Verifieer dat de Ember entry importable is uit het gebuilde package**

Run: `node -e "console.log(typeof require('./dist/ember.cjs').createEmberMiddleware)"`
Expected: `function`.

- [ ] **Step 4: Geen commit nodig — als alle checks slagen is het werk klaar.**
