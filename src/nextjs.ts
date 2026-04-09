import { InstrucktStorage } from "./storage.js";
import { createRequestHandlers } from "./handlers.js";

interface NextjsHandlerOptions {
  dir?: string;
}

interface NextRequest {
  json(): Promise<unknown>;
  url: string;
}

interface NextResponseInit {
  status?: number;
  headers?: Record<string, string>;
}

// Minimal NextResponse-compatible factory — avoids depending on Next.js at build time
function jsonResponse(data: unknown, init?: NextResponseInit) {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}

export function createHandlers(options: NextjsHandlerOptions = {}) {
  const storage = new InstrucktStorage(options.dir ?? ".instruckt");
  const handlers = createRequestHandlers(storage);

  return {
    async GET() {
      const annotations = await handlers.getAnnotations();
      return jsonResponse(annotations);
    },

    async POST(request: NextRequest) {
      const body = (await request.json()) as Record<string, unknown>;
      const annotation = await handlers.createAnnotation(body as never);
      return jsonResponse(annotation, { status: 201 });
    },

    async PATCH(request: NextRequest) {
      const url = new URL(request.url);
      const segments = url.pathname.split("/").filter(Boolean);
      const id = segments[segments.length - 1];

      if (!id || id === "annotations") {
        return jsonResponse({ error: "Missing annotation ID" }, { status: 400 });
      }

      const body = (await request.json()) as Record<string, unknown>;
      try {
        const annotation = await handlers.updateAnnotation(id, body as never);
        return jsonResponse(annotation);
      } catch {
        return jsonResponse({ error: "Annotation not found" }, { status: 404 });
      }
    },
  };
}
