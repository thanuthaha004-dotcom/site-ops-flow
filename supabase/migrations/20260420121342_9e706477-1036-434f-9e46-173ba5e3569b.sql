INSERT INTO public.user_roles (user_id, role, pending)
VALUES ('8842906c-4e0b-4fda-b1d6-d8d9ad928b7d', 'engineer', false)
ON CONFLICT DO NOTHING;