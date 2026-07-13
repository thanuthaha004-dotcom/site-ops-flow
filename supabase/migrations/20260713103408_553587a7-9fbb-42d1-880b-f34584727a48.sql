
-- Restrict overly broad "authenticated read" SELECT policies on
-- driver_area_defaults, engineers, and workers so drivers/others can't read
-- operational and personal data they don't need.

-- driver_area_defaults: admin-only reads
DROP POLICY IF EXISTS "Authenticated read driver_area_defaults" ON public.driver_area_defaults;
CREATE POLICY "Admins read driver_area_defaults"
  ON public.driver_area_defaults
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- engineers: admin + engineer role reads (used by planners; drivers don't need it)
DROP POLICY IF EXISTS "Authenticated read engineers" ON public.engineers;
CREATE POLICY "Admins and engineers read engineers"
  ON public.engineers
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'engineer')
  );

-- workers: admin + engineer role reads
DROP POLICY IF EXISTS "Authenticated read workers" ON public.workers;
CREATE POLICY "Admins and engineers read workers"
  ON public.workers
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'engineer')
  );
