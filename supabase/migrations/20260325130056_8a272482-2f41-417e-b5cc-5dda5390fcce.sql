
CREATE TABLE public.trip_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_date DATE NOT NULL,
  worker_name TEXT NOT NULL,
  site TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  time_slot TEXT NOT NULL,
  urgent BOOLEAN NOT NULL DEFAULT false,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  project_name TEXT NOT NULL DEFAULT '',
  vehicle_type TEXT,
  vehicle_number TEXT,
  status TEXT NOT NULL DEFAULT 'assigned',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to trip_schedules" ON public.trip_schedules FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_trip_schedules_date ON public.trip_schedules(trip_date);
