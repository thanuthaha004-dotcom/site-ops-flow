
-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'LPG',
  site TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active',
  priority TEXT NOT NULL DEFAULT 'Medium',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  progress INTEGER NOT NULL DEFAULT 0,
  workers_assigned INTEGER NOT NULL DEFAULT 0,
  workers_required INTEGER NOT NULL DEFAULT 1,
  engineer TEXT NOT NULL DEFAULT '',
  worker_names TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vehicles table
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '3 Ton Pickup',
  brand TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  capacity INTEGER NOT NULL DEFAULT 6,
  status TEXT NOT NULL DEFAULT 'Idle',
  driver TEXT NOT NULL DEFAULT '',
  utilization INTEGER NOT NULL DEFAULT 0,
  fuel_level INTEGER NOT NULL DEFAULT 100,
  current_route TEXT NOT NULL DEFAULT '—',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workers table
CREATE TABLE public.workers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  skills TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'Available',
  current_site TEXT NOT NULL DEFAULT '—',
  phone TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

-- For now, allow all access (no auth yet - will be restricted when auth is added)
CREATE POLICY "Allow all access to projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to vehicles" ON public.vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to workers" ON public.workers FOR ALL USING (true) WITH CHECK (true);

-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON public.workers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
