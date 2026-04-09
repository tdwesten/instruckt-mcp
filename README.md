# instruckt-mcp

MCP server and API handlers for [instruckt](https://github.com/joshcirre/instruckt) visual annotations. Stores annotations and screenshots to disk, and exposes them to your AI agent via MCP tools.

## Install

```bash
npm install instruckt-mcp
```

## Quick Start

> **Pick your setup below** — each section is self-contained.

| Setup | Use when |
|-------|----------|
| [Next.js](#nextjs) | App Router route handler |
| [Custom backend](#custom-backend) | Any Node.js framework |
| [Standalone MCP server](#standalone-mcp-server) | No HTTP backend needed |

---

### Next.js

Create a route handler at `app/api/annotations/[[...slug]]/route.ts`:

```ts
// app/api/annotations/[[...slug]]/route.ts
import { createHandlers } from 'instruckt-mcp/nextjs'

export const { GET, POST, PATCH } = createHandlers()
```

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

### Custom backend

Use `createRequestHandlers` with any Node.js framework:

```ts
import { InstrucktStorage, createRequestHandlers } from 'instruckt-mcp'

const storage = new InstrucktStorage('.instruckt')
const handlers = createRequestHandlers(storage)

// GET /annotations
app.get('/annotations', async (req, res) => {
  res.json(await handlers.getAnnotations())
})

// POST /annotations
app.post('/annotations', async (req, res) => {
  res.status(201).json(await handlers.createAnnotation(req.body))
})

// PATCH /annotations/:id
app.patch('/annotations/:id', async (req, res) => {
  res.json(await handlers.updateAnnotation(req.params.id, req.body))
})
```

---

### Standalone MCP server

If you're using the Vite plugin's built-in dev server, you don't need an HTTP backend. Just point the MCP server at your `.instruckt` directory:

```json
{
  "mcpServers": {
    "instruckt": {
      "command": "npx",
      "args": ["instruckt-mcp", "--dir", ".instruckt"]
    }
  }
}
```

---

## MCP Tools

Once connected, your AI agent has three tools:

| Tool | Description |
|------|-------------|
| `get_all_pending` | Returns all unresolved annotations — comment, element, page URL, severity |
| `get_screenshot` | Returns the screenshot image for a specific annotation by ID |
| `resolve` | Marks an annotation as resolved, removing the marker on next page load |

## How It Works

1. instruckt runs in your app and captures annotations + optional screenshots
2. Annotations are posted to your API endpoint and stored as JSON on disk
3. Screenshots are saved as `.png` files alongside the JSON
4. Your AI agent connects via MCP and calls `get_all_pending` to see what needs fixing
5. The agent reads the feedback, looks at screenshots with `get_screenshot`, and makes code changes
6. When done, the agent calls `resolve` to clear the annotation

## Storage

Annotations are stored in `.instruckt/annotations.json`. Screenshots go in `.instruckt/screenshots/<id>.png`. The directory is created automatically on first use.

```ts
import { InstrucktStorage } from 'instruckt-mcp'

const storage = new InstrucktStorage('.instruckt')

await storage.getAll()          // all annotations
await storage.getPending()      // unresolved only
await storage.add(input)        // create annotation
await storage.update(id, input) // update annotation
await storage.resolve(id)       // mark resolved + remove from list
await storage.getScreenshot(id) // Buffer | null
```

## License

MIT
