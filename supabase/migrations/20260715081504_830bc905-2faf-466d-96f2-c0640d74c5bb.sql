CREATE OR REPLACE FUNCTION private.current_user_drives_vehicle(_vehicle_number text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vehicles
    WHERE regexp_replace(upper(coalesce(number, '')), '\s+', '', 'g') = regexp_replace(upper(coalesce(_vehicle_number, '')), '\s+', '', 'g')
      AND driver_user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_drives_vehicle(_vehicle_number text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT private.current_user_drives_vehicle(_vehicle_number)
$$;

CREATE OR REPLACE FUNCTION private.driver_can_see_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_schedules ts
    JOIN public.vehicles v
      ON regexp_replace(upper(coalesce(v.number, '')), '\s+', '', 'g') = regexp_replace(upper(coalesce(ts.vehicle_number, '')), '\s+', '', 'g')
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

CREATE OR REPLACE FUNCTION public.driver_can_see_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT private.driver_can_see_project(_project_id)
$$;