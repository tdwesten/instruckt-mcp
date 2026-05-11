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

  return function (app: ExpressLikeApp): void {
    app.get(route, async (_req, res) => {
      const annotations = await handlers.getAnnotations();
      res.status(200).json(annotations);
    });
  };
}
