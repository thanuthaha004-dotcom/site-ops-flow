
CREATE TABLE public.zone_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone text NOT NULL,
  location_keyword text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX zone_locations_keyword_uniq ON public.zone_locations (upper(location_keyword));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zone_locations TO authenticated;
GRANT ALL ON public.zone_locations TO service_role;

ALTER TABLE public.zone_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read zone_locations"
  ON public.zone_locations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins insert zone_locations"
  ON public.zone_locations FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update zone_locations"
  ON public.zone_locations FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete zone_locations"
  ON public.zone_locations FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER zone_locations_updated_at
  BEFORE UPDATE ON public.zone_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
