# Architecture

```
Browser (Next.js, mobile-first)                    Server (Next.js route handlers, stateless)
───────────────────────────────                    ───────────────────────────────────────────
photo → resize (EXIF-aware)  ──POST /api/analyze──▶ RoomAnalyzer (Claude vision) → RoomAnalysis
style / budget / keep / text ──POST /api/plan─────▶ createDesignPlan
                                                      1. slots allowed (room type − kept items)
                                                      2. HybridRetriever → candidates per slot
                                                         (catalog filters + tags + style priors
                                                          [+ vector similarity when configured])
                                                      3. Stylist (Claude) rates real candidate ids,
                                                         picks slots/quantities/placement
                                                      4. optimizeSelection — exact multiple-choice
                                                         knapsack on real prices (no LLM maths)
                                                      5. accessories (e.g. inner cushions)
                                                      6. live price check (retailer adapter)
letterbox to model ratio     ──POST /api/render───▶ fetch real product photos → render prompt with
                                                      room-fidelity rules → ImageEditor (OpenAI)
crop back to original frame
                             ──POST /api/locate───▶ ProductLocator (Claude vision) → hotspots
IndexedDB: rooms, designs, saved products
```

## Key decisions

- **Catalog-first.** Products are chosen *before* any image exists; the render is instructed to use exactly
  those products (with their photos as references). Every item in the shopping list is a catalog record.
- **LLM ranks, code decides the money.** The stylist only scores given ids; totals and budget fitting are
  computed deterministically from catalog prices (`src/server/design/optimizer.ts`).
- **Room fidelity.** The analysis captures architecture/camera/light; the render prompt makes those
  absolute constraints, lists kept items, and forbids adding anything not in the plan. Photos are
  letterboxed (not cropped/stretched) to the model's aspect ratio and cropped back.
- **Retailer-agnostic.** `RetailerAdapter` (`getProducts/getProduct/searchProducts/getPrice/getAvailability/getProductUrl`)
  with `IkeaIsraelAdapter` as the first implementation; `CatalogSource` makes the data source swappable.
  Adding Zara Home / FOX = new adapter + registry entry.
- **Provider abstraction.** `RoomAnalyzer`, `Stylist`, `ProductLocator`, `ImageEditor`, `Embedder` —
  each can move to another vendor independently; demo implementations keep the app usable without keys.
- **NestJS.** The spec preferred Nest; for a one-click Vercel deployment the MVP uses Next.js route
  handlers. The server code in `src/server/*` is framework-free (plain classes/functions), so it can be
  mounted in Nest modules (Catalog, Retrieval, AI, Design) unchanged when a separate backend is needed.
- **Persistence.** MVP stores designs on the device. `db/schema.sql` is the Postgres + pgvector target
  (User, Room, Design, Product, DesignProduct, price snapshots).

## Known limitations

- Image models keep geometry well but cannot guarantee pixel-exact replicas of each SKU; the shopping list
  and product sheet always show the real product photo.
- The catalog is a 212-product bedroom-focused dev dataset; living/dining furniture (sofas, dining tables)
  is not included yet.
- Live price checks depend on ikea.com being reachable from the server; otherwise snapshot prices are
  labelled as such.
- No accounts, no server-side storage, no rate limiting beyond the optional access code.
