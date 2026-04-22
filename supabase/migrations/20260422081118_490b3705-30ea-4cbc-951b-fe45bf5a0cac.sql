
-- ============================================================================
-- ENA Fees Management System - Initial Schema
-- ============================================================================

-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'cashier');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'cashier' THEN 2 END
  LIMIT 1
$$;

-- RLS for user_roles
CREATE POLICY "users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- Settings (academic year + grace period + bounce charge etc.)
-- ============================================================================
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  active_academic_year TEXT NOT NULL DEFAULT '2025-26',
  grace_period_days INT NOT NULL DEFAULT 7,
  late_fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  late_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  bounce_charge NUMERIC(10,2) NOT NULL DEFAULT 500,
  institute_name TEXT NOT NULL DEFAULT 'Excellent NEET Academy',
  institute_address TEXT NOT NULL DEFAULT 'Dharwad, Karnataka',
  receipt_prefix TEXT NOT NULL DEFAULT 'ENA/RCPT',
  admission_prefix TEXT NOT NULL DEFAULT 'ENA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.settings DEFAULT VALUES;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all auth read settings" ON public.settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin updates settings" ON public.settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- Courses
-- ============================================================================
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  duration_months INT NOT NULL DEFAULT 12,
  gross_fee NUMERIC(12,2) NOT NULL,
  registration_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  material_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  test_series_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  academic_year TEXT NOT NULL DEFAULT '2025-26',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read courses" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write courses" ON public.courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- Batches
-- ============================================================================
CREATE TYPE public.batch_status AS ENUM ('active', 'full', 'closed');

CREATE TABLE public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE RESTRICT NOT NULL,
  name TEXT NOT NULL,
  timing TEXT NOT NULL DEFAULT '',
  capacity INT NOT NULL DEFAULT 50,
  start_date DATE,
  status batch_status NOT NULL DEFAULT 'active',
  academic_year TEXT NOT NULL DEFAULT '2025-26',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read batches" ON public.batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write batches" ON public.batches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- Students
-- ============================================================================
CREATE TYPE public.student_status AS ENUM ('active', 'discontinued', 'completed');
CREATE TYPE public.gender AS ENUM ('male', 'female', 'other');
CREATE TYPE public.class_year AS ENUM ('11th', '12th', 'dropper');

CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_number TEXT NOT NULL UNIQUE,

  -- Personal
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender gender NOT NULL,
  photo_url TEXT,
  aadhaar_number TEXT,
  mobile TEXT NOT NULL,
  email TEXT,
  permanent_address TEXT NOT NULL,
  current_address TEXT,
  nationality TEXT DEFAULT 'Indian',

  -- Academic
  class_year class_year NOT NULL,
  previous_school TEXT,
  board TEXT,
  marks_10th TEXT,
  marks_12th TEXT,
  neet_attempt INT,
  previous_neet_score TEXT,

  -- Parent / Guardian
  father_name TEXT NOT NULL,
  father_occupation TEXT,
  father_mobile TEXT NOT NULL,
  mother_name TEXT,
  mother_mobile TEXT,
  guardian_name TEXT,
  guardian_mobile TEXT,
  parent_email TEXT,
  parent_annual_income NUMERIC(12,2),

  -- Enrollment
  admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  academic_year TEXT NOT NULL DEFAULT '2025-26',
  course_id UUID REFERENCES public.courses(id) ON DELETE RESTRICT NOT NULL,
  batch_id UUID REFERENCES public.batches(id) ON DELETE RESTRICT NOT NULL,
  medium TEXT,
  hostel_required BOOLEAN NOT NULL DEFAULT false,
  transport_required BOOLEAN NOT NULL DEFAULT false,
  referred_by TEXT,
  status student_status NOT NULL DEFAULT 'active',

  -- Documents
  aadhaar_doc_url TEXT,
  marksheet_10_url TEXT,
  marksheet_12_url TEXT,
  tc_url TEXT,
  passport_photo_copies INT DEFAULT 0,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_students_mobile ON public.students(mobile);
CREATE INDEX idx_students_name ON public.students(full_name);
CREATE INDEX idx_students_batch ON public.students(batch_id);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read students" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write students" ON public.students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- Fee Assignments (one per student - the contract)
-- ============================================================================
CREATE TYPE public.discount_type AS ENUM ('round_off', 'slab_10', 'slab_15', 'slab_20', 'special');

CREATE TABLE public.fee_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL UNIQUE,
  course_id UUID REFERENCES public.courses(id) NOT NULL,
  gross_fee NUMERIC(12,2) NOT NULL,
  discount_type discount_type NOT NULL,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_reason TEXT,
  net_payable NUMERIC(12,2) NOT NULL,
  installment_count INT NOT NULL CHECK (installment_count IN (3, 4)),
  registration_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  material_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  hostel_fee_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
  transport_fee_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fee_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read fee_assignments" ON public.fee_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write fee_assignments" ON public.fee_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- Installments
-- ============================================================================
CREATE TYPE public.installment_status AS ENUM ('due', 'partial', 'paid', 'overdue');

CREATE TABLE public.installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_assignment_id UUID REFERENCES public.fee_assignments(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  installment_no INT NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  late_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  status installment_status NOT NULL DEFAULT 'due',
  is_registration BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fee_assignment_id, installment_no, is_registration)
);

CREATE INDEX idx_installments_student ON public.installments(student_id);
CREATE INDEX idx_installments_due ON public.installments(due_date, status);

ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read installments" ON public.installments FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write installments" ON public.installments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- cashier can update via payments (handled by trigger / function)

