
CREATE TABLE public.engineers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.engineers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to engineers" ON public.engineers
  FOR ALL TO public
  USING (true) WITH CHECK (true);
