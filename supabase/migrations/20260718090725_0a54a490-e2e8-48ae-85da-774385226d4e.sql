
CREATE TABLE public.vehicle_occupancy (
  vehicle_number text PRIMARY KEY,
  passenger_count integer NOT NULL DEFAULT 0 CHECK (passenger_count >= 0),
  material_percent integer NOT NULL DEFAULT 0 CHECK (material_percent IN (0,25,50,75,100)),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.vehicle_occupancy TO authenticated;
GRANT ALL ON public.vehicle_occupancy TO service_role;

ALTER TABLE public.vehicle_occupancy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view occupancy"
  ON public.vehicle_occupancy FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'engineer')
    OR public.has_role(auth.uid(), 'driver')
  );

CREATE POLICY "Driver can insert own vehicle occupancy"
  ON public.vehicle_occupancy FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_drives_vehicle(vehicle_number));

CREATE POLICY "Driver can update own vehicle occupancy"
  ON public.vehicle_occupancy FOR UPDATE
  TO authenticated
  USING (public.current_user_drives_vehicle(vehicle_number))
  WITH CHECK (public.current_user_drives_vehicle(vehicle_number));

CREATE POLICY "Admin can manage occupancy"
  ON public.vehicle_occupancy FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER vehicle_occupancy_touch
  BEFORE UPDATE ON public.vehicle_occupancy
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_occupancy;
ALTER TABLE public.vehicle_occupancy REPLICA IDENTITY FULL;
