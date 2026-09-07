ALTER TABLE public.lm_limits
  ADD COLUMN tolerance_value numeric,
  ADD COLUMN tolerance_percent numeric;

ALTER TABLE public.lm_inspections
  ADD COLUMN instrument_id text,
  ADD COLUMN resolution_mm numeric,
  ADD COLUMN resolution_g numeric;