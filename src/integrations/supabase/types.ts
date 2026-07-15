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
      daily_trip_requests: {
        Row: {
          created_at: string
          driver_name: string | null
          end_time: string | null
          engineer_id: string
          engineer_name: string
          execution_order: number | null
          id: string
          notes: string
          pickup_location: string | null
          priority: string
          project_id: string | null
          project_name: string
          site: string
          start_time: string | null
          status: string
          trip_date: string
          updated_at: string
          vehicle_number: string | null
          vehicle_type: string | null
          work_type: string
          worker_names: string[]
        }
        Insert: {
          created_at?: string
          driver_name?: string | null
          end_time?: string | null
          engineer_id: string
          engineer_name?: string
          execution_order?: number | null
          id?: string
          notes?: string
          pickup_location?: string | null
          priority?: string
          project_id?: string | null
          project_name?: string
          site?: string
          start_time?: string | null
          status?: string
          trip_date: string
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: string | null
          work_type?: string
          worker_names?: string[]
        }
        Update: {
          created_at?: string
          driver_name?: string | null
          end_time?: string | null
          engineer_id?: string
          engineer_name?: string
          execution_order?: number | null
          id?: string
          notes?: string
          pickup_location?: string | null
          priority?: string
          project_id?: string | null
          project_name?: string
          site?: string
          start_time?: string | null
          status?: string
          trip_date?: string
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: string | null
          work_type?: string
          worker_names?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "daily_trip_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_area_defaults: {
        Row: {
          area: string
          created_at: string
          driver_name: string
          id: string
        }
        Insert: {
          area: string
          created_at?: string
          driver_name: string
          id?: string
        }
        Update: {
          area?: string
          created_at?: string
          driver_name?: string
          id?: string
        }
        Relationships: []
      }
      engineers: {
        Row: {
          created_at: string
          department: string
          id: string
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string
          id?: string
          name: string
          phone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          code: string
          created_at: string
          end_date: string
          engineer: string
          id: string
          name: string
          priority: string
          progress: number
          site: string
          start_date: string
          status: string
          type: string
          updated_at: string
          work_type: string
          worker_names: string[]
          workers_assigned: number
          workers_required: number
        }
        Insert: {
          code: string
          created_at?: string
          end_date?: string
          engineer?: string
          id?: string
          name: string
          priority?: string
          progress?: number
          site?: string
          start_date?: string
          status?: string
          type?: string
          updated_at?: string
          work_type?: string
          worker_names?: string[]
          workers_assigned?: number
          workers_required?: number
        }
        Update: {
          code?: string
          created_at?: string
          end_date?: string
          engineer?: string
          id?: string
          name?: string
          priority?: string
          progress?: number
          site?: string
          start_date?: string
          status?: string
          type?: string
          updated_at?: string
          work_type?: string
          worker_names?: string[]
          workers_assigned?: number
          workers_required?: number
        }
        Relationships: []
      }
      trip_schedules: {
        Row: {
          completed_at: string | null
          created_at: string
          department: string
          end_time: string | null
          engineer_name: string
          execution_order: number | null
          id: string
          notes: string
          pickup_location: string
          project_id: string | null
          project_name: string
          site: string
          start_time: string | null
          started_at: string | null
          status: string
          time_slot: string
          trip_date: string
          urgent: boolean
          vehicle_number: string | null
          vehicle_type: string | null
          worker_name: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          department?: string
          end_time?: string | null
          engineer_name?: string
          execution_order?: number | null
          id?: string
          notes?: string
          pickup_location?: string
          project_id?: string | null
          project_name?: string
          site: string
          start_time?: string | null
          started_at?: string | null
          status?: string
          time_slot: string
          trip_date: string
          urgent?: boolean
          vehicle_number?: string | null
          vehicle_type?: string | null
          worker_name: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          department?: string
          end_time?: string | null
          engineer_name?: string
          execution_order?: number | null
          id?: string
          notes?: string
          pickup_location?: string
          project_id?: string | null
          project_name?: string
          site?: string
          start_time?: string | null
          started_at?: string | null
          status?: string
          time_slot?: string
          trip_date?: string
          urgent?: boolean
          vehicle_number?: string | null
          vehicle_type?: string | null
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_segments: {
        Row: {
          completed_at: string | null
          created_at: string
          engineer_name: string
          id: string
          paused_at: string | null
          project_id: string | null
          project_name: string
          sequence: number
          site: string
          started_at: string | null
          status: string
          total_paused_seconds: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          engineer_name?: string
          id?: string
          paused_at?: string | null
          project_id?: string | null
          project_name?: string
          sequence?: number
          site: string
          started_at?: string | null
          status?: string
          total_paused_seconds?: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          engineer_name?: string
          id?: string
          paused_at?: string | null
          project_id?: string | null
          project_name?: string
          sequence?: number
          site?: string
          started_at?: string | null
          status?: string
          total_paused_seconds?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_segments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_segments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          pending: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          pending?: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          pending?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          brand: string
          capacity: number
          created_at: string
          current_route: string
          department: string
          driver: string
          driver_user_id: string | null
          fuel_level: number
          id: string
          number: string
          status: string
          type: string
          updated_at: string
          utilization: number
        }
        Insert: {
          brand?: string
          capacity?: number
          created_at?: string
          current_route?: string
          department?: string
          driver?: string
          driver_user_id?: string | null
          fuel_level?: number
          id?: string
          number: string
          status?: string
          type?: string
          updated_at?: string
          utilization?: number
        }
        Update: {
          brand?: string
          capacity?: number
          created_at?: string
          current_route?: string
          department?: string
          driver?: string
          driver_user_id?: string | null
          fuel_level?: number
          id?: string
          number?: string
          status?: string
          type?: string
          updated_at?: string
          utilization?: number
        }
        Relationships: []
      }
      workers: {
        Row: {
          created_at: string
          current_site: string
          department: string
          id: string
          name: string
          phone: string
          role: string
          skills: string[]
          staff_code: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_site?: string
          department?: string
          id?: string
          name: string
          phone?: string
          role?: string
          skills?: string[]
          staff_code?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_site?: string
          department?: string
          id?: string
          name?: string
          phone?: string
          role?: string
          skills?: string[]
          staff_code?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      zone_locations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_keyword: string
          updated_at: string
          zone: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_keyword: string
          updated_at?: string
          zone: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_keyword?: string
          updated_at?: string
          zone?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_drives_vehicle: {
        Args: { _vehicle_number: string }
        Returns: boolean
      }
      driver_can_see_project: {
        Args: { _project_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "engineer" | "driver"
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
      app_role: ["admin", "engineer", "driver"],
    },
  },
} as const
