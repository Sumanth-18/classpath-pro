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
      announcements: {
        Row: {
          audience: Database["public"]["Enums"]["audience_type"] | null
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean | null
          school_id: string
          title: string
          type: Database["public"]["Enums"]["announcement_type"] | null
        }
        Insert: {
          audience?: Database["public"]["Enums"]["audience_type"] | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean | null
          school_id: string
          title: string
          type?: Database["public"]["Enums"]["announcement_type"] | null
        }
        Update: {
          audience?: Database["public"]["Enums"]["audience_type"] | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean | null
          school_id?: string
          title?: string
          type?: Database["public"]["Enums"]["announcement_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          assignment_type: Database["public"]["Enums"]["assignment_type"] | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          max_marks: number | null
          school_id: string
          section_id: string | null
          subject_id: string | null
          title: string
        }
        Insert: {
          assignment_type?:
            | Database["public"]["Enums"]["assignment_type"]
            | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          max_marks?: number | null
          school_id: string
          section_id?: string | null
          subject_id?: string | null
          title: string
        }
        Update: {
          assignment_type?:
            | Database["public"]["Enums"]["assignment_type"]
            | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          max_marks?: number | null
          school_id?: string
          section_id?: string | null
          subject_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          created_at: string
          date: string
          id: string
          marked_by: string | null
          notes: string | null
          remarks: string | null
          school_id: string
          section_id: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          remarks?: string | null
          school_id: string
          section_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          remarks?: string | null
          school_id?: string
          section_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_audit: {
        Row: {
          action: string
          attendance_id: string | null
          created_at: string
          date: string | null
          id: string
          new_status: string | null
          old_status: string | null
          payload: Json | null
          performed_by: string
          reason: string | null
          school_id: string
          student_id: string | null
        }
        Insert: {
          action: string
          attendance_id?: string | null
          created_at?: string
          date?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          payload?: Json | null
          performed_by: string
          reason?: string | null
          school_id: string
          student_id?: string | null
        }
        Update: {
          action?: string
          attendance_id?: string | null
          created_at?: string
          date?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          payload?: Json | null
          performed_by?: string
          reason?: string | null
          school_id?: string
          student_id?: string | null
        }
        Relationships: []
      }
      classes: {
        Row: {
          academic_year: string | null
          created_at: string
          curriculum: string | null
          id: string
          name: string
          numeric_level: number | null
          school_id: string
        }
        Insert: {
          academic_year?: string | null
          created_at?: string
          curriculum?: string | null
          id?: string
          name: string
          numeric_level?: number | null
          school_id: string
        }
        Update: {
          academic_year?: string | null
          created_at?: string
          curriculum?: string | null
          id?: string
          name?: string
          numeric_level?: number | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          academic_year: string | null
          class_id: string | null
          created_at: string
          end_date: string | null
          exam_type: string | null
          id: string
          name: string
          school_id: string
          start_date: string | null
        }
        Insert: {
          academic_year?: string | null
          class_id?: string | null
          created_at?: string
          end_date?: string | null
          exam_type?: string | null
          id?: string
          name: string
          school_id: string
          start_date?: string | null
        }
        Update: {
          academic_year?: string | null
          class_id?: string | null
          created_at?: string
          end_date?: string | null
          exam_type?: string | null
          id?: string
          name?: string
          school_id?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exams_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_dues: {
        Row: {
          amount_due: number
          created_at: string
          due_date: string | null
          fee_structure_id: string | null
          for_month: string | null
          id: string
          is_paid: boolean | null
          school_id: string
          student_id: string
        }
        Insert: {
          amount_due: number
          created_at?: string
          due_date?: string | null
          fee_structure_id?: string | null
          for_month?: string | null
          id?: string
          is_paid?: boolean | null
          school_id: string
          student_id: string
        }
        Update: {
          amount_due?: number
          created_at?: string
          due_date?: string | null
          fee_structure_id?: string | null
          for_month?: string | null
          id?: string
          is_paid?: boolean | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_dues_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_dues_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_dues_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payments: {
        Row: {
          amount_paid: number
          collected_by: string | null
          created_at: string
          fee_structure_id: string | null
          for_month: string | null
          id: string
          payment_date: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"] | null
          receipt_number: string | null
          school_id: string
          status: Database["public"]["Enums"]["fee_status"] | null
          student_id: string
        }
        Insert: {
          amount_paid: number
          collected_by?: string | null
          created_at?: string
          fee_structure_id?: string | null
          for_month?: string | null
          id?: string
          payment_date?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"] | null
          receipt_number?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["fee_status"] | null
          student_id: string
        }
        Update: {
          amount_paid?: number
          collected_by?: string | null
          created_at?: string
          fee_structure_id?: string | null
          for_month?: string | null
          id?: string
          payment_date?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"] | null
          receipt_number?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["fee_status"] | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_collected_by_fkey"
            columns: ["collected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          academic_year: string | null
          amount: number
          class_id: string | null
          created_at: string
          due_day: number | null
          frequency: string | null
          id: string
          name: string
          school_id: string
        }
        Insert: {
          academic_year?: string | null
          amount: number
          class_id?: string | null
          created_at?: string
          due_day?: number | null
          frequency?: string | null
          id?: string
          name: string
          school_id: string
        }
        Update: {
          academic_year?: string | null
          amount?: number
          class_id?: string | null
          created_at?: string
          due_day?: number | null
          frequency?: string | null
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_structures_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string
          from_date: string | null
          id: string
          leave_type: string | null
          reason: string | null
          school_id: string
          status: Database["public"]["Enums"]["leave_status"] | null
          to_date: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          from_date?: string | null
          id?: string
          leave_type?: string | null
          reason?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["leave_status"] | null
          to_date?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          from_date?: string | null
          id?: string
          leave_type?: string | null
          reason?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["leave_status"] | null
          to_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      marks: {
        Row: {
          created_at: string
          entered_by: string | null
          exam_id: string
          grade: string | null
          id: string
          marks_obtained: number | null
          max_marks: number | null
          school_id: string
          student_id: string
          subject_id: string
        }
        Insert: {
          created_at?: string
          entered_by?: string | null
          exam_id: string
          grade?: string | null
          id?: string
          marks_obtained?: number | null
          max_marks?: number | null
          school_id: string
          student_id: string
          subject_id: string
        }
        Update: {
          created_at?: string
          entered_by?: string | null
          exam_id?: string
          grade?: string | null
          id?: string
          marks_obtained?: number | null
          max_marks?: number | null
          school_id?: string
          student_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marks_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean | null
          school_id: string
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          school_id: string
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          school_id?: string
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      online_classes: {
        Row: {
          created_at: string
          duration_minutes: number | null
          id: string
          meeting_link: string | null
          scheduled_at: string | null
          school_id: string
          section_id: string | null
          subject_id: string | null
          teacher_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          id?: string
          meeting_link?: string | null
          scheduled_at?: string | null
          school_id: string
          section_id?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          id?: string
          meeting_link?: string | null
          scheduled_at?: string | null
          school_id?: string
          section_id?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "online_classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_classes_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_student: {
        Row: {
          id: string
          parent_user_id: string
          relation: string | null
          student_id: string
        }
        Insert: {
          id?: string
          parent_user_id: string
          relation?: string | null
          student_id: string
        }
        Update: {
          id?: string
          parent_user_id?: string
          relation?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_student_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          invite_status: string
          invited_at: string | null
          is_active: boolean | null
          name: string
          phone: string | null
          school_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          invite_status?: string
          invited_at?: string | null
          is_active?: boolean | null
          name: string
          phone?: string | null
          school_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          invite_status?: string
          invited_at?: string | null
          is_active?: boolean | null
          name?: string
          phone?: string | null
          school_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_events: {
        Row: {
          created_at: string
          description: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["event_type"] | null
          id: string
          school_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_date: string
          event_type?: Database["public"]["Enums"]["event_type"] | null
          id?: string
          school_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_date?: string
          event_type?: Database["public"]["Enums"]["event_type"] | null
          id?: string
          school_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          academic_year: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          state: string | null
          subscription_plan: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          state?: string | null
          subscription_plan?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          state?: string | null
          subscription_plan?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sections: {
        Row: {
          class_id: string
          class_teacher_id: string | null
          created_at: string
          id: string
          name: string
          school_id: string
        }
        Insert: {
          class_id: string
          class_teacher_id?: string | null
          created_at?: string
          id?: string
          name: string
          school_id: string
        }
        Update: {
          class_id?: string
          class_teacher_id?: string | null
          created_at?: string
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_class_teacher_id_fkey"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          created_at: string
          date_of_joining: string | null
          department: string | null
          designation: string | null
          employee_id: string | null
          id: string
          salary: number | null
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_of_joining?: string | null
          department?: string | null
          designation?: string | null
          employee_id?: string | null
          id?: string
          salary?: number | null
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_of_joining?: string | null
          department?: string | null
          designation?: string | null
          employee_id?: string | null
          id?: string
          salary?: number | null
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"] | null
          school_id: string
          status: Database["public"]["Enums"]["task_status"] | null
          title: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          school_id: string
          status?: Database["public"]["Enums"]["task_status"] | null
          title: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          school_id?: string
          status?: Database["public"]["Enums"]["task_status"] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_tasks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          admission_number: string
          created_at: string
          date_of_birth: string | null
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          is_active: boolean | null
          name: string
          parent_phone: string | null
          photo_url: string | null
          school_id: string
          section_id: string | null
        }
        Insert: {
          admission_number: string
          created_at?: string
          date_of_birth?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_phone?: string | null
          photo_url?: string | null
          school_id: string
          section_id?: string | null
        }
        Update: {
          admission_number?: string
          created_at?: string
          date_of_birth?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_phone?: string | null
          photo_url?: string | null
          school_id?: string
          section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          class_id: string | null
          code: string | null
          created_at: string
          id: string
          max_marks: number | null
          name: string
          school_id: string
        }
        Insert: {
          class_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          max_marks?: number | null
          name: string
          school_id: string
        }
        Update: {
          class_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          max_marks?: number | null
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_assignments: {
        Row: {
          created_at: string
          id: string
          school_id: string
          section_id: string
          subject_id: string | null
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          school_id: string
          section_id: string
          subject_id?: string | null
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          school_id?: string
          section_id?: string
          subject_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string | null
          id: string
          period_number: number
          school_id: string
          section_id: string
          start_time: string | null
          subject_id: string | null
          teacher_id: string | null
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time?: string | null
          id?: string
          period_number: number
          school_id: string
          section_id: string
          start_time?: string | null
          subject_id?: string | null
          teacher_id?: string | null
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string | null
          id?: string
          period_number?: number
          school_id?: string
          section_id?: string
          start_time?: string | null
          subject_id?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timetable_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_school_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_in_school: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      is_parent_of_student: {
        Args: { _student_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      announcement_type: "general" | "event" | "holiday" | "urgent"
      app_role: "school_admin" | "teacher" | "parent" | "student"
      assignment_type: "homework" | "classwork" | "reading" | "project"
      attendance_status: "present" | "absent" | "late" | "leave_approved"
      audience_type: "everyone" | "parents" | "teachers" | "students"
      event_type: "holiday" | "event" | "exam" | "meeting"
      fee_status: "paid" | "due" | "overdue" | "partial"
      gender: "male" | "female" | "other"
      leave_status: "pending" | "approved" | "rejected"
      payment_mode: "cash" | "upi" | "cheque" | "online" | "card"
      task_priority: "low" | "medium" | "high"
      task_status: "pending" | "in_progress" | "completed"
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
      announcement_type: ["general", "event", "holiday", "urgent"],
      app_role: ["school_admin", "teacher", "parent", "student"],
      assignment_type: ["homework", "classwork", "reading", "project"],
      attendance_status: ["present", "absent", "late", "leave_approved"],
      audience_type: ["everyone", "parents", "teachers", "students"],
      event_type: ["holiday", "event", "exam", "meeting"],
      fee_status: ["paid", "due", "overdue", "partial"],
      gender: ["male", "female", "other"],
      leave_status: ["pending", "approved", "rejected"],
      payment_mode: ["cash", "upi", "cheque", "online", "card"],
      task_priority: ["low", "medium", "high"],
      task_status: ["pending", "in_progress", "completed"],
    },
  },
} as const
