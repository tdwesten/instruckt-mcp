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
| [Ember.js 6+](#emberjs-6) | Dev-server middleware via `server/index.js` |
| [Custom backend](#custom-backend) | Any Node.js framework |

---

### Next.js

Create a route handler at `app/api/annotations/[[...slug]]/route.ts`:

```ts
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

### Ember.js 6+

Add the adapter to your Ember CLI dev-server in `server/index.js`:

```js
const { createEmberMiddleware } = require('@tdwesten/instruckt-mcp/ember');

module.exports = createEmberMiddleware();
```

This registers `GET`, `POST`, and `PATCH /api/annotations` on the Ember CLI Express
dev-server. Request bodies up to 10 MB are accepted (large enough for base64-encoded
screenshots). Options:

| Option | Type   | Default              | Description                       |
| ------ | ------ | -------------------- | --------------------------------- |
| route  | string | `/api/annotations`   | Base path for the endpoints (trailing slashes are trimmed) |
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

## MCP Tools

Once connected, your AI agent has three tools:

| Tool | Description |
|------|-------------|
| `get_all_pending` | Returns all unresolved annotations — comment, element, page URL, severity |
| `get_screenshot` | Returns the screenshot image for a specific annotation by ID |
| `resolve` | Marks an annotation as resolved; the instruckt widget removes the marker on its next poll |

## How It Works

1. instruckt runs in your app and captures annotations with optional screenshots
2. Annotations are posted to your API endpoint and stored as JSON on disk
3. Your AI agent connects via MCP and calls `get_all_pending` to see what needs fixing
4. The agent reads the feedback, inspects screenshots with `get_screenshot`, and makes code changes
5. When done, the agent calls `resolve` — the widget picks up the status change on its next poll and removes the marker

## Storage

Annotations are stored in `.instruckt/annotations.json`. Screenshots go in `.instruckt/screenshots/<id>.png`. The directory is created automatically on first use.

```ts
import { InstrucktStorage } from 'instruckt-mcp'

const storage = new InstrucktStorage('.instruckt')

await storage.getAll()          // all annotations
await storage.getPending()      // unresolved only
await storage.add(input)        // create annotation
await storage.update(id, input) // update annotation
await storage.resolve(id)       // mark as resolved
await storage.getScreenshot(id) // Buffer | null
```

## License

MIT
