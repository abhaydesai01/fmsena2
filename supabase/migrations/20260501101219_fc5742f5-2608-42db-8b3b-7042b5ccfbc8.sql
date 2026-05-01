
ALTER TABLE public.fee_assignments
  ADD COLUMN IF NOT EXISTS plan_kind text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS original_discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS concession_cancelled_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS month_label text;

CREATE TABLE IF NOT EXISTS public.plan_upgrades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  fee_assignment_id uuid NOT NULL,
  from_plan text NOT NULL,
  to_plan text NOT NULL,
  reason text,
  performed_by uuid,
  performed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plan_upgrades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read plan_upgrades" ON public.plan_upgrades
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write plan_upgrades" ON public.plan_upgrades
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.concession_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  fee_assignment_id uuid NOT NULL,
  original_discount numeric NOT NULL,
  cancelled_amount numeric NOT NULL,
  new_net_payable numeric NOT NULL,
  reason text,
  performed_by uuid,
  performed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.concession_cancellations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read concession_cancellations" ON public.concession_cancellations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write concession_cancellations" ON public.concession_cancellations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
