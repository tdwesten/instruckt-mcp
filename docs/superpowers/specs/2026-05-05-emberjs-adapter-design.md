# Ember.js 6+ adapter — design

## Doel

Een adapter voor Ember.js 6+ projecten waarmee de instruckt annotations API tijdens
development meedraait via Ember CLI's server middleware (`server/index.js`). Spiegelt
de bestaande Next.js adapter qua API-stijl: één import, één regel setup.

## Scope

- **In scope**: Ember CLI dev-server middleware (Express-stijl `app`).
- **Out of scope**: productiebackend (gebruiker valt terug op `createRequestHandlers`
  met eigen Node server), FastBoot, Ember Data adapters.

## Publieke API

```js
// server/index.js (in een Ember 6+ project)
const { createEmberMiddleware } = require('@tdwesten/instruckt-mcp/ember');

module.exports = createEmberMiddleware({
  route: '/api/annotations', // optioneel, default
  dir: '.instruckt',         // optioneel, default
});
```

`createEmberMiddleware(options?)` retourneert een functie met de signatuur
`(app) => void` die Ember CLI verwacht voor `server/index.js`. De functie registreert
de routes op de Express `app`.

### Opties

| Optie  | Type   | Default              | Beschrijving                                  |
| ------ | ------ | -------------------- | --------------------------------------------- |
| route  | string | `/api/annotations`   | Basispad waarop de endpoints geregistreerd worden |
| dir    | string | `.instruckt`         | Opslag-directory (zelfde semantiek als overige adapters) |

## Geregistreerde endpoints

Gegeven `route = '/api/annotations'`:

- `GET  /api/annotations`        → `handlers.getAnnotations()`
- `POST /api/annotations`        → `handlers.createAnnotation(body)` (201 bij succes)
- `PATCH /api/annotations/:id`   → `handlers.updateAnnotation(id, body)` (404 als id niet bestaat)

## Implementatie

- Nieuw bestand `src/ember.ts`.
- Hergebruikt `InstrucktStorage` en `createRequestHandlers` (zelfde patroon als `nextjs.ts`).
- Express types worden duck-getyped via een minimale interface (`{ get, post, patch, use }` met `(req, res)` handlers) — geen `@types/express` of `express` dependency. De Ember CLI-gebruiker heeft Express al via Ember CLI zelf.
- Body parsing: registreert `express.json({ limit: '10mb' })` op de eigen routes via `app.use(route, json({ limit: '10mb' }))`. Limit moet ruim genoeg zijn voor base64 screenshots. Ember CLI's standaard body parser is niet gegarandeerd, en de payload-grootte standaard wel te klein.
  - Issue: we hebben geen directe `express` import beschikbaar. Oplossing: lees `require('body-parser')` of `require('express').json` lazy via de meegegeven `app` is niet mogelijk. Daarom: een kleine eigen body parser inline (lees `req` stream, parse JSON) — vermijdt extra dependency en houdt het package klein.

## Build & packaging

- `tsup.config.ts`: voeg `src/ember.ts` toe aan entry points.
- `package.json` `exports`: voeg `./ember` entry toe met `types`, `import`, `require`.

## Documentatie

README krijgt een Ember sectie naast Next.js met:
- Setup voorbeeld (`server/index.js`).
- Expliciete melding: alleen development. Voor productie verwijzing naar "Custom backend" sectie.

## Tests

Unit test in `tests/ember.test.ts`:
- Maakt een mock Express `app` (object met `get`, `post`, `patch`, `use` spies).
- Verifieert dat `createEmberMiddleware()(app)` de juiste handlers op de juiste paths registreert.
- Roep de handlers aan met mock `req`/`res` voor de drie operaties en check status codes + payloads (incl. 404 bij onbekende id, 400 bij ontbrekende id voor PATCH).
