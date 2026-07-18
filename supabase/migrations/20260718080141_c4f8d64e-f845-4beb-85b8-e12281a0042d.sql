CREATE TABLE public.delivery_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX delivery_points_name_lower_idx ON public.delivery_points (lower(name));

GRANT SELECT, INSERT ON public.delivery_points TO authenticated;
GRANT ALL ON public.delivery_points TO service_role;

ALTER TABLE public.delivery_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view delivery points"
  ON public.delivery_points FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can add delivery points"
  ON public.delivery_points FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can delete delivery points"
  ON public.delivery_points FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_delivery_points_updated_at
  BEFORE UPDATE ON public.delivery_points
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();