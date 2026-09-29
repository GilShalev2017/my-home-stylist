-- Target PostgreSQL schema (with pgvector) for when accounts & server-side storage are added.
-- The MVP is stateless on the server (designs are stored on the user's device); this schema mirrors
-- the domain types in src/lib/domain.ts so the move is mechanical.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE retailers (
  id            text PRIMARY KEY,            -- 'ikea-il', 'zara-home-il', 'fox-home' ...
  name          text NOT NULL,
  country       text NOT NULL,
  currency      text NOT NULL,
  homepage      text NOT NULL
);

CREATE TABLE products (
  id                   text PRIMARY KEY,     -- '<retailer>:<retailer_product_id>'
  retailer_id          text NOT NULL REFERENCES retailers(id),
  retailer_product_id  text NOT NULL,
  name                 text NOT NULL,
  name_local           text,
  name_en              text,
  category             text NOT NULL,
  subcategory          text,
  price                numeric(10,2) NOT NULL,
  currency             text NOT NULL,
  url                  text NOT NULL,
  image_url            text,
  dimensions_cm        int[],
  colors               text[] NOT NULL DEFAULT '{}',
  materials            text[] NOT NULL DEFAULT '{}',
  tags                 text[] NOT NULL DEFAULT '{}',
  styles               jsonb  NOT NULL DEFAULT '{}',
  description          text,
  availability         text NOT NULL DEFAULT 'unknown',
  source               jsonb  NOT NULL,     -- {kind, method, capturedAt}
  verification         jsonb  NOT NULL,     -- {status, checkedAt}
  embedding            vector(1024),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (retailer_id, retailer_product_id)
);
CREATE INDEX products_category_idx ON products (retailer_id, category);
CREATE INDEX products_embedding_idx ON products USING hnsw (embedding vector_cosine_ops);

CREATE TABLE product_price_snapshots (
  product_id  text NOT NULL REFERENCES products(id),
  price       numeric(10,2) NOT NULL,
  checked_at  timestamptz NOT NULL,
  method      text NOT NULL,                  -- 'feed' | 'live_page' | 'dev_dataset'
  PRIMARY KEY (product_id, checked_at)
);

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text UNIQUE NOT NULL,
  preferences     jsonb NOT NULL DEFAULT '{}',
  default_budget  numeric(10,2),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rooms (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid REFERENCES users(id),
  original_image     text NOT NULL,            -- object-storage key
  room_type          text NOT NULL,
  detected_elements  jsonb NOT NULL,           -- RoomAnalysis
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE designs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          uuid NOT NULL REFERENCES rooms(id),
  parent_design_id uuid REFERENCES designs(id),  -- variations ("make it cheaper", "try Japandi")
  style            text NOT NULL,
  action           text NOT NULL,
  instructions     text NOT NULL DEFAULT '',
  budget           numeric(10,2),
  keep             text[] NOT NULL DEFAULT '{}',
  concept          text,
  palette          text[],
  generated_image  text,                        -- object-storage key
  render_model     text,
  total_price      numeric(10,2) NOT NULL,
  currency         text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE design_products (
  design_id       uuid NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  product_id      text NOT NULL REFERENCES products(id),
  quantity        int  NOT NULL,
  role_in_design  text NOT NULL,               -- slot, e.g. 'rug', 'table_lamp'
  placement       text,
  confidence      real NOT NULL,
  unit_price      numeric(10,2) NOT NULL,      -- price at design time
  price_checked_at timestamptz NOT NULL,
  hotspot_x       real,
  hotspot_y       real,
  PRIMARY KEY (design_id, product_id, role_in_design)
);

CREATE TABLE saved_products (
  user_id    uuid NOT NULL REFERENCES users(id),
  product_id text NOT NULL REFERENCES products(id),
  saved_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
