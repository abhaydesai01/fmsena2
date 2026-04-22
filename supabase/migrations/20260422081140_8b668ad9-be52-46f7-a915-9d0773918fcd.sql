
-- Fix function search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Tighten reminders insert policy (require triggered_by = auth.uid() OR admin)
DROP POLICY IF EXISTS "auth write reminders" ON public.reminders;
CREATE POLICY "auth write reminders" ON public.reminders FOR INSERT TO authenticated
  WITH CHECK (triggered_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
