ALTER TABLE public.trip_schedules
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';