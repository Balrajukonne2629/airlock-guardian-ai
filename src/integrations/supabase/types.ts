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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_usage_windows: {
        Row: {
          reserved_calls: number
          user_id: string
          window_kind: string
          window_start: string
        }
        Insert: {
          reserved_calls?: number
          user_id: string
          window_kind: string
          window_start: string
        }
        Update: {
          reserved_calls?: number
          user_id?: string
          window_kind?: string
          window_start?: string
        }
        Relationships: []
      }
      airlock_events: {
        Row: {
          alert_id: string | null
          created_at: string
          field_name: string | null
          id: string
          input_text: string
          matched_rules: Json
          reason: string | null
          sanitized_text: string | null
          source: string
          verdict: string
        }
        Insert: {
          alert_id?: string | null
          created_at?: string
          field_name?: string | null
          id?: string
          input_text: string
          matched_rules?: Json
          reason?: string | null
          sanitized_text?: string | null
          source?: string
          verdict: string
        }
        Update: {
          alert_id?: string | null
          created_at?: string
          field_name?: string | null
          id?: string
          input_text?: string
          matched_rules?: Json
          reason?: string | null
          sanitized_text?: string | null
          source?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "airlock_events_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          airlock_status: string
          alert_type: string
          asset_id: string
          canary_type: string | null
          canary_value: string | null
          created_at: string
          id: string
          occurred_at: string
          poisoned: boolean
          raw_fields: Json
          severity: string
          source_ip: string
          status: string
        }
        Insert: {
          airlock_status?: string
          alert_type: string
          asset_id: string
          canary_type?: string | null
          canary_value?: string | null
          created_at?: string
          id: string
          occurred_at: string
          poisoned?: boolean
          raw_fields?: Json
          severity: string
          source_ip: string
          status?: string
        }
        Update: {
          airlock_status?: string
          alert_type?: string
          asset_id?: string
          canary_type?: string | null
          canary_value?: string | null
          created_at?: string
          id?: string
          occurred_at?: string
          poisoned?: boolean
          raw_fields?: Json
          severity?: string
          source_ip?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_type: string
          asset_value: number
          created_at: string
          criticality: string
          id: string
          name: string
          owner: string
        }
        Insert: {
          asset_type: string
          asset_value?: number
          created_at?: string
          criticality?: string
          id: string
          name: string
          owner: string
        }
        Update: {
          asset_type?: string
          asset_value?: number
          created_at?: string
          criticality?: string
          id?: string
          name?: string
          owner?: string
        }
        Relationships: []
      }
      benchmark_payloads: {
        Row: {
          canary_goal: string | null
          canary_type: string | null
          canary_value: string | null
          category: string
          id: string
          kind: string
          payload: string
          quick_suite: boolean
          set_name: string
        }
        Insert: {
          canary_goal?: string | null
          canary_type?: string | null
          canary_value?: string | null
          category: string
          id: string
          kind: string
          payload: string
          quick_suite?: boolean
          set_name?: string
        }
        Update: {
          canary_goal?: string | null
          canary_type?: string | null
          canary_value?: string | null
          category?: string
          id?: string
          kind?: string
          payload?: string
          quick_suite?: boolean
          set_name?: string
        }
        Relationships: []
      }
      benchmark_results: {
        Row: {
          airlock_confidence: number | null
          airlock_severity: string | null
          airlock_success: boolean | null
          category: string
          created_at: string
          detected: boolean | null
          error: string | null
          id: string
          kind: string
          layer2_reason: string | null
          matched_rules: Json | null
          model: string | null
          naive_confidence: number | null
          naive_severity: string | null
          naive_success: boolean | null
          payload_id: string
          run_id: string
          scan_verdict: string | null
          status: string
        }
        Insert: {
          airlock_confidence?: number | null
          airlock_severity?: string | null
          airlock_success?: boolean | null
          category: string
          created_at?: string
          detected?: boolean | null
          error?: string | null
          id?: string
          kind: string
          layer2_reason?: string | null
          matched_rules?: Json | null
          model?: string | null
          naive_confidence?: number | null
          naive_severity?: string | null
          naive_success?: boolean | null
          payload_id: string
          run_id: string
          scan_verdict?: string | null
          status?: string
        }
        Update: {
          airlock_confidence?: number | null
          airlock_severity?: string | null
          airlock_success?: boolean | null
          category?: string
          created_at?: string
          detected?: boolean | null
          error?: string | null
          id?: string
          kind?: string
          layer2_reason?: string | null
          matched_rules?: Json | null
          model?: string | null
          naive_confidence?: number | null
          naive_severity?: string | null
          naive_success?: boolean | null
          payload_id?: string
          run_id?: string
          scan_verdict?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "benchmark_results_payload_id_fkey"
            columns: ["payload_id"]
            isOneToOne: false
            referencedRelation: "benchmark_payloads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benchmark_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "benchmark_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      benchmark_runs: {
        Row: {
          baseline_error: string | null
          baseline_severity: string | null
          elapsed_seconds: number | null
          finished_at: string | null
          id: string
          metrics: Json | null
          model: string
          owner_id: string | null
          public_demo: boolean
          sample_size: number
          started_at: string
          status: string
          suite_type: string
        }
        Insert: {
          baseline_error?: string | null
          baseline_severity?: string | null
          elapsed_seconds?: number | null
          finished_at?: string | null
          id?: string
          metrics?: Json | null
          model: string
          owner_id?: string | null
          public_demo?: boolean
          sample_size?: number
          started_at?: string
          status?: string
          suite_type: string
        }
        Update: {
          baseline_error?: string | null
          baseline_severity?: string | null
          elapsed_seconds?: number | null
          finished_at?: string | null
          id?: string
          metrics?: Json | null
          model?: string
          owner_id?: string | null
          public_demo?: boolean
          sample_size?: number
          started_at?: string
          status?: string
          suite_type?: string
        }
        Relationships: []
      }
      demo_publications: {
        Row: {
          key: string
          payload: Json
          updated_at: string
        }
        Insert: {
          key: string
          payload: Json
          updated_at?: string
        }
        Update: {
          key?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          airlock_output: Json | null
          alert_id: string
          approved_at: string | null
          created_at: string
          id: string
          model: string | null
          naive_compromised: boolean | null
          naive_output: Json | null
          scan_summary: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          airlock_output?: Json | null
          alert_id: string
          approved_at?: string | null
          created_at?: string
          id?: string
          model?: string | null
          naive_compromised?: boolean | null
          naive_output?: Json | null
          scan_summary?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          airlock_output?: Json | null
          alert_id?: string
          approved_at?: string | null
          created_at?: string
          id?: string
          model?: string | null
          naive_compromised?: boolean | null
          naive_output?: Json | null
          scan_summary?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: true
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_audit: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          id: string
          target: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json
          id?: string
          target: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          id?: string
          target?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          role: string
          user_id: string
        }
        Update: {
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_incident_audited: { Args: { p_id: string }; Returns: string }
      create_owned_benchmark: {
        Args: { p_model: string; p_size: number; p_suite: string }
        Returns: string
      }
      is_logairlock_operator: { Args: never; Returns: boolean }
      refresh_demo_publications: { Args: never; Returns: undefined }
      reserve_ai_usage: {
        Args: { p_action: string; p_calls: number }
        Returns: undefined
      }
      update_asset_value_audited: {
        Args: { p_id: string; p_value: number }
        Returns: undefined
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
