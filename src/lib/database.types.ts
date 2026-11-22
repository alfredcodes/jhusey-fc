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
      attendance: {
        Row: {
          accuracy_m: number
          created_at: string
          distance_m: number
          id: string
          latitude: number
          longitude: number
          member_id: string
          punched_in_at: string
          session_id: string
          status: Database['public']['Enums']['attendance_status']
          venue_id: string
          venue_latitude: number
          venue_longitude: number
          venue_max_accuracy_m: number
          venue_radius_m: number
        }
        ComputedFields: never
        Insert: {
          accuracy_m: number
          created_at?: string
          distance_m: number
          id?: string
          latitude: number
          longitude: number
          member_id: string
          punched_in_at: string
          session_id: string
          status: Database['public']['Enums']['attendance_status']
          venue_id: string
          venue_latitude: number
          venue_longitude: number
          venue_max_accuracy_m: number
          venue_radius_m: number
        }
        Update: {
          accuracy_m?: number
          created_at?: string
          distance_m?: number
          id?: string
          latitude?: number
          longitude?: number
          member_id?: string
          punched_in_at?: string
          session_id?: string
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
      fines: {
        Row: {
          amount_npr: number
          attendance_id: string | null
          created_at: string
          id: string
          member_id: string
          reason: string
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
          reason: string
          status?: Database['public']['Enums']['fine_status']
          updated_at?: string
        }
        Update: {
          amount_npr?: number
          attendance_id?: string | null
          created_at?: string
          id?: string
          member_id?: string
          reason?: string
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
      admin_create_sessions: {
        Args: { p_from: string; p_to: string; p_venue_id: string; p_weekdays: number[] }
        Returns: number
      }
      attendance_status_for: {
        Args: { p_at: string; p_session_date: string }
        Returns: Database['public']['Enums']['attendance_status']
      }
      distance_m: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      is_active_member: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      nepal_today: { Args: Record<PropertyKey, never>; Returns: string }
      punch_in: {
        Args: { p_accuracy_m: number; p_latitude: number; p_longitude: number }
        Returns: Json
      }
    }
    Enums: {
      app_role: 'admin' | 'member'
      attendance_status: 'on_time' | 'late'
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
      attendance_status: ['on_time', 'late'],
      fine_status: ['pending', 'paid', 'waived'],
      session_status: ['scheduled', 'cancelled'],
    },
  },
} as const
