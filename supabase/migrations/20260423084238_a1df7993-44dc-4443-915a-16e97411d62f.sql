ALTER TABLE public.daily_trip_requests
  ADD COLUMN IF NOT EXISTS pickup_location TEXT DEFAULT 'Al Quoz Labour Camp',
  ADD COLUMN IF NOT EXISTS execution_order INTEGER;