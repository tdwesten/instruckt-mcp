import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { InstrucktStorage } from "./storage.js";

export function createMcpServer(storage: InstrucktStorage): McpServer {
  const server = new McpServer({
    name: "instruckt",
    version: "0.1.0",
  });

  server.tool(
    "get_all_pending",
    "Get all pending (unresolved) annotations from the UI. Returns annotation metadata including comment, element, page URL, and severity. Does not include screenshot data — use get_screenshot for that.",
    async () => {
      const pending = await storage.getPending();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(pending, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "get_screenshot",
    "Get the screenshot image for a specific annotation by ID.",
    { id: z.string().describe("The annotation ID") },
    async ({ id }) => {
      const buf = await storage.getScreenshot(id);
      if (!buf) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `No screenshot found for annotation ${id}`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "image" as const,
            data: buf.toString("base64"),
            mimeType: "image/png",
          },
        ],
      };
    },
  );

  server.tool(
    "resolve",
    "Mark an annotation as resolved. This removes the marker from the browser on next page load.",
    { id: z.string().describe("The annotation ID to resolve") },
    async ({ id }) => {
      await storage.resolve(id);
      return {
        content: [
          {
            type: "text" as const,
            text: `Annotation ${id} resolved`,
          },
        ],
      };
    },
  );

  return server;
}
