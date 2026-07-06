GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_can_see_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_drives_vehicle(text) TO authenticated;