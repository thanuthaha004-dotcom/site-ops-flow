-- Allow drivers to view their past 7 days of trips (in addition to today + next 7)
DROP POLICY IF EXISTS "Drivers read own upcoming trips" ON public.trip_schedules;

CREATE POLICY "Drivers read own trips window"
ON public.trip_schedules
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'driver'::app_role)
  AND vehicle_number IS NOT NULL
  AND current_user_drives_vehicle(vehicle_number)
  AND trip_date >= (CURRENT_DATE - 7)
  AND trip_date <= (CURRENT_DATE + 7)
);

-- Match the segments policy to the same window
DROP POLICY IF EXISTS "Drivers read own segments" ON public.trip_segments;

CREATE POLICY "Drivers read own segments window"
ON public.trip_segments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'driver'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.trip_schedules ts
    WHERE ts.id = trip_segments.trip_id
      AND ts.vehicle_number IS NOT NULL
      AND current_user_drives_vehicle(ts.vehicle_number)
      AND ts.trip_date >= (CURRENT_DATE - 7)
      AND ts.trip_date <= (CURRENT_DATE + 7)
  )
);