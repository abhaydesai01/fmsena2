-- Add NEET application form fields to students table
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS course_type text,                  -- 'long_term' | 'crash_course'
  ADD COLUMN IF NOT EXISTS course_stream text,                -- 'neet' | 'kcet'
  ADD COLUMN IF NOT EXISTS pan_number text,
  ADD COLUMN IF NOT EXISTS puc_hall_ticket_no text,
  ADD COLUMN IF NOT EXISTS sslc_register_number text,
  ADD COLUMN IF NOT EXISTS puc_total_percent numeric,
  ADD COLUMN IF NOT EXISTS puc_pcmb_percent numeric,
  ADD COLUMN IF NOT EXISTS neet_marks_obtained text,
  ADD COLUMN IF NOT EXISTS admission_type text,               -- 'residential' | 'non_residential'
  ADD COLUMN IF NOT EXISTS sub_caste_group text,              -- 'CA-I' | 'IIA' | 'IIB' | 'IIIA' | 'IIIB'
  ADD COLUMN IF NOT EXISTS college_type text,                 -- 'state_board' | 'cbse_board'
  ADD COLUMN IF NOT EXISTS van_facility_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS present_address_pincode text,
  ADD COLUMN IF NOT EXISTS permanent_address_pincode text,
  ADD COLUMN IF NOT EXISTS mobile_secondary text,
  ADD COLUMN IF NOT EXISTS admission_place text,
  ADD COLUMN IF NOT EXISTS family_annual_income numeric;