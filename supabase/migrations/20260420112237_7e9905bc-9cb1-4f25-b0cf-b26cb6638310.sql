-- Approval flag on user_roles
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS pending boolean NOT NULL DEFAULT false;

-- Vehicle <-> driver user link
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS driver_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_driver_user_id ON public.vehicles(driver_user_id);

-- Trip lifecycle columns
ALTER TABLE public.trip_schedules
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Trip segments table
CREATE TABLE IF NOT EXISTS public.trip_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trip_schedules(id) ON DELETE CASCADE,
  sequence int NOT NULL DEFAULT 1,
  site text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  project_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  paused_at timestamptz,
  total_paused_seconds int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_segments_trip_id ON public.trip_segments(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_segments_project_id ON public.trip_segments(project_id);

DROP TRIGGER IF EXISTS trg_trip_segments_updated_at ON public.trip_segments;
CREATE TRIGGER trg_trip_segments_updated_at
  BEFORE UPDATE ON public.trip_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.trip_segments ENABLE ROW LEVEL SECURITY;

-- Update has_role to ignore pending rows
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND pending = false
  )
$$;

-- Helper: does the current user drive this vehicle?
CREATE OR REPLACE FUNCTION public.current_user_drives_vehicle(_vehicle_number text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vehicles
    WHERE number = _vehicle_number
      AND driver_user_id = auth.uid()
  )
$$;

-- Helper: can current user (as driver) see this project?
CREATE OR REPLACE FUNCTION public.driver_can_see_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_schedules ts
    JOIN public.vehicles v ON v.number = ts.vehicle_number
    WHERE v.driver_user_id = auth.uid()
      AND ts.trip_date BETWEEN current_date AND current_date + 7
      AND (
        ts.project_id = _project_id
        OR EXISTS (
          SELECT 1 FROM public.trip_segments seg
          WHERE seg.trip_id = ts.id AND seg.project_id = _project_id
        )
      )
  )
$$;

-- Trigger: prevent completing a trip if any segment is not completed
CREATE OR REPLACE FUNCTION public.enforce_segments_completed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  incomplete_count int;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT COUNT(*) INTO incomplete_count
    FROM public.trip_segments
    WHERE trip_id = NEW.id AND status <> 'completed';

    IF incomplete_count > 0 THEN
      RAISE EXCEPTION 'Cannot complete trip: % segment(s) still incomplete', incomplete_count;
    END IF;

    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_segments_completed ON public.trip_schedules;
CREATE TRIGGER trg_enforce_segments_completed
  BEFORE UPDATE ON public.trip_schedules
  FOR EACH ROW EXECUTE FUNCTION public.enforce_segments_completed();

-- Replace permissive policies on trip_schedules
DROP POLICY IF EXISTS "Allow all access to trip_schedules" ON public.trip_schedules;

CREATE POLICY "Admins full access trip_schedules"
  ON public.trip_schedules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Engineers read trip_schedules"
  ON public.trip_schedules FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'engineer'));

CREATE POLICY "Drivers read own upcoming trips"
  ON public.trip_schedules FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver')
    AND vehicle_number IS NOT NULL
    AND public.current_user_drives_vehicle(vehicle_number)
    AND trip_date BETWEEN current_date AND current_date + 7
  );

CREATE POLICY "Drivers update own upcoming trips"
  ON public.trip_schedules FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver')
    AND vehicle_number IS NOT NULL
    AND public.current_user_drives_vehicle(vehicle_number)
    AND trip_date BETWEEN current_date AND current_date + 7
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'driver')
    AND vehicle_number IS NOT NULL
    AND public.current_user_drives_vehicle(vehicle_number)
  );

-- trip_segments policies
CREATE POLICY "Admins full access trip_segments"
  ON public.trip_segments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Engineers read trip_segments"
  ON public.trip_segments FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'engineer'));

CREATE POLICY "Drivers read own segments"
  ON public.trip_segments FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver')
    AND EXISTS (
      SELECT 1 FROM public.trip_schedules ts
      WHERE ts.id = trip_segments.trip_id
        AND ts.vehicle_number IS NOT NULL
        AND public.current_user_drives_vehicle(ts.vehicle_number)
        AND ts.trip_date BETWEEN current_date AND current_date + 7
    )
  );

CREATE POLICY "Drivers update own segments"
  ON public.trip_segments FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver')
    AND EXISTS (
      SELECT 1 FROM public.trip_schedules ts
      WHERE ts.id = trip_segments.trip_id
        AND ts.vehicle_number IS NOT NULL
        AND public.current_user_drives_vehicle(ts.vehicle_number)
        AND ts.trip_date BETWEEN current_date AND current_date + 7
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'driver')
    AND EXISTS (
      SELECT 1 FROM public.trip_schedules ts
      WHERE ts.id = trip_segments.trip_id
        AND ts.vehicle_number IS NOT NULL
        AND public.current_user_drives_vehicle(ts.vehicle_number)
    )
  );

-- Replace permissive policies on vehicles
DROP POLICY IF EXISTS "Allow all access to vehicles" ON public.vehicles;

CREATE POLICY "Admins full access vehicles"
  ON public.vehicles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Engineers read vehicles"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'engineer'));

CREATE POLICY "Drivers read own vehicle"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver')
    AND driver_user_id = auth.uid()
  );

-- Replace permissive policies on projects
DROP POLICY IF EXISTS "Allow all access to projects" ON public.projects;

CREATE POLICY "Admins full access projects"
  ON public.projects FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Engineers read projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'engineer'));

CREATE POLICY "Drivers read assigned projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'driver')
    AND public.driver_can_see_project(id)
  );

-- Allow self-insert for signup
DROP POLICY IF EXISTS "Users can request own role" ON public.user_roles;
CREATE POLICY "Users can request own role"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
