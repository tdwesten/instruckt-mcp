import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { InstrucktStorage } from "../src/storage.js";
import { createMcpServer } from "../src/mcp-server.js";

const args = process.argv.slice(2);
let dir = ".instruckt";

const dirIndex = args.indexOf("--dir");
if (dirIndex !== -1 && args[dirIndex + 1]) {
  dir = args[dirIndex + 1];
}

const storage = new InstrucktStorage(dir);
const server = createMcpServer(storage);
const transport = new StdioServerTransport();
await server.connect(transport);
