
CREATE TABLE public.trip_issue_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trip_schedules(id) ON DELETE CASCADE,
  driver_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL CHECK (length(trim(note)) > 0 AND length(note) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_issue_notes_trip ON public.trip_issue_notes(trip_id, created_at DESC);

GRANT SELECT, INSERT ON public.trip_issue_notes TO authenticated;
GRANT ALL ON public.trip_issue_notes TO service_role;

ALTER TABLE public.trip_issue_notes ENABLE ROW LEVEL SECURITY;

-- Driver can insert a note on a trip whose vehicle they currently drive
CREATE POLICY "Drivers add notes for their trip"
  ON public.trip_issue_notes FOR INSERT TO authenticated
  WITH CHECK (
    driver_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.trip_schedules t
      WHERE t.id = trip_id
        AND t.vehicle_number IS NOT NULL
        AND public.current_user_drives_vehicle(t.vehicle_number)
    )
  );

-- Driver can view notes for trips assigned to a vehicle they drive
CREATE POLICY "Drivers view notes on their trips"
  ON public.trip_issue_notes FOR SELECT TO authenticated
  USING (
    driver_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.trip_schedules t
      WHERE t.id = trip_id
        AND t.vehicle_number IS NOT NULL
        AND public.current_user_drives_vehicle(t.vehicle_number)
    )
  );

-- Admins & Engineers view all notes
CREATE POLICY "Admins and engineers view all notes"
  ON public.trip_issue_notes FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'engineer'::app_role)
  );

-- Admins delete
CREATE POLICY "Admins delete notes"
  ON public.trip_issue_notes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
