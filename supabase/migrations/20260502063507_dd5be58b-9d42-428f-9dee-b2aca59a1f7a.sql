-- Prevent duplicate course presets per campus & academic year
CREATE UNIQUE INDEX IF NOT EXISTS courses_campus_name_year_unique
  ON public.courses (campus_id, name, academic_year);