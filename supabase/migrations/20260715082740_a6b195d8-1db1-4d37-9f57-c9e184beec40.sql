-- Live driver locations (one row per driver, upserted)
CREATE TABLE public.driver_locations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy_m real,
  speed_kmh real,
  heading real,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_locations TO authenticated;
GRANT ALL ON public.driver_locations TO service_role;

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Driver can upsert / read own row
CREATE POLICY "Driver manages own location"
  ON public.driver_locations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all locations
CREATE POLICY "Admins read all driver locations"
  ON public.driver_locations
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
ALTER TABLE public.driver_locations REPLICA IDENTITY FULL;