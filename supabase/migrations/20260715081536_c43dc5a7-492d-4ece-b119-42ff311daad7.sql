REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_user_drives_vehicle(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.driver_can_see_project(uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_drives_vehicle(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.driver_can_see_project(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_drives_vehicle(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.driver_can_see_project(uuid) TO authenticated;