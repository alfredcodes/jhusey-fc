export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      absence_excuses: {
        Row: {
          created_at: string
          created_by: string
          id: string
          member_id: string
          note: string | null
          session_id: string
          source: Database['public']['Enums']['excuse_source']
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          member_id: string
          note?: string | null
          session_id: string
          source: Database['public']['Enums']['excuse_source']
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          member_id?: string
          note?: string | null
          session_id?: string
          source?: Database['public']['Enums']['excuse_source']
        }
        Relationships: [
          {
            foreignKeyName: 'absence_excuses_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'absence_excuses_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'absence_excuses_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          },
        ]
      }
      attendance: {
        Row: {
          accuracy_m: number | null
          created_at: string
          distance_m: number | null
          id: string
          latitude: number | null
          longitude: number | null
          manual_reason: string | null
          member_id: string
          original_status: Database['public']['Enums']['attendance_status']
          punched_in_at: string
          recorded_by: string | null
          session_id: string
          source: Database['public']['Enums']['attendance_source']
          status: Database['public']['Enums']['attendance_status']
          venue_id: string
          venue_latitude: number
          venue_longitude: number
          venue_max_accuracy_m: number
          venue_radius_m: number
        }
        ComputedFields: never
        Insert: {
          accuracy_m?: number | null
          created_at?: string
          distance_m?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          manual_reason?: string | null
          member_id: string
          original_status: Database['public']['Enums']['attendance_status']
          punched_in_at: string
          recorded_by?: string | null
          session_id: string
          source?: Database['public']['Enums']['attendance_source']
          status: Database['public']['Enums']['attendance_status']
          venue_id: string
          venue_latitude: number
          venue_longitude: number
          venue_max_accuracy_m: number
          venue_radius_m: number
        }
        Update: {
          accuracy_m?: number | null
          created_at?: string
          distance_m?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          manual_reason?: string | null
          member_id?: string
          original_status?: Database['public']['Enums']['attendance_status']
          punched_in_at?: string
          recorded_by?: string | null
          session_id?: string
          source?: Database['public']['Enums']['attendance_source']
          status?: Database['public']['Enums']['attendance_status']
          venue_id?: string
          venue_latitude?: number
          venue_longitude?: number
          venue_max_accuracy_m?: number
          venue_radius_m?: number
        }
        Relationships: [
          {
            foreignKeyName: 'attendance_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attendance_recorded_by_fkey'
            columns: ['recorded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attendance_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attendance_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: NonNullable<Json>
          entity: string
          entity_id: string
          id: string
          reason: string | null
        }
        ComputedFields: never
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: NonNullable<Json>
          entity: string
          entity_id: string
          id?: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: NonNullable<Json>
          entity?: string
          entity_id?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'audit_log_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      club_settings: {
        Row: {
          absence_fine_npr: number
          absence_fines_from: string
          club_name: string
          id: boolean
          late_fine_npr: number
          on_time_cutoff: string
          punch_close: string
          punch_open: string
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          absence_fine_npr?: number
          absence_fines_from?: string
          club_name?: string
          id?: boolean
          late_fine_npr?: number
          on_time_cutoff?: string
          punch_close?: string
          punch_open?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          absence_fine_npr?: number
          absence_fines_from?: string
          club_name?: string
          id?: boolean
          late_fine_npr?: number
          on_time_cutoff?: string
          punch_close?: string
          punch_open?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'club_settings_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      fines: {
        Row: {
          amount_npr: number
          attendance_id: string | null
          created_at: string
          id: string
          member_id: string
          payment_id: string | null
          reason: string
          session_id: string
          status: Database['public']['Enums']['fine_status']
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          amount_npr: number
          attendance_id?: string | null
          created_at?: string
          id?: string
          member_id: string
          payment_id?: string | null
          reason: string
          session_id: string
          status?: Database['public']['Enums']['fine_status']
          updated_at?: string
        }
        Update: {
          amount_npr?: number
          attendance_id?: string | null
          created_at?: string
          id?: string
          member_id?: string
          payment_id?: string | null
          reason?: string
          session_id?: string
          status?: Database['public']['Enums']['fine_status']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fines_attendance_id_fkey'
            columns: ['attendance_id']
            isOneToOne: true
            referencedRelation: 'attendance'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fines_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fines_payment_id_fkey'
            columns: ['payment_id']
            isOneToOne: false
            referencedRelation: 'payments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fines_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          },
        ]
      }
      member_private: {
        Row: {
          member_id: string
          must_change_password: boolean
          phone: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          member_id: string
          must_change_password?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          member_id?: string
          must_change_password?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'member_private_member_id_fkey'
            columns: ['member_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      payments: {
        Row: {
          amount_npr: number
          created_at: string
          id: string
          member_id: string
          method: string
          note: string | null
          recorded_by: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        ComputedFields: never
        Insert: {
          amount_npr: number
          created_at?: string
          id?: string
          member_id: string
          method: string
          note?: string | null
          recorded_by: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_npr?: number
          created_at?: string
          id?: string
          member_id?: string
          method?: string
          note?: string | null
          recorded_by?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'payments_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payments_recorded_by_fkey'
            columns: ['recorded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payments_voided_by_fkey'
            columns: ['voided_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          role: Database['public']['Enums']['app_role']
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          display_name: string
          id: string
          is_active?: boolean
          role?: Database['public']['Enums']['app_role']
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          role?: Database['public']['Enums']['app_role']
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          id: string
          note: string | null
          session_date: string
          status: Database['public']['Enums']['session_status']
          updated_at: string
          venue_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          session_date: string
          status?: Database['public']['Enums']['session_status']
          updated_at?: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          session_date?: string
          status?: Database['public']['Enums']['session_status']
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sessions_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      venues: {
        Row: {
          created_at: string
          geofence_radius_m: number
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          max_accuracy_m: number
          name: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          geofence_radius_m?: number
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          max_accuracy_m?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          geofence_radius_m?: number
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          max_accuracy_m?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _create_absence_fines: { Args: { p_now: string }; Returns: number }
      _punch_in: {
        Args: {
          p_accuracy_m: number
          p_latitude: number
          p_longitude: number
          p_member_id: string
          p_now: string
        }
        Returns: Json
      }
      admin_correct_attendance: {
        Args: {
          p_attendance_id: string
          p_new_status: Database['public']['Enums']['attendance_status']
          p_reason: string
        }
        Returns: undefined
      }
      admin_create_sessions: {
        Args: { p_from: string; p_to: string; p_venue_id: string; p_weekdays: number[] }
        Returns: number
      }
      admin_excuse_absence: {
        Args: { p_member_id: string; p_reason: string; p_session_id: string }
        Returns: undefined
      }
      admin_export_attendance: {
        Args: { p_from: string; p_to: string }
        Returns: {
          accuracy_m: number
          admin_reason: string
          distance_m: number
          latitude: number
          longitude: number
          member: string
          original_status: string
          punched_in_nepal: string
          session_date: string
          source: string
          status: string
          venue: string
        }[]
      }
      admin_export_fines: {
        Args: { p_from: string; p_to: string }
        Returns: {
          amount_npr: number
          created_nepal: string
          member: string
          payment_id: string
          reason: string
          session_date: string
          status: string
        }[]
      }
      admin_export_payments: {
        Args: { p_from: string; p_to: string }
        Returns: {
          amount_npr: number
          fines_count: number
          member: string
          method: string
          note: string
          payment_id: string
          recorded_nepal: string
          void_reason: string
          voided_nepal: string
        }[]
      }
      admin_member_accounts: {
        Args: Record<PropertyKey, never>
        Returns: {
          email: string
          last_sign_in_at: string
          member_id: string
          must_change_password: boolean
          phone: string
        }[]
      }
      admin_record_attendance: {
        Args: { p_arrived_at: string; p_member_id: string; p_reason: string; p_session_id: string }
        Returns: Database['public']['Enums']['attendance_status']
      }
      admin_record_payment: {
        Args: { p_fine_ids: string[]; p_member_id: string; p_method: string; p_note: string }
        Returns: string
      }
      admin_set_member_phone: { Args: { p_member_id: string; p_phone: string }; Returns: undefined }
      admin_update_member: {
        Args: { p_display_name: string; p_is_active: boolean; p_member_id: string }
        Returns: undefined
      }
      admin_update_rules: {
        Args: {
          p_absence_fine_npr: number
          p_absence_fines_from: string
          p_club_name: string
          p_late_fine_npr: number
          p_on_time_cutoff: string
          p_punch_close: string
          p_punch_open: string
        }
        Returns: undefined
      }
      admin_void_payment: { Args: { p_payment_id: string; p_reason: string }; Returns: undefined }
      admin_waive_fine: { Args: { p_fine_id: string; p_reason: string }; Returns: undefined }
      attendance_status_for:
        | {
            Args: { p_at: string; p_session_date: string }
            Returns: Database['public']['Enums']['attendance_status']
          }
        | {
            Args: { p_at: string; p_cutoff: string; p_session_date: string }
            Returns: Database['public']['Enums']['attendance_status']
          }
      check_report_range: { Args: { p_from: string; p_to: string }; Returns: undefined }
      distance_m: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      is_active_member: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      mark_password_changed: { Args: Record<PropertyKey, never>; Returns: undefined }
      my_session_history: {
        Args: Record<PropertyKey, never>
        Returns: {
          accuracy_m: number
          distance_m: number
          fine_npr: number
          fine_reason: string
          fine_status: Database['public']['Enums']['fine_status']
          latitude: number
          longitude: number
          original_status: Database['public']['Enums']['attendance_status']
          punched_in_at: string
          result: string
          session_date: string
          session_id: string
          source: Database['public']['Enums']['attendance_source']
          venue_name: string
        }[]
      }
      nepal_today: { Args: Record<PropertyKey, never>; Returns: string }
      notify_absence: { Args: { p_note: string; p_session_id: string }; Returns: undefined }
      punch_in: {
        Args: { p_accuracy_m: number; p_latitude: number; p_longitude: number }
        Returns: Json
      }
      require_admin: { Args: Record<PropertyKey, never>; Returns: undefined }
      require_reason: { Args: { p_reason: string }; Returns: string }
      session_closed: { Args: { p_session_date: string }; Returns: boolean }
      session_fine: {
        Args: { p_member_id: string; p_session_id: string }
        Returns: {
          amount_npr: number
          attendance_id: string | null
          created_at: string
          id: string
          member_id: string
          payment_id: string | null
          reason: string
          session_id: string
          status: Database['public']['Enums']['fine_status']
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'fines'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      session_roster: {
        Args: { p_session_id: string }
        Returns: {
          accuracy_m: number
          attendance_id: string
          display_name: string
          distance_m: number
          excuse_note: string
          excuse_source: Database['public']['Enums']['excuse_source']
          fine_amount_npr: number
          fine_id: string
          fine_reason: string
          fine_status: Database['public']['Enums']['fine_status']
          is_active: boolean
          member_id: string
          original_status: Database['public']['Enums']['attendance_status']
          punched_in_at: string
          result: string
          source: Database['public']['Enums']['attendance_source']
        }[]
      }
      team_monthly_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          absence_fines_npr: number
          absent: number
          attended: number
          collected_npr: number
          excused: number
          fines_npr: number
          late: number
          late_fines_npr: number
          member_sessions: number
          month: string
          sessions: number
        }[]
      }
      team_payments: {
        Args: { p_from: string; p_to: string }
        Returns: {
          amount_npr: number
          created_at: string
          display_name: string
          fines_count: number
          member_id: string
          method: string
          payment_id: string
          voided: boolean
        }[]
      }
      team_report: {
        Args: { p_from: string; p_to: string }
        Returns: {
          absence_fines_npr: number
          absent: number
          attendance_percent: number
          display_name: string
          excused: number
          fines_npr: number
          fines_outstanding_npr: number
          fines_paid_npr: number
          fines_waived_npr: number
          is_active: boolean
          late: number
          late_fines_npr: number
          member_id: string
          on_time: number
          sessions: number
        }[]
      }
      time_label: { Args: { p_time: string }; Returns: string }
      update_my_phone: { Args: { p_phone: string }; Returns: undefined }
      withdraw_absence: { Args: { p_session_id: string }; Returns: undefined }
      write_audit: {
        Args: {
          p_action: string
          p_details: Json
          p_entity: string
          p_entity_id: string
          p_reason: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: 'admin' | 'member'
      attendance_source: 'gps' | 'admin'
      attendance_status: 'on_time' | 'late'
      excuse_source: 'member' | 'admin'
      fine_status: 'pending' | 'paid' | 'waived'
      session_status: 'scheduled' | 'cancelled'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ['admin', 'member'],
      attendance_source: ['gps', 'admin'],
      attendance_status: ['on_time', 'late'],
      excuse_source: ['member', 'admin'],
      fine_status: ['pending', 'paid', 'waived'],
      session_status: ['scheduled', 'cancelled'],
    },
  },
} as const
