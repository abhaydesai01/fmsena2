
-- 1) Campuses
CREATE TABLE public.campuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read campuses" ON public.campuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write campuses" ON public.campuses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_campuses_updated BEFORE UPDATE ON public.campuses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed default
INSERT INTO public.campuses (name, address, city) VALUES ('Main Campus', 'Dharwad, Karnataka', 'Dharwad');

-- 2) Add campus_id to courses, batches, students
ALTER TABLE public.courses  ADD COLUMN campus_id UUID;
ALTER TABLE public.batches  ADD COLUMN campus_id UUID;
ALTER TABLE public.students ADD COLUMN campus_id UUID;

UPDATE public.courses  SET campus_id = (SELECT id FROM public.campuses LIMIT 1);
UPDATE public.batches  SET campus_id = (SELECT id FROM public.campuses LIMIT 1);
UPDATE public.students SET campus_id = (SELECT id FROM public.campuses LIMIT 1);

ALTER TABLE public.courses  ALTER COLUMN campus_id SET NOT NULL;
ALTER TABLE public.batches  ALTER COLUMN campus_id SET NOT NULL;
ALTER TABLE public.students ALTER COLUMN campus_id SET NOT NULL;

CREATE INDEX idx_courses_campus  ON public.courses(campus_id);
CREATE INDEX idx_batches_campus  ON public.batches(campus_id);
CREATE INDEX idx_students_campus ON public.students(campus_id);

-- 3) Expand students with offline-form fields
ALTER TABLE public.students
  ADD COLUMN blood_group        TEXT,
  ADD COLUMN category           TEXT,
  ADD COLUMN religion           TEXT,
  ADD COLUMN sub_caste          TEXT,
  ADD COLUMN mother_tongue      TEXT,
  ADD COLUMN languages_known    TEXT,
  ADD COLUMN place_of_birth     TEXT,
  ADD COLUMN sibling_info       TEXT,
  ADD COLUMN emergency_name     TEXT,
  ADD COLUMN emergency_relation TEXT,
  ADD COLUMN emergency_mobile   TEXT,
  ADD COLUMN previous_class     TEXT;

-- 4) Student documents (flexible)
CREATE TABLE public.student_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  label TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID,
  uploaded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_student_docs_student ON public.student_documents(student_id);
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read student_documents" ON public.student_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert student_documents" ON public.student_documents FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "admin manage student_documents" ON public.student_documents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5) Student transfers (batch shift / class promotion audit)
CREATE TABLE public.student_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('batch_transfer','class_promotion','campus_transfer')),
  from_batch_id UUID,
  to_batch_id   UUID,
  from_class    TEXT,
  to_class      TEXT,
  from_campus_id UUID,
  to_campus_id   UUID,
  reason TEXT,
  performed_by UUID,
  performed_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transfers_student ON public.student_transfers(student_id);
ALTER TABLE public.student_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read transfers" ON public.student_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write transfers" ON public.student_transfers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 6) Storage policies for student-files bucket
CREATE POLICY "auth read student-files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'student-files');
CREATE POLICY "auth upload student-files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'student-files');
CREATE POLICY "auth update student-files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'student-files');
CREATE POLICY "admin delete student-files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'student-files' AND has_role(auth.uid(), 'admin'::app_role));
