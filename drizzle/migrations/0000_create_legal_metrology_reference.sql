CREATE TABLE public.lm_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  label text NOT NULL,
  kind text NOT NULL,
  base_factor numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lm_units TO anon, authenticated;
GRANT ALL ON public.lm_units TO service_role;
ALTER TABLE public.lm_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lm_units readable" ON public.lm_units FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lm_units writable" ON public.lm_units FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.lm_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  kind text NOT NULL,
  title text NOT NULL,
  requirement text NOT NULL,
  min_height_mm numeric,
  max_quantity_base numeric,
  citation text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lm_limits TO anon, authenticated;
GRANT ALL ON public.lm_limits TO service_role;
ALTER TABLE public.lm_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lm_limits readable" ON public.lm_limits FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lm_limits writable" ON public.lm_limits FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.lm_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  product text NOT NULL,
  category text NOT NULL,
  mrp numeric NOT NULL DEFAULT 0,
  net_quantity text NOT NULL,
  quantity_base numeric NOT NULL,
  unit_symbol text NOT NULL DEFAULT 'g',
  imported boolean NOT NULL DEFAULT false,
  label_image_url text,
  verdict text NOT NULL DEFAULT 'REVIEW',
  note text NOT NULL DEFAULT '',
  flagged text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lm_products TO anon, authenticated;
GRANT ALL ON public.lm_products TO service_role;
ALTER TABLE public.lm_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lm_products readable" ON public.lm_products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lm_products writable" ON public.lm_products FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "lm_products updatable" ON public.lm_products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.lm_units (symbol, label, kind, base_factor) VALUES
  ('g', 'gram', 'mass', 1),
  ('kg', 'kilogram', 'mass', 1000),
  ('ml', 'millilitre', 'volume', 1),
  ('L', 'litre', 'volume', 1000),
  ('N', 'count', 'count', 1),
  ('mm', 'millimetre', 'length', 1),
  ('cm', 'centimetre', 'length', 10);

INSERT INTO public.lm_limits (code, kind, title, requirement, min_height_mm, max_quantity_base, citation) VALUES
  ('LMPC-R6-MFR', 'declaration', 'Manufacturer / packer / importer name and address', 'Full name and complete address must be printed', NULL, NULL, 'Rule 6, LMPC Rules 2011'),
  ('LMPC-R6-QTY', 'declaration', 'Net quantity', 'Standard unit (g / kg / ml / L or count); numeral and unit together', NULL, NULL, 'Rule 6, LMPC Rules 2011'),
  ('LMPC-R6-MRP', 'declaration', 'Maximum retail price', 'Must state "inclusive of all taxes"; single price only', NULL, NULL, 'Rule 6, LMPC Rules 2011'),
  ('LMPC-R6-DATE', 'declaration', 'Month and year of manufacture / packing / import', 'MM/YYYY format minimum', NULL, NULL, 'Rule 6, LMPC Rules 2011'),
  ('LMPC-R6-CARE', 'declaration', 'Consumer care detail', 'Name, address, phone or email of consumer care', NULL, NULL, 'Rule 6, LMPC Rules 2011'),
  ('LMPC-R6-COO', 'declaration', 'Country of origin (imported goods only)', 'Mandatory for imported pre-packaged commodities', NULL, NULL, 'Rule 6, LMPC Rules 2011'),
  ('LMPC-R6-GEN', 'declaration', 'Common or generic name', 'Generic name of the commodity', NULL, NULL, 'Rule 6, LMPC Rules 2011'),
  ('LMPC-R7-FONT-A', 'font_band', 'Up to 200 g or 200 ml', 'Minimum numeral height 1 mm', 1, 200, 'Rule 7, LMPC Rules 2011'),
  ('LMPC-R7-FONT-B', 'font_band', 'Above 200 up to 500 g or ml', 'Minimum numeral height 2 mm', 2, 500, 'Rule 7, LMPC Rules 2011'),
  ('LMPC-R7-FONT-C', 'font_band', 'Above 500 g or ml up to 1 kg or L', 'Minimum numeral height 4 mm', 4, 1000, 'Rule 7, LMPC Rules 2011'),
  ('LMPC-R7-FONT-D', 'font_band', 'Above 1 kg or 1 L', 'Minimum numeral height 6 mm', 6, NULL, 'Rule 7, LMPC Rules 2011');

INSERT INTO public.lm_products (code, product, category, mrp, net_quantity, quantity_base, unit_symbol, imported, verdict, note, flagged) VALUES
  ('LMPC-P-1001', 'Sunrise Refined Sunflower Oil', 'Edible Oil', 189, '1000 ml', 1000, 'ml', false, 'REVIEW', 'Country of origin not captured in the scanned frame.', '{LMPC-R6-COO}'),
  ('LMPC-P-1002', 'Farmfresh Basmati Rice', 'Staples', 780, '5 kg', 5000, 'kg', false, 'FAIL', 'Manufacturer name and address missing from the principal display panel.', '{LMPC-R6-MFR}'),
  ('LMPC-P-1003', 'Clarion Handwash', 'Personal Care', 95, '200 ml', 200, 'ml', false, 'PASS', 'All Rule 6 declarations present and legible.', '{}'),
  ('LMPC-P-1004', 'Kavya Turmeric Powder', 'Food', 54, '100 g', 100, 'g', false, 'PASS', 'All Rule 6 declarations present and legible.', '{}'),
  ('LMPC-P-1005', 'Nova Detergent Bar', 'Household', 42, '250 g', 250, 'g', false, 'FAIL', 'MRP printed without the "inclusive of all taxes" clause.', '{LMPC-R6-MRP}'),
  ('LMPC-P-1006', 'Belgian Cocoa Powder (Imported)', 'Imported / Food', 390, '250 g', 250, 'g', true, 'REVIEW', 'Country of origin read at low confidence; manual verification required.', '{LMPC-R6-COO}');
