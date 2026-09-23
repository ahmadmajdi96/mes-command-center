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
      areas: {
        Row: {
          created_at: string
          id: string
          name: string
          site_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          site_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_entries: {
        Row: {
          action: string
          actor_id: string
          actor_name: string
          actor_user_id: string | null
          after_data: Json | null
          at: string
          before_data: Json | null
          correlation_id: string | null
          device_id: string | null
          entity: string
          entity_id: string
          id: string
          reason: string | null
          session_id: string | null
          summary: string
        }
        Insert: {
          action: string
          actor_id: string
          actor_name: string
          actor_user_id?: string | null
          after_data?: Json | null
          at: string
          before_data?: Json | null
          correlation_id?: string | null
          device_id?: string | null
          entity: string
          entity_id: string
          id: string
          reason?: string | null
          session_id?: string | null
          summary: string
        }
        Update: {
          action?: string
          actor_id?: string
          actor_name?: string
          actor_user_id?: string | null
          after_data?: Json | null
          at?: string
          before_data?: Json | null
          correlation_id?: string | null
          device_id?: string | null
          entity?: string
          entity_id?: string
          id?: string
          reason?: string | null
          session_id?: string | null
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
          area_id: string | null
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
          site_id: string | null
          status: string
          target: number
          updated_at: string
          uptime: string
        }
        Insert: {
          area_id?: string | null
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
          site_id?: string | null
          status: string
          target?: number
          updated_at?: string
          uptime?: string
        }
        Update: {
          area_id?: string | null
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
          site_id?: string | null
          status?: string
          target?: number
          updated_at?: string
          uptime?: string
        }
        Relationships: [
          {
            foreignKeyName: "lines_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lines_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      mes_users: {
        Row: {
          active: boolean
          auth_user_id: string | null
          email: string
          id: string
          mobile: string
          name: string
          role: string
          shift: string
          site_id: string | null
          skills: string | null
          status: string
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          email: string
          id: string
          mobile: string
          name: string
          role: string
          shift: string
          site_id?: string | null
          skills?: string | null
          status: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          email?: string
          id?: string
          mobile?: string
          name?: string
          role?: string
          shift?: string
          site_id?: string | null
          skills?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mes_users_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          created_at: string
          description: string
          key: string
        }
        Insert: {
          created_at?: string
          description: string
          key: string
        }
        Update: {
          created_at?: string
          description?: string
          key?: string
        }
        Relationships: []
      }
      product_station_recipes: {
        Row: {
          created_at: string
          id: string
          instructions: string | null
          product_id: string
          sequence: number
          station_id: string
          target_cycle_sec: number | null
          updated_at: string
          variables: Json
        }
        Insert: {
          created_at?: string
          id?: string
          instructions?: string | null
          product_id: string
          sequence?: number
          station_id: string
          target_cycle_sec?: number | null
          updated_at?: string
          variables?: Json
        }
        Update: {
          created_at?: string
          id?: string
          instructions?: string | null
          product_id?: string
          sequence?: number
          station_id?: string
          target_cycle_sec?: number | null
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "product_station_recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_station_recipes_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_units: {
        Row: {
          batch_id: string | null
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
          batch_id?: string | null
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
          batch_id?: string | null
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
            foreignKeyName: "product_units_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_units_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batches: {
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
          production_order_id: string
          qty: number
          qty_produced: number
          sequence: number
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
          production_order_id: string
          qty?: number
          qty_produced?: number
          sequence?: number
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
          production_order_id?: string
          qty?: number
          qty_produced?: number
          sequence?: number
          shift?: string
          sku?: string
          status?: string
          uom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_batches_production_order_id_fkey"
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          job_title: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
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
      role_permissions: {
        Row: {
          permission_key: string
          role_key: string
        }
        Insert: {
          permission_key: string
          role_key: string
        }
        Update: {
          permission_key?: string
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          key: string
          label: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          label: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          label?: string
        }
        Relationships: []
      }
      sites: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id: string
          name: string
          organization_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      station_holds: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closed_by_name: string | null
          closed_by_user_id: string | null
          created_at: string
          evidence_urls: Json
          hold_type: string
          id: string
          opened_at: string
          opened_by: string | null
          opened_by_name: string | null
          opened_by_user_id: string | null
          reason: string
          resolution_notes: string | null
          station_id: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          closed_by_user_id?: string | null
          created_at?: string
          evidence_urls?: Json
          hold_type: string
          id?: string
          opened_at?: string
          opened_by?: string | null
          opened_by_name?: string | null
          opened_by_user_id?: string | null
          reason: string
          resolution_notes?: string | null
          station_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          closed_by_user_id?: string | null
          created_at?: string
          evidence_urls?: Json
          hold_type?: string
          id?: string
          opened_at?: string
          opened_by?: string | null
          opened_by_name?: string | null
          opened_by_user_id?: string | null
          reason?: string
          resolution_notes?: string | null
          station_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_holds_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      station_waste_reasons: {
        Row: {
          reason_id: string
          station_id: string
        }
        Insert: {
          reason_id: string
          station_id: string
        }
        Update: {
          reason_id?: string
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_waste_reasons_reason_id_fkey"
            columns: ["reason_id"]
            isOneToOne: false
            referencedRelation: "waste_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_waste_reasons_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      stations: {
        Row: {
          current_mode: string | null
          current_step: string | null
          current_value: string | null
          cycle_time_sec: number
          id: string
          last_tick_at: string | null
          line_id: string
          machine: Json | null
          name: string
          oee: number | null
          operation_modes: Json | null
          sequence: number
          status: string
          target: string | null
          template_ids: string[] | null
          type: string
          updated_at: string
        }
        Insert: {
          current_mode?: string | null
          current_step?: string | null
          current_value?: string | null
          cycle_time_sec?: number
          id: string
          last_tick_at?: string | null
          line_id: string
          machine?: Json | null
          name: string
          oee?: number | null
          operation_modes?: Json | null
          sequence: number
          status: string
          target?: string | null
          template_ids?: string[] | null
          type: string
          updated_at?: string
        }
        Update: {
          current_mode?: string | null
          current_step?: string | null
          current_value?: string | null
          cycle_time_sec?: number
          id?: string
          last_tick_at?: string | null
          line_id?: string
          machine?: Json | null
          name?: string
          oee?: number | null
          operation_modes?: Json | null
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
          actor_user_id: string | null
          at: string
          batch_id: string | null
          correction_reason: string | null
          corrects_event_id: string | null
          correlation_id: string | null
          device_id: string | null
          dwell_seconds: number | null
          entered_at: string | null
          event: string
          exited_at: string | null
          id: string
          line_id: string | null
          notes: string | null
          operator_id: string | null
          operator_name: string | null
          result: string | null
          session_id: string | null
          station_id: string | null
          station_name: string | null
          unit_uid: string
        }
        Insert: {
          actor_user_id?: string | null
          at?: string
          batch_id?: string | null
          correction_reason?: string | null
          corrects_event_id?: string | null
          correlation_id?: string | null
          device_id?: string | null
          dwell_seconds?: number | null
          entered_at?: string | null
          event: string
          exited_at?: string | null
          id: string
          line_id?: string | null
          notes?: string | null
          operator_id?: string | null
          operator_name?: string | null
          result?: string | null
          session_id?: string | null
          station_id?: string | null
          station_name?: string | null
          unit_uid: string
        }
        Update: {
          actor_user_id?: string | null
          at?: string
          batch_id?: string | null
          correction_reason?: string | null
          corrects_event_id?: string | null
          correlation_id?: string | null
          device_id?: string | null
          dwell_seconds?: number | null
          entered_at?: string | null
          event?: string
          exited_at?: string | null
          id?: string
          line_id?: string | null
          notes?: string | null
          operator_id?: string | null
          operator_name?: string | null
          result?: string | null
          session_id?: string | null
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
      unit_readings: {
        Row: {
          actor_user_id: string | null
          correction_reason: string | null
          corrects_reading_id: string | null
          correlation_id: string | null
          created_at: string
          device_id: string | null
          id: string
          mode: string | null
          operator_id: string | null
          operator_name: string | null
          station_id: string | null
          unit_event_id: string | null
          unit_uid: string
          variables: Json
        }
        Insert: {
          actor_user_id?: string | null
          correction_reason?: string | null
          corrects_reading_id?: string | null
          correlation_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          mode?: string | null
          operator_id?: string | null
          operator_name?: string | null
          station_id?: string | null
          unit_event_id?: string | null
          unit_uid: string
          variables?: Json
        }
        Update: {
          actor_user_id?: string | null
          correction_reason?: string | null
          corrects_reading_id?: string | null
          correlation_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          mode?: string | null
          operator_id?: string | null
          operator_name?: string | null
          station_id?: string | null
          unit_event_id?: string | null
          unit_uid?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "unit_readings_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_readings_unit_event_id_fkey"
            columns: ["unit_event_id"]
            isOneToOne: false
            referencedRelation: "unit_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_readings_unit_uid_fkey"
            columns: ["unit_uid"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["uid"]
          },
        ]
      }
      user_role_grants: {
        Row: {
          condition: string | null
          created_at: string
          effective_from: string
          effective_to: string | null
          granted_by: string | null
          id: string
          role_key: string
          scope_id: string | null
          scope_kind: string
          updated_at: string
          user_id: string
        }
        Insert: {
          condition?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          granted_by?: string | null
          id?: string
          role_key: string
          scope_id?: string | null
          scope_kind?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          condition?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          granted_by?: string | null
          id?: string
          role_key?: string
          scope_id?: string | null
          scope_kind?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_grants_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waste_events: {
        Row: {
          actor_user_id: string | null
          correlation_id: string | null
          created_at: string
          device_id: string | null
          evidence_urls: Json
          id: string
          line_id: string | null
          lot_number: string | null
          notes: string | null
          operator_id: string | null
          operator_name: string | null
          production_order_id: string | null
          reason_category: string | null
          reason_code: string
          reason_label: string
          station_id: string | null
          station_name: string | null
          unit_uid: string | null
        }
        Insert: {
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          device_id?: string | null
          evidence_urls?: Json
          id?: string
          line_id?: string | null
          lot_number?: string | null
          notes?: string | null
          operator_id?: string | null
          operator_name?: string | null
          production_order_id?: string | null
          reason_category?: string | null
          reason_code: string
          reason_label: string
          station_id?: string | null
          station_name?: string | null
          unit_uid?: string | null
        }
        Update: {
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          device_id?: string | null
          evidence_urls?: Json
          id?: string
          line_id?: string | null
          lot_number?: string | null
          notes?: string | null
          operator_id?: string | null
          operator_name?: string | null
          production_order_id?: string | null
          reason_category?: string | null
          reason_code?: string
          reason_label?: string
          station_id?: string | null
          station_name?: string | null
          unit_uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waste_events_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_events_unit_uid_fkey"
            columns: ["unit_uid"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["uid"]
          },
        ]
      }
      waste_reasons: {
        Row: {
          active: boolean
          category: string
          code: string
          created_at: string
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          code: string
          created_at?: string
          id?: string
          label: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          created_at?: string
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
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
      can_admin_users: { Args: { _user_id: string }; Returns: boolean }
      has_action: {
        Args: { _action: string; _user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: {
          _action: string
          _scope_id?: string
          _scope_kind?: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      scope_ancestors: {
        Args: { _id: string; _kind: string }
        Returns: {
          scope_id: string
          scope_kind: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "operator" | "viewer"
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
    Enums: {
      app_role: ["admin", "supervisor", "operator", "viewer"],
    },
  },
} as const
