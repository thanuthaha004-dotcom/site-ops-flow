-- Assign engineer role to ANAS so the engineer panel loads
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'engineer'::app_role
FROM public.profiles
WHERE email = 'ameenpnvr369@gmail.com'
ON CONFLICT DO NOTHING;

-- Trim trailing/leading whitespace on engineer field in projects so name-matching works
UPDATE public.projects SET engineer = TRIM(engineer) WHERE engineer <> TRIM(engineer);