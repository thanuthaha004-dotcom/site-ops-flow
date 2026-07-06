
-- Engineers: authenticated read; admin write
DROP POLICY IF EXISTS "Allow all access to engineers" ON public.engineers;
CREATE POLICY "Authenticated read engineers" ON public.engineers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage engineers" ON public.engineers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Workers: authenticated read; admin write
DROP POLICY IF EXISTS "Allow all access to workers" ON public.workers;
CREATE POLICY "Authenticated read workers" ON public.workers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage workers" ON public.workers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Driver area defaults: authenticated read; admin write
DROP POLICY IF EXISTS "Allow all access to driver_area_defaults" ON public.driver_area_defaults;
CREATE POLICY "Authenticated read driver_area_defaults" ON public.driver_area_defaults
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage driver_area_defaults" ON public.driver_area_defaults
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Ensure grants cover authenticated needs
GRANT SELECT ON public.engineers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.engineers TO authenticated;
GRANT SELECT ON public.workers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.workers TO authenticated;
GRANT SELECT ON public.driver_area_defaults TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.driver_area_defaults TO authenticated;

-- Revoke direct EXECUTE on SECURITY DEFINER helpers (still usable inside RLS/triggers)
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.driver_can_see_project(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_user_drives_vehicle(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
