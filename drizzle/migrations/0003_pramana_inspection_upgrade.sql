ALTER TABLE public.lm_inspections
  ADD COLUMN IF NOT EXISTS local_uid TEXT,
  ADD COLUMN IF NOT EXISTS faces JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS declared_base NUMERIC,
  ADD COLUMN IF NOT EXISTS measured_base NUMERIC,
  ADD COLUMN IF NOT EXISTS measured_source TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS numeral_height_mm NUMERIC,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'CLOSED';

CREATE UNIQUE INDEX IF NOT EXISTS lm_inspections_local_uid_key ON public.lm_inspections (local_uid) WHERE local_uid IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lm_reinspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID REFERENCES public.lm_inspections(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT '',
  due_on DATE NOT NULL DEFAULT (CURRENT_DATE + 14),
  state TEXT NOT NULL DEFAULT 'PENDING',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.lm_reinspections TO anon;
GRANT SELECT, INSERT, UPDATE ON public.lm_reinspections TO authenticated;
GRANT ALL ON public.lm_reinspections TO service_role;

ALTER TABLE public.lm_reinspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lm_reinspections readable" ON public.lm_reinspections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lm_reinspections writable" ON public.lm_reinspections FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "lm_reinspections updatable" ON public.lm_reinspections FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);