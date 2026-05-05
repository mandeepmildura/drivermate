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
      buses: {
        Row: {
          active: boolean
          bus_code: string
          created_at: string
          id: string
          rego: string | null
        }
        Insert: {
          active?: boolean
          bus_code: string
          created_at?: string
          id?: string
          rego?: string | null
        }
        Update: {
          active?: boolean
          bus_code?: string
          created_at?: string
          id?: string
          rego?: string | null
        }
        Relationships: []
      }
      client_errors: {
        Row: {
          app_version: string | null
          context: Json | null
          driver_id: string | null
          id: string
          message: string
          occurred_at: string
          shift_id: string | null
          source: string
          stack: string | null
          url: string | null
          user_agent: string | null
        }
        Insert: {
          app_version?: string | null
          context?: Json | null
          driver_id?: string | null
          id?: string
          message: string
          occurred_at?: string
          shift_id?: string | null
          source: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Update: {
          app_version?: string | null
          context?: Json | null
          driver_id?: string | null
          id?: string
          message?: string
          occurred_at?: string
          shift_id?: string | null
          source?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_errors_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_errors_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          active: boolean
          auth_user_id: string | null
          can_drive_vline: boolean
          created_at: string
          driver_number: string
          full_name: string
          id: string
          is_admin: boolean
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          can_drive_vline?: boolean
          created_at?: string
          driver_number: string
          full_name: string
          id?: string
          is_admin?: boolean
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          can_drive_vline?: boolean
          created_at?: string
          driver_number?: string
          full_name?: string
          id?: string
          is_admin?: boolean
        }
        Relationships: []
      }
      gps_breadcrumbs: {
        Row: {
          accuracy: number | null
          heading: number | null
          id: string
          lat: number
          lng: number
          recorded_at: string
          shift_id: string
          speed: number | null
          synced_at: string
        }
        Insert: {
          accuracy?: number | null
          heading?: number | null
          id?: string
          lat: number
          lng: number
          recorded_at: string
          shift_id: string
          speed?: number | null
          synced_at?: string
        }
        Update: {
          accuracy?: number | null
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          shift_id?: string
          speed?: number | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gps_breadcrumbs_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stops: {
        Row: {
          created_at: string
          id: string
          instruction_audio_cue: string | null
          instruction_text: string | null
          kind: string
          lat: number | null
          lng: number | null
          route_id: string
          scheduled_time: string | null
          sequence: number
          stop_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          instruction_audio_cue?: string | null
          instruction_text?: string | null
          kind?: string
          lat?: number | null
          lng?: number | null
          route_id: string
          scheduled_time?: string | null
          sequence: number
          stop_name: string
        }
        Update: {
          created_at?: string
          id?: string
          instruction_audio_cue?: string | null
          instruction_text?: string | null
          kind?: string
          lat?: number | null
          lng?: number | null
          route_id?: string
          scheduled_time?: string | null
          sequence?: number
          stop_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          display_number: string | null
          id: string
          locked: boolean
          path_geojson: Json | null
          route_number: string
          service_type: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_number?: string | null
          id?: string
          locked?: boolean
          path_geojson?: Json | null
          route_number: string
          service_type?: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_number?: string | null
          id?: string
          locked?: boolean
          path_geojson?: Json | null
          route_number?: string
          service_type?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      shifts: {
        Row: {
          bus_code_override: string | null
          bus_id: string | null
          client_created_at: string
          driver_id: string
          ended_at: string | null
          id: string
          route_id: string
          started_at: string
          synced_at: string
        }
        Insert: {
          bus_code_override?: string | null
          bus_id?: string | null
          client_created_at: string
          driver_id: string
          ended_at?: string | null
          id?: string
          route_id: string
          started_at: string
          synced_at?: string
        }
        Update: {
          bus_code_override?: string | null
          bus_id?: string | null
          client_created_at?: string
          driver_id?: string
          ended_at?: string | null
          id?: string
          route_id?: string
          started_at?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      stop_events: {
        Row: {
          arrived_at: string
          created_at: string
          id: string
          note: string | null
          pickup_count: number
          route_stop_id: string
          shift_id: string
        }
        Insert: {
          arrived_at: string
          created_at?: string
          id?: string
          note?: string | null
          pickup_count?: number
          route_stop_id: string
          shift_id: string
        }
        Update: {
          arrived_at?: string
          created_at?: string
          id?: string
          note?: string | null
          pickup_count?: number
          route_stop_id?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stop_events_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stop_events_route_stop_id_fkey"
            columns: ["route_stop_id"]
            isOneToOne: false
            referencedRelation: "route_stops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_driver_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      register_driver: { Args: { p_driver_number: string }; Returns: undefined }
      admin_reset_driver_pin: {
        Args: { p_driver_id: string; p_new_pin: string }
        Returns: undefined
      }
      insert_turn_waypoints: {
        Args: { p_route_id: string; p_after_sequence: number; p_turns: Json }
        Returns: Database['public']['Tables']['route_stops']['Row'][]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
