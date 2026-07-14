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
      audit_entries: {
        Row: {
          action: string
          actor_id: string
          actor_name: string
          after_data: Json | null
          at: string
          before_data: Json | null
          entity: string
          entity_id: string
          id: string
          summary: string
        }
        Insert: {
          action: string
          actor_id: string
          actor_name: string
          after_data?: Json | null
          at: string
          before_data?: Json | null
          entity: string
          entity_id: string
          id: string
          summary: string
        }
        Update: {
          action?: string
          actor_id?: string
          actor_name?: string
          after_data?: Json | null
          at?: string
          before_data?: Json | null
          entity?: string
          entity_id?: string
          id?: string
          summary?: string
        }
        Relationships: []
      }
      downtime_events: {
        Row: {
          assignment_id: string | null
          category: string
          duration_min: number
          id: string
          line_id: string
          line_name: string
          notes: string | null
          operator_id: string | null
          operator_name: string | null
          reason_code: string
          started_at: string
          started_ts: string | null
          station_id: string | null
          status: string
          work_order_id: string | null
        }
        Insert: {
          assignment_id?: string | null
          category: string
          duration_min?: number
          id: string
          line_id: string
          line_name: string
          notes?: string | null
          operator_id?: string | null
          operator_name?: string | null
          reason_code: string
          started_at: string
          started_ts?: string | null
          station_id?: string | null
          status: string
          work_order_id?: string | null
        }
        Update: {
          assignment_id?: string | null
          category?: string
          duration_min?: number
          id?: string
          line_id?: string
          line_name?: string
          notes?: string | null
          operator_id?: string | null
          operator_name?: string | null
          reason_code?: string
          started_at?: string
          started_ts?: string | null
          station_id?: string | null
          status?: string
          work_order_id?: string | null
        }
        Relationships: []
      }
      genealogy_records: {
        Row: {
          id: string
          input_lot_id: string
          material: string
          output_lot_id: string
          qty_consumed: number
          recorded_at: string
          supplier: string
          uom: string
          work_order_id: string
        }
        Insert: {
          id: string
          input_lot_id: string
          material: string
          output_lot_id: string
          qty_consumed: number
          recorded_at: string
          supplier: string
          uom: string
          work_order_id: string
        }
        Update: {
          id?: string
          input_lot_id?: string
          material?: string
          output_lot_id?: string
          qty_consumed?: number
          recorded_at?: string
          supplier?: string
          uom?: string
          work_order_id?: string
        }
        Relationships: []
      }
      lines: {
        Row: {
          availability: number
          current_work_order: string | null
          id: string
          name: string
          oee: number
          output: number
          performance: number
          plant: string
          product: string | null
          quality: number
          status: string
          target: number
          updated_at: string
          uptime: string
        }
        Insert: {
          availability?: number
          current_work_order?: string | null
          id: string
          name: string
          oee?: number
          output?: number
          performance?: number
          plant: string
          product?: string | null
          quality?: number
          status: string
          target?: number
          updated_at?: string
          uptime?: string
        }
        Update: {
          availability?: number
          current_work_order?: string | null
          id?: string
          name?: string
          oee?: number
          output?: number
          performance?: number
          plant?: string
          product?: string | null
          quality?: number
          status?: string
          target?: number
          updated_at?: string
          uptime?: string
        }
        Relationships: []
      }
      mes_users: {
        Row: {
          email: string
          id: string
          mobile: string
          name: string
          role: string
          shift: string
          skills: string | null
          status: string
        }
        Insert: {
          email: string
          id: string
          mobile: string
          name: string
          role: string
          shift: string
          skills?: string | null
          status: string
        }
        Update: {
          email?: string
          id?: string
          mobile?: string
          name?: string
          role?: string
          shift?: string
          skills?: string | null
          status?: string
        }
        Relationships: []
      }
      product_units: {
        Row: {
          completed_at: string | null
          created_at: string
          current_line_id: string | null
          current_station_id: string | null
          lot_number: string
          produced_at: string | null
          product_id: string | null
          product_name: string
          production_order_id: string | null
          serial: number
          sku: string
          status: string
          uid: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_line_id?: string | null
          current_station_id?: string | null
          lot_number: string
          produced_at?: string | null
          product_id?: string | null
          product_name: string
          production_order_id?: string | null
          serial: number
          sku: string
          status?: string
          uid: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_line_id?: string | null
          current_station_id?: string | null
          lot_number?: string
          produced_at?: string | null
          product_id?: string | null
          product_name?: string
          production_order_id?: string | null
          serial?: number
          sku?: string
          status?: string
          uid?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_units_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          created_at: string
          id: string
          line_id: string | null
          lot_number: string
          notes: string | null
          number: string
          operator: string | null
          planned_end: string | null
          planned_start: string | null
          priority: string
          product_id: string | null
          product_name: string
          qty: number
          qty_produced: number
          shift: string
          sku: string
          status: string
          uom: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          line_id?: string | null
          lot_number: string
          notes?: string | null
          number: string
          operator?: string | null
          planned_end?: string | null
          planned_start?: string | null
          priority?: string
          product_id?: string | null
          product_name: string
          qty?: number
          qty_produced?: number
          shift?: string
          sku: string
          status?: string
          uom?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          line_id?: string | null
          lot_number?: string
          notes?: string | null
          number?: string
          operator?: string | null
          planned_end?: string | null
          planned_start?: string | null
          priority?: string
          product_id?: string | null
          product_name?: string
          qty?: number
          qty_produced?: number
          shift?: string
          sku?: string
          status?: string
          uom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          acceptance_criteria: Json | null
          attachments: Json | null
          batching_limit: number
          created_at: string
          description: string | null
          id: string
          lead_time: number
          name: string
          sale_price: number
          sku: string
          specifications: Json | null
          standard_cost: number
          type: string
          uom: string
          updated_at: string
        }
        Insert: {
          acceptance_criteria?: Json | null
          attachments?: Json | null
          batching_limit?: number
          created_at?: string
          description?: string | null
          id: string
          lead_time?: number
          name: string
          sale_price?: number
          sku: string
          specifications?: Json | null
          standard_cost?: number
          type?: string
          uom?: string
          updated_at?: string
        }
        Update: {
          acceptance_criteria?: Json | null
          attachments?: Json | null
          batching_limit?: number
          created_at?: string
          description?: string | null
          id?: string
          lead_time?: number
          name?: string
          sale_price?: number
          sku?: string
          specifications?: Json | null
          standard_cost?: number
          type?: string
          uom?: string
          updated_at?: string
        }
        Relationships: []
      }
      quality_holds: {
        Row: {
          id: string
          line_id: string
          lot_id: string
          raised_at: string
          raised_by: string
          raised_ts: string | null
          reason: string
          severity: string
          status: string
          work_order_id: string
        }
        Insert: {
          id: string
          line_id: string
          lot_id: string
          raised_at: string
          raised_by: string
          raised_ts?: string | null
          reason: string
          severity: string
          status: string
          work_order_id: string
        }
        Update: {
          id?: string
          line_id?: string
          lot_id?: string
          raised_at?: string
          raised_by?: string
          raised_ts?: string | null
          reason?: string
          severity?: string
          status?: string
          work_order_id?: string
        }
        Relationships: []
      }
      stations: {
        Row: {
          current_step: string | null
          current_value: string | null
          cycle_time_sec: number
          id: string
          last_tick_at: string | null
          line_id: string
          machine: Json | null
          name: string
          oee: number | null
          sequence: number
          status: string
          target: string | null
          template_ids: string[] | null
          type: string
          updated_at: string
        }
        Insert: {
          current_step?: string | null
          current_value?: string | null
          cycle_time_sec?: number
          id: string
          last_tick_at?: string | null
          line_id: string
          machine?: Json | null
          name: string
          oee?: number | null
          sequence: number
          status: string
          target?: string | null
          template_ids?: string[] | null
          type: string
          updated_at?: string
        }
        Update: {
          current_step?: string | null
          current_value?: string | null
          cycle_time_sec?: number
          id?: string
          last_tick_at?: string | null
          line_id?: string
          machine?: Json | null
          name?: string
          oee?: number | null
          sequence?: number
          status?: string
          target?: string | null
          template_ids?: string[] | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stations_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_events: {
        Row: {
          at: string
          event: string
          id: string
          line_id: string | null
          notes: string | null
          operator_id: string | null
          operator_name: string | null
          result: string | null
          station_id: string | null
          station_name: string | null
          unit_uid: string
        }
        Insert: {
          at?: string
          event: string
          id: string
          line_id?: string | null
          notes?: string | null
          operator_id?: string | null
          operator_name?: string | null
          result?: string | null
          station_id?: string | null
          station_name?: string | null
          unit_uid: string
        }
        Update: {
          at?: string
          event?: string
          id?: string
          line_id?: string | null
          notes?: string | null
          operator_id?: string | null
          operator_name?: string | null
          result?: string | null
          station_id?: string | null
          station_name?: string | null
          unit_uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_events_unit_uid_fkey"
            columns: ["unit_uid"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["uid"]
          },
        ]
      }
      work_orders: {
        Row: {
          ends_at: string | null
          id: string
          line_id: string
          operator: string | null
          product: string
          production_order_id: string
          progress: number
          qty_produced: number
          qty_target: number
          shift: string
          sku: string
          started_at: string | null
          status: string
          uom: string
          updated_at: string
        }
        Insert: {
          ends_at?: string | null
          id: string
          line_id: string
          operator?: string | null
          product: string
          production_order_id: string
          progress?: number
          qty_produced?: number
          qty_target: number
          shift: string
          sku: string
          started_at?: string | null
          status: string
          uom: string
          updated_at?: string
        }
        Update: {
          ends_at?: string | null
          id?: string
          line_id?: string
          operator?: string | null
          product?: string
          production_order_id?: string
          progress?: number
          qty_produced?: number
          qty_target?: number
          shift?: string
          sku?: string
          started_at?: string | null
          status?: string
          uom?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
