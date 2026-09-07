CREATE TABLE public.lm_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code text NOT NULL,
  inspected_on date NOT NULL DEFAULT current_date,
  officer text NOT NULL DEFAULT '',
  site text NOT NULL DEFAULT '',
  batch_no text NOT NULL DEFAULT '',
  lot_size text NOT NULL DEFAULT '',
  verdict text NOT NULL,
  note text NOT NULL DEFAULT '',
  flagged text[] NOT NULL DEFAULT '{}',
  label_image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.lm_inspections TO anon, authenticated;
GRANT ALL ON public.lm_inspections TO service_role;
ALTER TABLE public.lm_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lm_inspections readable" ON public.lm_inspections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lm_inspections writable" ON public.lm_inspections FOR INSERT TO anon, authenticated WITH CHECK (true);

INSERT INTO public.lm_inspections (product_code, inspected_on, officer, verdict, note, flagged) VALUES
  ('LMPC-P-1001', '2026-08-21', 'A. Rao', 'REVIEW', 'Country of origin not captured in the scanned frame.', '{LMPC-R6-COO}'),
  ('LMPC-P-1001', '2026-05-14', 'A. Rao', 'PASS', 'All Rule 6 declarations present and legible.', '{}'),
  ('LMPC-P-1002', '2026-08-19', 'S. Menon', 'FAIL', 'Manufacturer name and address missing from the principal display panel.', '{LMPC-R6-MFR}'),
  ('LMPC-P-1002', '2026-04-02', 'S. Menon', 'FAIL', 'Manufacturer name and address missing from the principal display panel.', '{LMPC-R6-MFR}'),
  ('LMPC-P-1003', '2026-08-11', 'A. Rao', 'PASS', 'All Rule 6 declarations present and legible.', '{}'),
  ('LMPC-P-1004', '2026-07-30', 'K. Iyer', 'PASS', 'All Rule 6 declarations present and legible.', '{}'),
  ('LMPC-P-1005', '2026-08-05', 'K. Iyer', 'FAIL', 'MRP printed without the "inclusive of all taxes" clause.', '{LMPC-R6-MRP}'),
  ('LMPC-P-1005', '2026-06-18', 'K. Iyer', 'REVIEW', 'MRP clause unreadable in the scanned frame.', '{LMPC-R6-MRP}'),
  ('LMPC-P-1006', '2026-08-24', 'S. Menon', 'REVIEW', 'Country of origin read at low confidence; manual verification required.', '{LMPC-R6-COO}');
