CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND pending = false
  )
$$;

CREATE OR REPLACE FUNCTION private.current_user_drives_vehicle(_vehicle_number text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vehicles
    WHERE number = _vehicle_number
      AND driver_user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION private.driver_can_see_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
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
          SELECT 1
          FROM public.trip_segments seg
          WHERE seg.trip_id = ts.id
            AND seg.project_id = _project_id
        )
      )
  )
$$;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_drives_vehicle(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.driver_can_see_project(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins can read all requests" ON public.daily_trip_requests;
CREATE POLICY "Admins can read all requests"
  ON public.daily_trip_requests FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update requests" ON public.daily_trip_requests;
CREATE POLICY "Admins can update requests"
  ON public.daily_trip_requests FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage driver_area_defaults" ON public.driver_area_defaults;
CREATE POLICY "Admins manage driver_area_defaults"
  ON public.driver_area_defaults FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage engineers" ON public.engineers;
CREATE POLICY "Admins manage engineers"
  ON public.engineers FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins full access projects" ON public.projects;
CREATE POLICY "Admins full access projects"
  ON public.projects FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Engineers read projects" ON public.projects;
CREATE POLICY "Engineers read projects"
  ON public.projects FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'engineer'));

DROP POLICY IF EXISTS "Drivers read assigned projects" ON public.projects;
CREATE POLICY "Drivers read assigned projects"
  ON public.projects FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'driver') AND private.driver_can_see_project(id));

DROP POLICY IF EXISTS "Admins full access trip_schedules" ON public.trip_schedules;
CREATE POLICY "Admins full access trip_schedules"
  ON public.trip_schedules FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Engineers read trip_schedules" ON public.trip_schedules;
CREATE POLICY "Engineers read trip_schedules"
  ON public.trip_schedules FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'engineer'));

DROP POLICY IF EXISTS "Drivers read own trips window" ON public.trip_schedules;
CREATE POLICY "Drivers read own trips window"
  ON public.trip_schedules FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'driver')
    AND vehicle_number IS NOT NULL
    AND private.current_user_drives_vehicle(vehicle_number)
    AND trip_date >= current_date - 7
    AND trip_date <= current_date + 7
  );

DROP POLICY IF EXISTS "Drivers update own upcoming trips" ON public.trip_schedules;
CREATE POLICY "Drivers update own upcoming trips"
  ON public.trip_schedules FOR UPDATE TO authenticated
  USING (
    private.has_role(auth.uid(), 'driver')
    AND vehicle_number IS NOT NULL
    AND private.current_user_drives_vehicle(vehicle_number)
    AND trip_date >= current_date
    AND trip_date <= current_date + 7
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'driver')
    AND vehicle_number IS NOT NULL
    AND private.current_user_drives_vehicle(vehicle_number)
  );

DROP POLICY IF EXISTS "Admins full access trip_segments" ON public.trip_segments;
CREATE POLICY "Admins full access trip_segments"
  ON public.trip_segments FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Engineers read trip_segments" ON public.trip_segments;
CREATE POLICY "Engineers read trip_segments"
  ON public.trip_segments FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'engineer'));

DROP POLICY IF EXISTS "Drivers read own segments window" ON public.trip_segments;
CREATE POLICY "Drivers read own segments window"
  ON public.trip_segments FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'driver')
    AND EXISTS (
      SELECT 1
      FROM public.trip_schedules ts
      WHERE ts.id = trip_segments.trip_id
        AND ts.vehicle_number IS NOT NULL
        AND private.current_user_drives_vehicle(ts.vehicle_number)
        AND ts.trip_date >= current_date - 7
        AND ts.trip_date <= current_date + 7
    )
  );

DROP POLICY IF EXISTS "Drivers update own segments" ON public.trip_segments;
CREATE POLICY "Drivers update own segments"
  ON public.trip_segments FOR UPDATE TO authenticated
  USING (
    private.has_role(auth.uid(), 'driver')
    AND EXISTS (
      SELECT 1
      FROM public.trip_schedules ts
      WHERE ts.id = trip_segments.trip_id
        AND ts.vehicle_number IS NOT NULL
        AND private.current_user_drives_vehicle(ts.vehicle_number)
        AND ts.trip_date >= current_date
        AND ts.trip_date <= current_date + 7
    )
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'driver')
    AND EXISTS (
      SELECT 1
      FROM public.trip_schedules ts
      WHERE ts.id = trip_segments.trip_id
        AND ts.vehicle_number IS NOT NULL
        AND private.current_user_drives_vehicle(ts.vehicle_number)
    )
  );

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins full access vehicles" ON public.vehicles;
CREATE POLICY "Admins full access vehicles"
  ON public.vehicles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Engineers read vehicles" ON public.vehicles;
CREATE POLICY "Engineers read vehicles"
  ON public.vehicles FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'engineer'));

DROP POLICY IF EXISTS "Drivers read own vehicle" ON public.vehicles;
CREATE POLICY "Drivers read own vehicle"
  ON public.vehicles FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'driver') AND driver_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage workers" ON public.workers;
CREATE POLICY "Admins manage workers"
  ON public.workers FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.driver_can_see_project(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_user_drives_vehicle(text) FROM PUBLIC, anon, authenticated;