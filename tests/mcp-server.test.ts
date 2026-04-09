import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp-server.js";
import { InstrucktStorage } from "../src/storage.js";

let dir: string;
let storage: InstrucktStorage;
let client: Client;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "instruckt-mcp-test-"));
  storage = new InstrucktStorage(dir);
  const server = createMcpServer(storage);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientTransport);
});

afterEach(async () => {
  await client.close();
  await rm(dir, { recursive: true, force: true });
});

describe("MCP server", () => {
  it("lists 3 tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(["get_all_pending", "get_screenshot", "resolve"]);
  });

  it("get_all_pending returns empty array initially", async () => {
    const result = await client.callTool({ name: "get_all_pending", arguments: {} });
    const content = result.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(content[0].text)).toEqual([]);
  });

  it("get_all_pending returns added annotations", async () => {
    await storage.add({
      url: "http://localhost:3000",
      x: 0, y: 0,
      element: "div", element_path: "body > div",
      comment: "Fix this",
    });
    const result = await client.callTool({ name: "get_all_pending", arguments: {} });
    const content = result.content as Array<{ type: string; text: string }>;
    const annotations = JSON.parse(content[0].text);
    expect(annotations).toHaveLength(1);
    expect(annotations[0].comment).toBe("Fix this");
  });

  it("get_all_pending excludes resolved annotations", async () => {
    const a = await storage.add({
      url: "http://localhost:3000",
      x: 0, y: 0,
      element: "div", element_path: "body > div",
      comment: "Resolved",
    });
    await storage.resolve(a.id);
    await storage.add({
      url: "http://localhost:3000",
      x: 0, y: 0,
      element: "span", element_path: "body > span",
      comment: "Pending",
    });
    const result = await client.callTool({ name: "get_all_pending", arguments: {} });
    const content = result.content as Array<{ type: string; text: string }>;
    const annotations = JSON.parse(content[0].text);
    expect(annotations).toHaveLength(1);
    expect(annotations[0].comment).toBe("Pending");
  });

  it("get_screenshot returns base64 image", async () => {
    const base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const a = await storage.add({
      url: "http://localhost:3000",
      x: 0, y: 0,
      element: "div", element_path: "body > div",
      comment: "With screenshot",
      screenshot: base64,
    });
    const result = await client.callTool({ name: "get_screenshot", arguments: { id: a.id } });
    const content = result.content as Array<{ type: string; data?: string; mimeType?: string }>;
    expect(content[0].type).toBe("image");
    expect(content[0].mimeType).toBe("image/png");
    expect(content[0].data).toBeDefined();
  });

  it("get_screenshot returns error for missing screenshot", async () => {
    const result = await client.callTool({ name: "get_screenshot", arguments: { id: "nonexistent" } });
    expect(result.isError).toBe(true);
  });

  it("resolve marks an annotation as resolved", async () => {
    const a = await storage.add({
      url: "http://localhost:3000",
      x: 0, y: 0,
      element: "div", element_path: "body > div",
      comment: "Resolve me",
    });
    const result = await client.callTool({ name: "resolve", arguments: { id: a.id } });
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("resolved");
    const all = await storage.getAll();
    expect(all[0].resolved).toBe(true);
  });
});
