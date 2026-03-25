CREATE TABLE public.driver_area_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_name text NOT NULL,
  area text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(driver_name, area)
);

ALTER TABLE public.driver_area_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to driver_area_defaults"
  ON public.driver_area_defaults
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);