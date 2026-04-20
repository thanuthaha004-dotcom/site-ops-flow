-- Add engineer name and pickup location to trip_schedules so the driver can
-- see who requested the trip and where to pick up the workers.
ALTER TABLE public.trip_schedules
  ADD COLUMN IF NOT EXISTS engineer_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pickup_location TEXT NOT NULL DEFAULT 'Al Quoz Labour Camp';

-- Mirror these on segments so multi-stop trips also keep the engineer per stop.
ALTER TABLE public.trip_segments
  ADD COLUMN IF NOT EXISTS engineer_name TEXT NOT NULL DEFAULT '';