# My Home Private Stylist — MVP

Upload a photo of a real room → pick a style and budget → the AI chooses **real IKEA Israel products**,
redesigns **the same room** around them, and shows exactly what to buy and what it costs.

> Imagine it. Design it. Shop it. Make it real.

## What works in this MVP

- Mobile-first web app (iPhone camera or photo library, HEIC handled by Safari)
- Room understanding (Claude): architecture, camera, light, existing furniture, keep suggestions
- Catalog-first design: retrieve real products → stylist rates them for *this* room → exact budget optimizer → render
- Photo-realistic edit of the user's own photo (OpenAI GPT Image) with strict room-fidelity rules and the real product photos as references
- Product hotspots on the generated image, product sheet, **Shop this room** list with total, "Shop at IKEA" links
- Variations: Try another style · Make it warmer · **Make it cheaper** · Change colours
- **Keep what I have** (bed, floor, walls, curtains, rug, side tables, lighting…) as hard constraints
- My Designs / Shop (saved products) / Profile — stored on the device (IndexedDB)
- Demo mode when API keys are missing: real catalog, prices and budget logic; the photo isn't re-rendered

## Product data — honest status

`src/server/catalog/data/ikea-il.dev.json` is a **development dataset**: 212 real IKEA Israel products
(bedroom-relevant categories) captured from public ikea.com/il/he category pages on 29 Sep 2026 — names,
article numbers, ILS prices, product URLs and image URLs exactly as shown there (raw capture in
`data/raw/`, normalized by `scripts/build-catalog.mjs`). Nothing is invented.

- At design time the server re-checks each selected product's live page (schema.org JSON-LD) and marks it
  **Live IKEA price · checked HH:MM**. If that fails, the UI says **Catalog price · 29 Sep 2026**; unknown
  products show **Product verification required**.
- `npm run catalog:refresh` re-checks all prices from a machine that can reach ikea.com.
- For production, replace the dev dataset with an approved feed/API via `CatalogSource`
  (`src/server/catalog/sources.ts`). IKEA's terms may restrict automated collection — get permission or a
  partner/affiliate feed before launch.

## Deploy to Vercel (≈5 minutes)

1. Push this repo to GitHub (already done if you asked Claude to).
2. vercel.com → **Add New… → Project** → import the repo. Framework: Next.js (auto-detected). **Deploy**.
3. Project → **Settings → Environment Variables** (Production + Preview):
   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | from https://platform.claude.com/settings/keys |
   | `OPENAI_API_KEY` | from https://platform.openai.com/api-keys |
   | `APP_ACCESS_CODE` | any passcode — strongly recommended so strangers can't spend your credits |
   | `OPENAI_IMAGE_MODEL` *(optional)* | default `gpt-image-1.5` |
   | `OPENAI_IMAGE_QUALITY` *(optional)* | `high` (default) / `medium` (faster, cheaper) |
   | `ANTHROPIC_MODEL` *(optional)* | default `claude-sonnet-5-5` |
4. **Deployments → ⋯ → Redeploy** so the variables take effect.
5. Open the URL on your iPhone → Share → **Add to Home Screen** for an app-like experience.

Rendering takes ~30–120 s; the render route is configured for up to 300 s (`maxDuration`), which Vercel
supports with Fluid Compute (default on new projects). If you see timeouts, set `OPENAI_IMAGE_QUALITY=medium`.

## Run locally

```bash
npm install
cp .env.example .env.local   # add keys, or leave empty for demo mode
npm run dev                  # http://localhost:3000
npm test                     # optimizer, JSON-LD parser, full planning pipeline
```

See `docs/ARCHITECTURE.md` for the design.
"# my-home-stylist" 
