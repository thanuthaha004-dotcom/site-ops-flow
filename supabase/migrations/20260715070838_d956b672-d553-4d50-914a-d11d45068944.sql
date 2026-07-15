ALTER TABLE public.trip_schedules ADD COLUMN IF NOT EXISTS execution_order integer;
CREATE INDEX IF NOT EXISTS idx_trip_schedules_date_order ON public.trip_schedules(trip_date, execution_order);