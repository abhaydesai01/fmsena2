export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string
          actor_role: Database["public"]["Enums"]["app_role"] | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name: string
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      batches: {
        Row: {
          academic_year: string
          campus_id: string
          capacity: number
          course_id: string
          created_at: string
          id: string
          name: string
          start_date: string | null
          status: Database["public"]["Enums"]["batch_status"]
          timing: string
          updated_at: string
        }
        Insert: {
          academic_year?: string
          campus_id: string
          capacity?: number
          course_id: string
          created_at?: string
          id?: string
          name: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          timing?: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          campus_id?: string
          capacity?: number
          course_id?: string
          created_at?: string
          id?: string
          name?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          timing?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      campuses: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      concession_cancellations: {
        Row: {
          cancelled_amount: number
          created_at: string
          fee_assignment_id: string
          id: string
          new_net_payable: number
          original_discount: number
          performed_by: string | null
          performed_by_name: string | null
          reason: string | null
          student_id: string
        }
        Insert: {
          cancelled_amount: number
          created_at?: string
          fee_assignment_id: string
          id?: string
          new_net_payable: number
          original_discount: number
          performed_by?: string | null
          performed_by_name?: string | null
          reason?: string | null
          student_id: string
        }
        Update: {
          cancelled_amount?: number
          created_at?: string
          fee_assignment_id?: string
          id?: string
          new_net_payable?: number
          original_discount?: number
          performed_by?: string | null
          performed_by_name?: string | null
          reason?: string | null
          student_id?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          academic_year: string
          campus_id: string
          created_at: string
          duration_months: number
          gross_fee: number
          id: string
          is_active: boolean
          material_fee: number
          name: string
          registration_fee: number
          test_series_fee: number
          updated_at: string
        }
        Insert: {
          academic_year?: string
          campus_id: string
          created_at?: string
          duration_months?: number
          gross_fee: number
          id?: string
          is_active?: boolean
          material_fee?: number
          name: string
          registration_fee?: number
          test_series_fee?: number
          updated_at?: string
        }
        Update: {
          academic_year?: string
          campus_id?: string
          created_at?: string
          duration_months?: number
          gross_fee?: number
          id?: string
          is_active?: boolean
          material_fee?: number
          name?: string
          registration_fee?: number
          test_series_fee?: number
          updated_at?: string
        }
        Relationships: []
      }
      fee_assignments: {
        Row: {
          concession_cancelled_amount: number
          confirmed: boolean
          course_id: string
          created_at: string
          created_by: string | null
          discount_amount: number
          discount_reason: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          gross_fee: number
          hostel_fee_monthly: number
          id: string
          installment_count: number
          material_fee: number
          net_payable: number
          original_discount_amount: number
          plan_kind: string
          registration_fee: number
          student_id: string
          transport_fee_monthly: number
          updated_at: string
        }
        Insert: {
          concession_cancelled_amount?: number
          confirmed?: boolean
          course_id: string
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          discount_reason?: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          gross_fee: number
          hostel_fee_monthly?: number
          id?: string
          installment_count: number
          material_fee?: number
          net_payable: number
          original_discount_amount?: number
          plan_kind?: string
          registration_fee?: number
          student_id: string
          transport_fee_monthly?: number
          updated_at?: string
        }
        Update: {
          concession_cancelled_amount?: number
          confirmed?: boolean
          course_id?: string
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          discount_reason?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          gross_fee?: number
          hostel_fee_monthly?: number
          id?: string
          installment_count?: number
          material_fee?: number
          net_payable?: number
          original_discount_amount?: number
          plan_kind?: string
          registration_fee?: number
          student_id?: string
          transport_fee_monthly?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          amount: number
          amount_paid: number
          created_at: string
          due_date: string
          fee_assignment_id: string
          id: string
          installment_no: number
          is_registration: boolean
          late_fee: number
          month_label: string | null
          status: Database["public"]["Enums"]["installment_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          created_at?: string
          due_date: string
          fee_assignment_id: string
          id?: string
          installment_no: number
          is_registration?: boolean
          late_fee?: number
          month_label?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          created_at?: string
          due_date?: string
          fee_assignment_id?: string
          id?: string
          installment_no?: number
          is_registration?: boolean
          late_fee?: number
          month_label?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_fee_assignment_id_fkey"
            columns: ["fee_assignment_id"]
            isOneToOne: false
            referencedRelation: "fee_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          card_last4: string | null
          cheque_bank: string | null
          cheque_date: string | null
          cheque_number: string | null
          cleared_at: string | null
          collected_by: string
          collected_by_name: string
          created_at: string
          id: string
          installment_id: string
          notes: string | null
          payment_date: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          receipt_number: string
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          upi_reference: string | null
        }
        Insert: {
          amount: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          card_last4?: string | null
          cheque_bank?: string | null
          cheque_date?: string | null
          cheque_number?: string | null
          cleared_at?: string | null
          collected_by: string
          collected_by_name: string
          created_at?: string
          id?: string
          installment_id: string
          notes?: string | null
          payment_date?: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          receipt_number: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: string
          upi_reference?: string | null
        }
        Update: {
          amount?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          card_last4?: string | null
          cheque_bank?: string | null
          cheque_date?: string | null
          cheque_number?: string | null
          cleared_at?: string | null
          collected_by?: string
          collected_by_name?: string
          created_at?: string
          id?: string
          installment_id?: string
          notes?: string | null
          payment_date?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          receipt_number?: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
          upi_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_upgrades: {
        Row: {
          created_at: string
          fee_assignment_id: string
          from_plan: string
          id: string
          performed_by: string | null
          performed_by_name: string | null
          reason: string | null
          student_id: string
          to_plan: string
        }
        Insert: {
          created_at?: string
          fee_assignment_id: string
          from_plan: string
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
          reason?: string | null
          student_id: string
          to_plan: string
        }
        Update: {
          created_at?: string
          fee_assignment_id?: string
          from_plan?: string
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
          reason?: string | null
          student_id?: string
          to_plan?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          id: string
          mode: Database["public"]["Enums"]["payment_mode"]
          processed_by: string
          reason: string
          reference: string | null
          refund_date: string
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          mode: Database["public"]["Enums"]["payment_mode"]
          processed_by: string
          reason: string
          reference?: string | null
          refund_date?: string
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["payment_mode"]
          processed_by?: string
          reason?: string
          reference?: string | null
          refund_date?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          channel: Database["public"]["Enums"]["reminder_channel"]
          created_at: string
          id: string
          installment_id: string | null
          kind: Database["public"]["Enums"]["reminder_kind"]
          language: string
          message: string
          recipient_mobile: string
          student_id: string
          triggered_by: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["reminder_channel"]
          created_at?: string
          id?: string
          installment_id?: string | null
          kind: Database["public"]["Enums"]["reminder_kind"]
          language?: string
          message: string
          recipient_mobile: string
          student_id: string
          triggered_by?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["reminder_channel"]
          created_at?: string
          id?: string
          installment_id?: string | null
          kind?: Database["public"]["Enums"]["reminder_kind"]
          language?: string
          message?: string
          recipient_mobile?: string
          student_id?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          active_academic_year: string
          admission_prefix: string
          bounce_charge: number
          created_at: string
          grace_period_days: number
          id: string
          institute_address: string
          institute_name: string
          late_fee_amount: number
          late_fee_percent: number
          receipt_prefix: string
          updated_at: string
        }
        Insert: {
          active_academic_year?: string
          admission_prefix?: string
          bounce_charge?: number
          created_at?: string
          grace_period_days?: number
          id?: string
          institute_address?: string
          institute_name?: string
          late_fee_amount?: number
          late_fee_percent?: number
          receipt_prefix?: string
          updated_at?: string
        }
        Update: {
          active_academic_year?: string
          admission_prefix?: string
          bounce_charge?: number
          created_at?: string
          grace_period_days?: number
          id?: string
          institute_address?: string
          institute_name?: string
          late_fee_amount?: number
          late_fee_percent?: number
          receipt_prefix?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_documents: {
        Row: {
          created_at: string
          file_url: string
          id: string
          label: string
          mime_type: string | null
          size_bytes: number | null
          student_id: string
          uploaded_by: string | null
          uploaded_by_name: string | null
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          label: string
          mime_type?: string | null
          size_bytes?: number | null
          student_id: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          label?: string
          mime_type?: string | null
          size_bytes?: number | null
          student_id?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Relationships: []
      }
      student_transfers: {
        Row: {
          created_at: string
          from_batch_id: string | null
          from_campus_id: string | null
          from_class: string | null
          id: string
          kind: string
          performed_by: string | null
          performed_by_name: string | null
          reason: string | null
          student_id: string
          to_batch_id: string | null
          to_campus_id: string | null
          to_class: string | null
        }
        Insert: {
          created_at?: string
          from_batch_id?: string | null
          from_campus_id?: string | null
          from_class?: string | null
          id?: string
          kind: string
          performed_by?: string | null
          performed_by_name?: string | null
          reason?: string | null
          student_id: string
          to_batch_id?: string | null
          to_campus_id?: string | null
          to_class?: string | null
        }
        Update: {
          created_at?: string
          from_batch_id?: string | null
          from_campus_id?: string | null
          from_class?: string | null
          id?: string
          kind?: string
          performed_by?: string | null
          performed_by_name?: string | null
          reason?: string | null
          student_id?: string
          to_batch_id?: string | null
          to_campus_id?: string | null
          to_class?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          aadhaar_doc_url: string | null
          aadhaar_number: string | null
          academic_year: string
          admission_date: string
          admission_number: string
          batch_id: string
          blood_group: string | null
          board: string | null
          campus_id: string
          category: string | null
          class_year: Database["public"]["Enums"]["class_year"]
          course_id: string
          created_at: string
          created_by: string | null
          current_address: string | null
          date_of_birth: string
          email: string | null
          emergency_mobile: string | null
          emergency_name: string | null
          emergency_relation: string | null
          father_mobile: string
          father_name: string
          father_occupation: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender"]
          guardian_mobile: string | null
          guardian_name: string | null
          hostel_required: boolean
          id: string
          languages_known: string | null
          marks_10th: string | null
          marks_12th: string | null
          marksheet_10_url: string | null
          marksheet_12_url: string | null
          medium: string | null
          mobile: string
          mother_mobile: string | null
          mother_name: string | null
          mother_tongue: string | null
          nationality: string | null
          neet_attempt: number | null
          parent_annual_income: number | null
          parent_email: string | null
          passport_photo_copies: number | null
          permanent_address: string
          photo_url: string | null
          place_of_birth: string | null
          previous_class: string | null
          previous_neet_score: string | null
          previous_school: string | null
          referred_by: string | null
          religion: string | null
          sibling_info: string | null
          status: Database["public"]["Enums"]["student_status"]
          sub_caste: string | null
          tc_url: string | null
          transport_required: boolean
          updated_at: string
        }
        Insert: {
          aadhaar_doc_url?: string | null
          aadhaar_number?: string | null
          academic_year?: string
          admission_date?: string
          admission_number: string
          batch_id: string
          blood_group?: string | null
          board?: string | null
          campus_id: string
          category?: string | null
          class_year: Database["public"]["Enums"]["class_year"]
          course_id: string
          created_at?: string
          created_by?: string | null
          current_address?: string | null
          date_of_birth: string
          email?: string | null
          emergency_mobile?: string | null
          emergency_name?: string | null
          emergency_relation?: string | null
          father_mobile: string
          father_name: string
          father_occupation?: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender"]
          guardian_mobile?: string | null
          guardian_name?: string | null
          hostel_required?: boolean
          id?: string
          languages_known?: string | null
          marks_10th?: string | null
          marks_12th?: string | null
          marksheet_10_url?: string | null
          marksheet_12_url?: string | null
          medium?: string | null
          mobile: string
          mother_mobile?: string | null
          mother_name?: string | null
          mother_tongue?: string | null
          nationality?: string | null
          neet_attempt?: number | null
          parent_annual_income?: number | null
          parent_email?: string | null
          passport_photo_copies?: number | null
          permanent_address: string
          photo_url?: string | null
          place_of_birth?: string | null
          previous_class?: string | null
          previous_neet_score?: string | null
          previous_school?: string | null
          referred_by?: string | null
          religion?: string | null
          sibling_info?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          sub_caste?: string | null
          tc_url?: string | null
          transport_required?: boolean
          updated_at?: string
        }
        Update: {
          aadhaar_doc_url?: string | null
          aadhaar_number?: string | null
          academic_year?: string
          admission_date?: string
          admission_number?: string
          batch_id?: string
          blood_group?: string | null
          board?: string | null
          campus_id?: string
          category?: string | null
          class_year?: Database["public"]["Enums"]["class_year"]
          course_id?: string
          created_at?: string
          created_by?: string | null
          current_address?: string | null
          date_of_birth?: string
          email?: string | null
          emergency_mobile?: string | null
          emergency_name?: string | null
          emergency_relation?: string | null
          father_mobile?: string
          father_name?: string
          father_occupation?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender"]
          guardian_mobile?: string | null
          guardian_name?: string | null
          hostel_required?: boolean
          id?: string
          languages_known?: string | null
          marks_10th?: string | null
          marks_12th?: string | null
          marksheet_10_url?: string | null
          marksheet_12_url?: string | null
          medium?: string | null
          mobile?: string
          mother_mobile?: string | null
          mother_name?: string | null
          mother_tongue?: string | null
          nationality?: string | null
          neet_attempt?: number | null
          parent_annual_income?: number | null
          parent_email?: string | null
          passport_photo_copies?: number | null
          permanent_address?: string
          photo_url?: string | null
          place_of_birth?: string | null
          previous_class?: string | null
          previous_neet_score?: string | null
          previous_school?: string | null
          referred_by?: string | null
          religion?: string | null
          sibling_info?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          sub_caste?: string | null
          tc_url?: string | null
          transport_required?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_admission_number: { Args: { _year: string }; Returns: string }
      next_receipt_number: { Args: { _year: string }; Returns: string }
      recalc_installment: {
        Args: { _installment_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "cashier"
      batch_status: "active" | "full" | "closed"
      class_year: "11th" | "12th" | "dropper"
      discount_type: "round_off" | "slab_10" | "slab_15" | "slab_20" | "special"
      gender: "male" | "female" | "other"
      installment_status: "due" | "partial" | "paid" | "overdue"
      payment_mode: "cash" | "upi" | "cheque" | "dd" | "card"
      payment_status: "cleared" | "pending" | "bounced" | "cancelled"
      reminder_channel: "sms" | "whatsapp"
      reminder_kind:
        | "upcoming_due"
        | "on_due"
        | "overdue"
        | "payment_confirm"
        | "cheque_bounce"
        | "manual"
      student_status: "active" | "discontinued" | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "cashier"],
      batch_status: ["active", "full", "closed"],
      class_year: ["11th", "12th", "dropper"],
      discount_type: ["round_off", "slab_10", "slab_15", "slab_20", "special"],
      gender: ["male", "female", "other"],
      installment_status: ["due", "partial", "paid", "overdue"],
      payment_mode: ["cash", "upi", "cheque", "dd", "card"],
      payment_status: ["cleared", "pending", "bounced", "cancelled"],
      reminder_channel: ["sms", "whatsapp"],
      reminder_kind: [
        "upcoming_due",
        "on_due",
        "overdue",
        "payment_confirm",
        "cheque_bounce",
        "manual",
      ],
      student_status: ["active", "discontinued", "completed"],
    },
  },
} as const