-- ============================================================================
-- Payments + Receipts (atomic - one payment = one receipt)
-- ============================================================================
CREATE TYPE public.payment_mode AS ENUM ('cash', 'upi', 'cheque', 'dd', 'card');
CREATE TYPE public.payment_status AS ENUM ('cleared', 'pending', 'bounced', 'cancelled');

-- Sequence for receipt numbers
CREATE SEQUENCE public.receipt_seq START 1;

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  student_id UUID REFERENCES public.students(id) ON DELETE RESTRICT NOT NULL,
  installment_id UUID REFERENCES public.installments(id) ON DELETE RESTRICT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_mode payment_mode NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- mode specific
  upi_reference TEXT,
  cheque_number TEXT,
  cheque_date DATE,
  cheque_bank TEXT,
  card_last4 TEXT,
  status payment_status NOT NULL DEFAULT 'cleared',
  cleared_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT,
  notes TEXT,
  collected_by UUID REFERENCES auth.users(id) NOT NULL,
  collected_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_student ON public.payments(student_id);
CREATE INDEX idx_payments_date ON public.payments(payment_date);
CREATE INDEX idx_payments_collected_by ON public.payments(collected_by);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (collected_by = auth.uid());
CREATE POLICY "admin update payments" ON public.payments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- Refunds
-- ============================================================================
CREATE TABLE public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE RESTRICT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  mode payment_mode NOT NULL,
  refund_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  processed_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read refunds" ON public.refunds FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write refunds" ON public.refunds FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- Reminder Log (stub for SMS/WhatsApp)
-- ============================================================================
CREATE TYPE public.reminder_channel AS ENUM ('sms', 'whatsapp');
CREATE TYPE public.reminder_kind AS ENUM ('upcoming_due', 'on_due', 'overdue', 'payment_confirm', 'cheque_bounce', 'manual');

CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  installment_id UUID REFERENCES public.installments(id) ON DELETE SET NULL,
  channel reminder_channel NOT NULL,
  kind reminder_kind NOT NULL,
  recipient_mobile TEXT NOT NULL,
  message TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  triggered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read reminders" ON public.reminders FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write reminders" ON public.reminders FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- Audit Log (append-only)
-- ============================================================================
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  actor_name TEXT NOT NULL,
  actor_role app_role,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_created ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_entity ON public.audit_log(entity_type, entity_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read audit" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "auth insert audit" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
-- No update/delete policies → append-only

-- ============================================================================
-- Helper functions
-- ============================================================================

-- Generate next admission number
CREATE OR REPLACE FUNCTION public.next_admission_number(_year TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _yy TEXT;
  _count INT;
  _prefix TEXT;
BEGIN
  -- 2025-26 → 2526
  _yy := REPLACE(SUBSTRING(_year FROM 3 FOR 2) || SUBSTRING(_year FROM 6 FOR 2), '-', '');
  SELECT admission_prefix INTO _prefix FROM public.settings LIMIT 1;
  SELECT COUNT(*) + 1 INTO _count FROM public.students WHERE academic_year = _year;
  RETURN _prefix || '/' || _yy || '/' || LPAD(_count::TEXT, 4, '0');
END;
$$;

-- Generate next receipt number
CREATE OR REPLACE FUNCTION public.next_receipt_number(_year TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _yy TEXT;
  _seq BIGINT;
  _prefix TEXT;
BEGIN
  _yy := SUBSTRING(_year FROM 3 FOR 2) || SUBSTRING(_year FROM 6 FOR 2);
  SELECT receipt_prefix INTO _prefix FROM public.settings LIMIT 1;
  _seq := nextval('public.receipt_seq');
  RETURN _prefix || '/' || _yy || '/' || LPAD(_seq::TEXT, 5, '0');
END;
$$;

-- Trigger: update installment status from payments
CREATE OR REPLACE FUNCTION public.recalc_installment(_installment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _amt NUMERIC;
  _paid NUMERIC;
  _due DATE;
BEGIN
  SELECT amount, due_date INTO _amt, _due FROM public.installments WHERE id = _installment_id;
  SELECT COALESCE(SUM(amount), 0) INTO _paid
    FROM public.payments
    WHERE installment_id = _installment_id AND status IN ('cleared', 'pending');
  UPDATE public.installments
    SET amount_paid = _paid,
        status = CASE
          WHEN _paid >= _amt THEN 'paid'::installment_status
          WHEN _paid > 0 THEN 'partial'::installment_status
          WHEN _due < CURRENT_DATE THEN 'overdue'::installment_status
          ELSE 'due'::installment_status
        END,
        updated_at = now()
    WHERE id = _installment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.payments_after_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_installment(OLD.installment_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_installment(NEW.installment_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER payments_recalc_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.payments_after_change();

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER touch_courses BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_batches BEFORE UPDATE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_students BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_fa BEFORE UPDATE ON public.fee_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_settings BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- Storage bucket for student photos & documents
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-files', 'student-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth read student files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'student-files');
CREATE POLICY "auth upload student files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'student-files');
CREATE POLICY "admin update student files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'student-files' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete student files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'student-files' AND public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- Auto-assign role on first signup (first user becomes admin, rest cashier)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INT;
  _name TEXT;
BEGIN
  SELECT COUNT(*) INTO _count FROM public.user_roles;
  _name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  IF _count = 0 THEN
    INSERT INTO public.user_roles (user_id, role, full_name) VALUES (NEW.id, 'admin', _name);
  ELSE
    INSERT INTO public.user_roles (user_id, role, full_name) VALUES (NEW.id, 'cashier', _name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
