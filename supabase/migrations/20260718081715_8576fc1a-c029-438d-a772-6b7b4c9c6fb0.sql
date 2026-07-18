ALTER TABLE public.daily_trip_requests
  ADD COLUMN IF NOT EXISTS expected_completion_time text,
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false;

ALTER TABLE public.trip_schedules
  ADD COLUMN IF NOT EXISTS expected_completion_time text,
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false;