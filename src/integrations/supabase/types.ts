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
      activity_confirmations: {
        Row: {
          activity_type: string
          actor_name: string | null
          actor_user_id: string | null
          created_at: string
          id: string
          minutes: number
          notes: string | null
          operation_id: string | null
          organization_id: string
          people: number
          production_order_id: string
        }
        Insert: {
          activity_type: string
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          minutes: number
          notes?: string | null
          operation_id?: string | null
          organization_id?: string
          people?: number
          production_order_id: string
        }
        Update: {
          activity_type?: string
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          minutes?: number
          notes?: string | null
          operation_id?: string | null
          organization_id?: string
          people?: number
          production_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_confirmations_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "order_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_confirmations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_confirmations_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          reason?: string | null
          session_id?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_station_progress: {
        Row: {
          actor_user_id: string | null
          batch_id: string
          closed_at: string | null
          correction_reason: string | null
          corrects_progress_id: string | null
          correlation_id: string | null
          created_at: string
          device_id: string | null
          id: string
          line_id: string | null
          notes: string | null
          opened_at: string
          operator_id: string | null
          operator_name: string | null
          organization_id: string
          production_order_id: string | null
          qty_good: number
          qty_in: number
          qty_rework: number
          qty_scrap: number
          scrap_reason_code: string | null
          station_id: string | null
          station_name: string | null
        }
        Insert: {
          actor_user_id?: string | null
          batch_id: string
          closed_at?: string | null
          correction_reason?: string | null
          corrects_progress_id?: string | null
          correlation_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          line_id?: string | null
          notes?: string | null
          opened_at?: string
          operator_id?: string | null
          operator_name?: string | null
          organization_id?: string
          production_order_id?: string | null
          qty_good?: number
          qty_in?: number
          qty_rework?: number
          qty_scrap?: number
          scrap_reason_code?: string | null
          station_id?: string | null
          station_name?: string | null
        }
        Update: {
          actor_user_id?: string | null
          batch_id?: string
          closed_at?: string | null
          correction_reason?: string | null
          corrects_progress_id?: string | null
          correlation_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          line_id?: string | null
          notes?: string | null
          opened_at?: string
          operator_id?: string | null
          operator_name?: string | null
          organization_id?: string
          production_order_id?: string | null
          qty_good?: number
          qty_in?: number
          qty_rework?: number
          qty_scrap?: number
          scrap_reason_code?: string | null
          station_id?: string | null
          station_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_station_progress_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_station_progress_corrects_progress_id_fkey"
            columns: ["corrects_progress_id"]
            isOneToOne: false
            referencedRelation: "batch_station_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_station_progress_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_station_progress_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_items: {
        Row: {
          auto_confirm: boolean
          backflush: boolean
          bom_id: string
          component_name: string
          component_product_id: string | null
          component_sku: string
          created_at: string
          id: string
          item_type: string
          organization_id: string
          qty: number
          sequence: number
          uom: string
        }
        Insert: {
          auto_confirm?: boolean
          backflush?: boolean
          bom_id: string
          component_name: string
          component_product_id?: string | null
          component_sku: string
          created_at?: string
          id?: string
          item_type?: string
          organization_id?: string
          qty: number
          sequence?: number
          uom?: string
        }
        Update: {
          auto_confirm?: boolean
          backflush?: boolean
          bom_id?: string
          component_name?: string
          component_product_id?: string | null
          component_sku?: string
          created_at?: string
          id?: string
          item_type?: string
          organization_id?: string
          qty?: number
          sequence?: number
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_items_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      boms: {
        Row: {
          base_qty: number
          created_at: string
          erp_id: string | null
          id: string
          mes_override: boolean
          organization_id: string
          product_id: string | null
          sku: string
          status: string
          uom: string
          updated_at: string
          version: string
        }
        Insert: {
          base_qty?: number
          created_at?: string
          erp_id?: string | null
          id: string
          mes_override?: boolean
          organization_id?: string
          product_id?: string | null
          sku: string
          status?: string
          uom?: string
          updated_at?: string
          version?: string
        }
        Update: {
          base_qty?: number
          created_at?: string
          erp_id?: string | null
          id?: string
          mes_override?: boolean
          organization_id?: string
          product_id?: string | null
          sku?: string
          status?: string
          uom?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "boms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boms_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          reason_code?: string
          started_at?: string
          started_ts?: string | null
          station_id?: string | null
          status?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "downtime_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_sync_log: {
        Row: {
          action: string
          created_at: string
          direction: string
          entity: string
          erp_id: string | null
          id: string
          message: string | null
          organization_id: string
          payload: Json | null
          status: string
        }
        Insert: {
          action: string
          created_at?: string
          direction?: string
          entity: string
          erp_id?: string | null
          id?: string
          message?: string | null
          organization_id?: string
          payload?: Json | null
          status: string
        }
        Update: {
          action?: string
          created_at?: string
          direction?: string
          entity?: string
          erp_id?: string | null
          id?: string
          message?: string | null
          organization_id?: string
          payload?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_sync_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      genealogy_records: {
        Row: {
          id: string
          input_lot_id: string
          material: string
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          output_lot_id?: string
          qty_consumed?: number
          recorded_at?: string
          supplier?: string
          uom?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "genealogy_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          actor_name: string | null
          actor_user_id: string | null
          auto: boolean
          batch_id: string | null
          confirmation_id: string | null
          created_at: string
          id: string
          lot_number: string | null
          name: string
          organization_id: string
          production_order_id: string
          qty: number
          receipt_type: string
          sku: string
          storage_location: string | null
          uom: string
        }
        Insert: {
          actor_name?: string | null
          actor_user_id?: string | null
          auto?: boolean
          batch_id?: string | null
          confirmation_id?: string | null
          created_at?: string
          id?: string
          lot_number?: string | null
          name: string
          organization_id?: string
          production_order_id: string
          qty: number
          receipt_type: string
          sku: string
          storage_location?: string | null
          uom?: string
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string | null
          auto?: boolean
          batch_id?: string | null
          confirmation_id?: string | null
          created_at?: string
          id?: string
          lot_number?: string | null
          name?: string
          organization_id?: string
          production_order_id?: string
          qty?: number
          receipt_type?: string
          sku?: string
          storage_location?: string | null
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_confirmation_id_fkey"
            columns: ["confirmation_id"]
            isOneToOne: false
            referencedRelation: "production_confirmations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      lines: {
        Row: {
          area_id: string | null
          availability: number
          current_work_order: string | null
          enforce_route: boolean
          id: string
          name: string
          oee: number
          organization_id: string
          output: number
          performance: number
          plant: string
          product: string | null
          quality: number
          site_id: string | null
          status: string
          target: number
          tracking_mode: string
          updated_at: string
          uptime: string
        }
        Insert: {
          area_id?: string | null
          availability?: number
          current_work_order?: string | null
          enforce_route?: boolean
          id: string
          name: string
          oee?: number
          organization_id?: string
          output?: number
          performance?: number
          plant: string
          product?: string | null
          quality?: number
          site_id?: string | null
          status: string
          target?: number
          tracking_mode?: string
          updated_at?: string
          uptime?: string
        }
        Update: {
          area_id?: string | null
          availability?: number
          current_work_order?: string | null
          enforce_route?: boolean
          id?: string
          name?: string
          oee?: number
          organization_id?: string
          output?: number
          performance?: number
          plant?: string
          product?: string | null
          quality?: number
          site_id?: string | null
          status?: string
          target?: number
          tracking_mode?: string
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
            foreignKeyName: "lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      material_consumptions: {
        Row: {
          actor_name: string | null
          actor_user_id: string | null
          backflush: boolean
          batch_id: string | null
          component_name: string
          component_sku: string
          confirmation_id: string | null
          correlation_id: string | null
          created_at: string
          id: string
          input_lot: string | null
          notes: string | null
          operation_id: string | null
          organization_id: string
          production_order_id: string
          qty: number
          uom: string
        }
        Insert: {
          actor_name?: string | null
          actor_user_id?: string | null
          backflush?: boolean
          batch_id?: string | null
          component_name: string
          component_sku: string
          confirmation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          input_lot?: string | null
          notes?: string | null
          operation_id?: string | null
          organization_id?: string
          production_order_id: string
          qty: number
          uom?: string
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string | null
          backflush?: boolean
          batch_id?: string | null
          component_name?: string
          component_sku?: string
          confirmation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          input_lot?: string | null
          notes?: string | null
          operation_id?: string | null
          organization_id?: string
          production_order_id?: string
          qty?: number
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_consumptions_confirmation_id_fkey"
            columns: ["confirmation_id"]
            isOneToOne: false
            referencedRelation: "production_confirmations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumptions_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "order_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumptions_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          role?: string
          shift?: string
          site_id?: string | null
          skills?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mes_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mes_users_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      order_components: {
        Row: {
          auto_confirm: boolean
          backflush: boolean
          component_name: string
          component_product_id: string | null
          component_sku: string
          created_at: string
          id: string
          item_type: string
          organization_id: string
          planned_qty: number
          production_order_id: string
          uom: string
        }
        Insert: {
          auto_confirm?: boolean
          backflush?: boolean
          component_name: string
          component_product_id?: string | null
          component_sku: string
          created_at?: string
          id?: string
          item_type?: string
          organization_id?: string
          planned_qty?: number
          production_order_id: string
          uom?: string
        }
        Update: {
          auto_confirm?: boolean
          backflush?: boolean
          component_name?: string
          component_product_id?: string | null
          component_sku?: string
          created_at?: string
          id?: string
          item_type?: string
          organization_id?: string
          planned_qty?: number
          production_order_id?: string
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_components_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_operations: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          production_order_id: string
          qty_scrap: number
          qty_yield: number
          run_min_per_unit: number
          sequence: number
          setup_min: number
          started_at: string | null
          started_by: string | null
          status: string
          updated_at: string
          work_center_id: string | null
          work_instructions: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id?: string
          production_order_id: string
          qty_scrap?: number
          qty_yield?: number
          run_min_per_unit?: number
          sequence: number
          setup_min?: number
          started_at?: string | null
          started_by?: string | null
          status?: string
          updated_at?: string
          work_center_id?: string | null
          work_instructions?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          production_order_id?: string
          qty_scrap?: number
          qty_yield?: number
          run_min_per_unit?: number
          sequence?: number
          setup_min?: number
          started_at?: string | null
          started_by?: string | null
          status?: string
          updated_at?: string
          work_center_id?: string | null
          work_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_operations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_operations_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
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
      packing_unit_items: {
        Row: {
          batch_id: string | null
          created_at: string
          id: string
          organization_id: string
          packing_unit_id: string
          partial: boolean
          qty: number
          unit_uid: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          packing_unit_id: string
          partial?: boolean
          qty: number
          unit_uid?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          packing_unit_id?: string
          partial?: boolean
          qty?: number
          unit_uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packing_unit_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_unit_items_packing_unit_id_fkey"
            columns: ["packing_unit_id"]
            isOneToOne: false
            referencedRelation: "packing_units"
            referencedColumns: ["id"]
          },
        ]
      }
      packing_units: {
        Row: {
          capacity: number | null
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          pack_type: string
          production_order_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          id: string
          organization_id?: string
          pack_type?: string
          production_order_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          pack_type?: string
          production_order_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packing_units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_units_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
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
          blocks_on_fail: boolean
          created_at: string
          id: string
          instructions: string | null
          is_ccp: boolean
          organization_id: string
          product_id: string
          requires_reading: boolean
          sequence: number
          station_id: string
          target_cycle_sec: number | null
          updated_at: string
          variables: Json
        }
        Insert: {
          blocks_on_fail?: boolean
          created_at?: string
          id?: string
          instructions?: string | null
          is_ccp?: boolean
          organization_id?: string
          product_id: string
          requires_reading?: boolean
          sequence?: number
          station_id: string
          target_cycle_sec?: number | null
          updated_at?: string
          variables?: Json
        }
        Update: {
          blocks_on_fail?: boolean
          created_at?: string
          id?: string
          instructions?: string | null
          is_ccp?: boolean
          organization_id?: string
          product_id?: string
          requires_reading?: boolean
          sequence?: number
          station_id?: string
          target_cycle_sec?: number | null
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "product_station_recipes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
            foreignKeyName: "product_units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          erp_id: string | null
          id: string
          line_id: string | null
          lot_number: string
          notes: string | null
          number: string
          operator: string | null
          organization_id: string
          planned_end: string | null
          planned_start: string | null
          priority: string
          product_id: string | null
          product_name: string
          production_order_id: string
          qty: number
          qty_good: number
          qty_produced: number
          qty_rework: number
          qty_scrap: number
          sequence: number
          shift: string
          sku: string
          status: string
          tracking_mode: string
          uom: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          erp_id?: string | null
          id: string
          line_id?: string | null
          lot_number: string
          notes?: string | null
          number: string
          operator?: string | null
          organization_id?: string
          planned_end?: string | null
          planned_start?: string | null
          priority?: string
          product_id?: string | null
          product_name: string
          production_order_id: string
          qty?: number
          qty_good?: number
          qty_produced?: number
          qty_rework?: number
          qty_scrap?: number
          sequence?: number
          shift?: string
          sku: string
          status?: string
          tracking_mode?: string
          uom?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          erp_id?: string | null
          id?: string
          line_id?: string | null
          lot_number?: string
          notes?: string | null
          number?: string
          operator?: string | null
          organization_id?: string
          planned_end?: string | null
          planned_start?: string | null
          priority?: string
          product_id?: string | null
          product_name?: string
          production_order_id?: string
          qty?: number
          qty_good?: number
          qty_produced?: number
          qty_rework?: number
          qty_scrap?: number
          sequence?: number
          shift?: string
          sku?: string
          status?: string
          tracking_mode?: string
          uom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_confirmations: {
        Row: {
          actor_name: string | null
          actor_user_id: string | null
          batch_id: string | null
          correlation_id: string | null
          created_at: string
          final: boolean
          id: string
          notes: string | null
          operation_id: string | null
          organization_id: string
          post_goods_receipt: boolean
          production_order_id: string
          qty_scrap: number
          qty_yield: number
          scrap_reason: string | null
        }
        Insert: {
          actor_name?: string | null
          actor_user_id?: string | null
          batch_id?: string | null
          correlation_id?: string | null
          created_at?: string
          final?: boolean
          id?: string
          notes?: string | null
          operation_id?: string | null
          organization_id?: string
          post_goods_receipt?: boolean
          production_order_id: string
          qty_scrap?: number
          qty_yield?: number
          scrap_reason?: string | null
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string | null
          batch_id?: string | null
          correlation_id?: string | null
          created_at?: string
          final?: boolean
          id?: string
          notes?: string | null
          operation_id?: string | null
          organization_id?: string
          post_goods_receipt?: boolean
          production_order_id?: string
          qty_scrap?: number
          qty_yield?: number
          scrap_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_confirmations_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "order_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_confirmations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_confirmations_production_order_id_fkey"
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
          erp_id: string | null
          id: string
          line_id: string | null
          lot_number: string
          mes_override: boolean
          notes: string | null
          number: string
          operator: string | null
          organization_id: string
          planned_end: string | null
          planned_start: string | null
          priority: string
          product_id: string | null
          product_name: string
          production_version_id: string | null
          qty: number
          qty_good: number
          qty_produced: number
          qty_rework: number
          qty_scrap: number
          shift: string
          sku: string
          status: string
          tracking_mode: string
          uom: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          erp_id?: string | null
          id: string
          line_id?: string | null
          lot_number: string
          mes_override?: boolean
          notes?: string | null
          number: string
          operator?: string | null
          organization_id?: string
          planned_end?: string | null
          planned_start?: string | null
          priority?: string
          product_id?: string | null
          product_name: string
          production_version_id?: string | null
          qty?: number
          qty_good?: number
          qty_produced?: number
          qty_rework?: number
          qty_scrap?: number
          shift?: string
          sku: string
          status?: string
          tracking_mode?: string
          uom?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          erp_id?: string | null
          id?: string
          line_id?: string | null
          lot_number?: string
          mes_override?: boolean
          notes?: string | null
          number?: string
          operator?: string | null
          organization_id?: string
          planned_end?: string | null
          planned_start?: string | null
          priority?: string
          product_id?: string | null
          product_name?: string
          production_version_id?: string | null
          qty?: number
          qty_good?: number
          qty_produced?: number
          qty_rework?: number
          qty_scrap?: number
          shift?: string
          sku?: string
          status?: string
          tracking_mode?: string
          uom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_production_version_id_fkey"
            columns: ["production_version_id"]
            isOneToOne: false
            referencedRelation: "production_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      production_versions: {
        Row: {
          bom_id: string | null
          created_at: string
          description: string | null
          erp_id: string | null
          id: string
          is_default: boolean
          mes_override: boolean
          organization_id: string
          product_id: string | null
          routing_id: string | null
          sku: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          version: string
        }
        Insert: {
          bom_id?: string | null
          created_at?: string
          description?: string | null
          erp_id?: string | null
          id: string
          is_default?: boolean
          mes_override?: boolean
          organization_id?: string
          product_id?: string | null
          routing_id?: string | null
          sku: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          version: string
        }
        Update: {
          bom_id?: string | null
          created_at?: string
          description?: string | null
          erp_id?: string | null
          id?: string
          is_default?: boolean
          mes_override?: boolean
          organization_id?: string
          product_id?: string | null
          routing_id?: string | null
          sku?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_versions_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_versions_routing_id_fkey"
            columns: ["routing_id"]
            isOneToOne: false
            referencedRelation: "routings"
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
          erp_id: string | null
          id: string
          lead_time: number
          mes_override: boolean
          name: string
          organization_id: string
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
          erp_id?: string | null
          id: string
          lead_time?: number
          mes_override?: boolean
          name: string
          organization_id?: string
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
          erp_id?: string | null
          id?: string
          lead_time?: number
          mes_override?: boolean
          name?: string
          organization_id?: string
          sale_price?: number
          sku?: string
          specifications?: Json | null
          standard_cost?: number
          type?: string
          uom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          raised_at?: string
          raised_by?: string
          raised_ts?: string | null
          reason?: string
          severity?: string
          status?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_holds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      routing_operations: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          routing_id: string
          run_min_per_unit: number
          sequence: number
          setup_min: number
          work_center_id: string | null
          work_instructions: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string
          routing_id: string
          run_min_per_unit?: number
          sequence: number
          setup_min?: number
          work_center_id?: string | null
          work_instructions?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          routing_id?: string
          run_min_per_unit?: number
          sequence?: number
          setup_min?: number
          work_center_id?: string | null
          work_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routing_operations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routing_operations_routing_id_fkey"
            columns: ["routing_id"]
            isOneToOne: false
            referencedRelation: "routings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routing_operations_work_center_id_fkey"
            columns: ["work_center_id"]
            isOneToOne: false
            referencedRelation: "work_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      routings: {
        Row: {
          created_at: string
          erp_id: string | null
          id: string
          mes_override: boolean
          organization_id: string
          product_id: string | null
          sku: string
          status: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          erp_id?: string | null
          id: string
          mes_override?: boolean
          organization_id?: string
          product_id?: string | null
          sku: string
          status?: string
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          erp_id?: string | null
          id?: string
          mes_override?: boolean
          organization_id?: string
          product_id?: string | null
          sku?: string
          status?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "routings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          reason?: string
          resolution_notes?: string | null
          station_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_holds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
          {
            foreignKeyName: "stations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          result?: string | null
          session_id?: string | null
          station_id?: string | null
          station_name?: string | null
          unit_uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          station_id?: string | null
          unit_event_id?: string | null
          unit_uid?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "unit_readings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
            foreignKeyName: "waste_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          code: string
          created_at?: string
          id?: string
          label: string
          organization_id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          created_at?: string
          id?: string
          label?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_reasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_centers: {
        Row: {
          created_at: string
          erp_id: string | null
          id: string
          kind: string
          line_id: string | null
          mes_override: boolean
          name: string
          organization_id: string
          station_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          erp_id?: string | null
          id: string
          kind?: string
          line_id?: string | null
          mes_override?: boolean
          name: string
          organization_id?: string
          station_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          erp_id?: string | null
          id?: string
          kind?: string
          line_id?: string | null
          mes_override?: boolean
          name?: string
          organization_id?: string
          station_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_centers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          ends_at: string | null
          id: string
          line_id: string
          operator: string | null
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
        Relationships: [
          {
            foreignKeyName: "work_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      stock_on_hand: {
        Row: {
          name: string | null
          organization_id: string | null
          qty: number | null
          sku: string | null
          uom: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_production_version: {
        Args: { _po_id: string; _version_id: string }
        Returns: undefined
      }
      assert_status_transition: {
        Args: { _entity: string; _from: string; _to: string }
        Returns: undefined
      }
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
      in_my_org: { Args: { _org: string }; Returns: boolean }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      scope_ancestors: {
        Args: { _id: string; _kind: string }
        Returns: {
          scope_id: string
          scope_kind: string
        }[]
      }
      user_orgs: {
        Args: { _user_id: string }
        Returns: {
          organization_id: string
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
