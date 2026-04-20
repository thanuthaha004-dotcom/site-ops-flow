-- Link driver user account to vehicle so the RLS filter recognizes them
UPDATE public.vehicles
SET driver_user_id = '2cd2eccf-a255-4327-ba28-842877caefe5'
WHERE number = 'EE 38105';

-- Clean up legacy "vehicle / driver" formatting in existing trip rows so the
-- driver-portal RLS function current_user_drives_vehicle(vehicle_number) matches.
UPDATE public.trip_schedules
SET vehicle_number = TRIM(SPLIT_PART(vehicle_number, '/', 1))
WHERE vehicle_number LIKE '%/%';