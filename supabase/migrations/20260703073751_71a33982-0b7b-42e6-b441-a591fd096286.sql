ALTER TABLE public.daily_trip_requests ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE public.daily_trip_requests DROP CONSTRAINT IF EXISTS daily_trip_requests_trip_date_project_id_key;