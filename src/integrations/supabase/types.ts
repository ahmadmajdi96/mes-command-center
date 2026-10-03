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
      approval_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decided_by_name: string | null
          decision_reason: string | null
          details: Json
          id: string
          kind: string
          organization_id: string
          ref_id: string
          ref_table: string
          requested_by: string | null
          requested_by_name: string | null
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decided_by_name?: string | null
          decision_reason?: string | null
          details?: Json
          id?: string
          kind: string
          organization_id: string
          ref_id: string
          ref_table: string
          requested_by?: string | null
          requested_by_name?: string | null
          status?: string
          summary: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decided_by_name?: string | null
          decision_reason?: string | null
          details?: Json
          id?: string
          kind?: string
          organization_id?: string
          ref_id?: string
          ref_table?: string
          requested_by?: string | null
          requested_by_name?: string | null
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      approval_settings: {
        Row: {
          organization_id: string
          require_release_approval: boolean
          scrap_limit: number
          updated_at: string
        }
        Insert: {
          organization_id: string
          require_release_approval?: boolean
          scrap_limit?: number
          updated_at?: string
        }
        Update: {
          organization_id?: string
          require_release_approval?: boolean
          scrap_limit?: number
          updated_at?: string
        }
        Relationships: []
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
          at?: string
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
      batch_links: {
        Row: {
          actor_name: string | null
          actor_user_id: string | null
          child_batch_id: string
          created_at: string
          id: string
          link_type: string
          organization_id: string
          parent_batch_id: string
          qty: number
          reason: string | null
        }
        Insert: {
          actor_name?: string | null
          actor_user_id?: string | null
          child_batch_id: string
          created_at?: string
          id?: string
          link_type: string
          organization_id: string
          parent_batch_id: string
          qty: number
          reason?: string | null
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string | null
          child_batch_id?: string
          created_at?: string
          id?: string
          link_type?: string
          organization_id?: string
          parent_batch_id?: string
          qty?: number
          reason?: string | null
        }
        Relationships: []
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
      e_signatures: {
        Row: {
          id: string
          meaning: string
          organization_id: string
          reason: string
          ref_id: string
          ref_table: string
          signed_at: string
          signer_email: string | null
          signer_id: string
          signer_name: string
        }
        Insert: {
          id?: string
          meaning: string
          organization_id: string
          reason: string
          ref_id: string
          ref_table: string
          signed_at?: string
          signer_email?: string | null
          signer_id: string
          signer_name: string
        }
        Update: {
          id?: string
          meaning?: string
          organization_id?: string
          reason?: string
          ref_id?: string
          ref_table?: string
          signed_at?: string
          signer_email?: string | null
          signer_id?: string
          signer_name?: string
        }
        Relationships: []
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
      inspection_plans: {
        Row: {
          active: boolean
          characteristics: Json
          created_at: string
          id: string
          name: string
          operation_name: string
          organization_id: string
          performed_by: string
          product_id: string | null
          sample_every: number | null
          sampling: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          characteristics?: Json
          created_at?: string
          id?: string
          name: string
          operation_name: string
          organization_id: string
          performed_by?: string
          product_id?: string | null
          sample_every?: number | null
          sampling?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          characteristics?: Json
          created_at?: string
          id?: string
          name?: string
          operation_name?: string
          organization_id?: string
          performed_by?: string
          product_id?: string | null
          sample_every?: number | null
          sampling?: string
          updated_at?: string
        }
        Relationships: []
      }
      inspection_results: {
        Row: {
          actor_user_id: string | null
          batch_id: string | null
          created_at: string
          failed_checks: string[]
          id: string
          inspector_name: string | null
          notes: string | null
          operation_id: string
          organization_id: string
          plan_id: string
          production_order_id: string
          result: string
          sample_no: number
          source: string
          values: Json
        }
        Insert: {
          actor_user_id?: string | null
          batch_id?: string | null
          created_at?: string
          failed_checks?: string[]
          id?: string
          inspector_name?: string | null
          notes?: string | null
          operation_id: string
          organization_id: string
          plan_id: string
          production_order_id: string
          result: string
          sample_no?: number
          source?: string
          values?: Json
        }
        Update: {
          actor_user_id?: string | null
          batch_id?: string | null
          created_at?: string
          failed_checks?: string[]
          id?: string
          inspector_name?: string | null
          notes?: string | null
          operation_id?: string
          organization_id?: string
          plan_id?: string
          production_order_id?: string
          result?: string
          sample_no?: number
          source?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "inspection_results_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "order_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_results_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "inspection_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      instruction_acks: {
        Row: {
          acked_by: string
          acked_by_name: string | null
          created_at: string
          id: string
          order_operation_id: string
          organization_id: string
          step_id: string
        }
        Insert: {
          acked_by?: string
          acked_by_name?: string | null
          created_at?: string
          id?: string
          order_operation_id: string
          organization_id: string
          step_id: string
        }
        Update: {
          acked_by?: string
          acked_by_name?: string | null
          created_at?: string
          id?: string
          order_operation_id?: string
          organization_id?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instruction_acks_order_operation_id_fkey"
            columns: ["order_operation_id"]
            isOneToOne: false
            referencedRelation: "order_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instruction_acks_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "instruction_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      instruction_steps: {
        Row: {
          body: string | null
          created_at: string
          id: string
          image_url: string | null
          operation_name: string
          organization_id: string
          product_id: string | null
          requires_ack: boolean
          step_no: number
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          operation_name: string
          organization_id: string
          product_id?: string | null
          requires_ack?: boolean
          step_no: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          operation_name?: string
          organization_id?: string
          product_id?: string | null
          requires_ack?: boolean
          step_no?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      machine_commands: {
        Row: {
          actor_name: string | null
          actor_user_id: string | null
          command: string
          completed_at: string | null
          created_at: string
          id: string
          machine_id: string
          organization_id: string
          params: Json
          production_order_id: string | null
          reason: string | null
          result: string | null
          status: string
        }
        Insert: {
          actor_name?: string | null
          actor_user_id?: string | null
          command: string
          completed_at?: string | null
          created_at?: string
          id?: string
          machine_id: string
          organization_id?: string
          params?: Json
          production_order_id?: string | null
          reason?: string | null
          result?: string | null
          status?: string
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string | null
          command?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          machine_id?: string
          organization_id?: string
          params?: Json
          production_order_id?: string | null
          reason?: string | null
          result?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_commands_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_commands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_readings: {
        Row: {
          actor_name: string | null
          actor_user_id: string | null
          created_at: string
          id: string
          in_limits: boolean | null
          machine_id: string
          organization_id: string
          production_order_id: string | null
          source: string
          station_id: string | null
          tag: string
          text_value: string | null
          unit: string | null
          unit_uid: string | null
          value: number | null
        }
        Insert: {
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          in_limits?: boolean | null
          machine_id: string
          organization_id?: string
          production_order_id?: string | null
          source?: string
          station_id?: string | null
          tag: string
          text_value?: string | null
          unit?: string | null
          unit_uid?: string | null
          value?: number | null
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          in_limits?: boolean | null
          machine_id?: string
          organization_id?: string
          production_order_id?: string | null
          source?: string
          station_id?: string | null
          tag?: string
          text_value?: string | null
          unit?: string | null
          unit_uid?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_readings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_readings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_safety_signoffs: {
        Row: {
          checklist: Json
          config_hash: string | null
          created_at: string
          decision: string
          id: string
          machine_id: string
          organization_id: string
          reason: string
          signed_by: string
          signed_by_name: string | null
          valid_until: string | null
        }
        Insert: {
          checklist?: Json
          config_hash?: string | null
          created_at?: string
          decision: string
          id?: string
          machine_id: string
          organization_id: string
          reason: string
          signed_by: string
          signed_by_name?: string | null
          valid_until?: string | null
        }
        Update: {
          checklist?: Json
          config_hash?: string | null
          created_at?: string
          decision?: string
          id?: string
          machine_id?: string
          organization_id?: string
          reason?: string
          signed_by?: string
          signed_by_name?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_safety_signoffs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_safety_signoffs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          commands: Json
          config_hash: string | null
          connection_mode: string
          created_at: string
          endpoint: string | null
          id: string
          last_seen_at: string | null
          model: string | null
          name: string
          notes: string | null
          organization_id: string
          protocol: string
          safety_signed_at: string | null
          safety_signed_by: string | null
          safety_status: string
          safety_valid_until: string | null
          station_id: string | null
          status: string
          tags: Json
          updated_at: string
          vendor: string | null
        }
        Insert: {
          commands?: Json
          config_hash?: string | null
          connection_mode?: string
          created_at?: string
          endpoint?: string | null
          id: string
          last_seen_at?: string | null
          model?: string | null
          name: string
          notes?: string | null
          organization_id?: string
          protocol: string
          safety_signed_at?: string | null
          safety_signed_by?: string | null
          safety_status?: string
          safety_valid_until?: string | null
          station_id?: string | null
          status?: string
          tags?: Json
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          commands?: Json
          config_hash?: string | null
          connection_mode?: string
          created_at?: string
          endpoint?: string | null
          id?: string
          last_seen_at?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          protocol?: string
          safety_signed_at?: string | null
          safety_signed_by?: string | null
          safety_status?: string
          safety_valid_until?: string | null
          station_id?: string | null
          status?: string
          tags?: Json
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
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
          lot_id: string | null
          notes: string | null
          operation_id: string | null
          organization_id: string
          planned_qty: number | null
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
          lot_id?: string | null
          notes?: string | null
          operation_id?: string | null
          organization_id?: string
          planned_qty?: number | null
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
          lot_id?: string | null
          notes?: string | null
          operation_id?: string | null
          organization_id?: string
          planned_qty?: number | null
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
            foreignKeyName: "material_consumptions_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "material_lots"
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
      material_lots: {
        Row: {
          actor_name: string | null
          actor_user_id: string | null
          created_at: string
          expiry_date: string | null
          id: string
          kind: string
          location_id: string | null
          lot_number: string
          name: string | null
          notes: string | null
          organization_id: string
          qty_received: number
          qty_remaining: number
          sku: string
          source_operation_id: string | null
          source_order_id: string | null
          source_receipt_id: string | null
          status: string
          supplier: string | null
          uom: string
          updated_at: string
        }
        Insert: {
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          kind?: string
          location_id?: string | null
          lot_number: string
          name?: string | null
          notes?: string | null
          organization_id: string
          qty_received: number
          qty_remaining: number
          sku: string
          source_operation_id?: string | null
          source_order_id?: string | null
          source_receipt_id?: string | null
          status?: string
          supplier?: string | null
          uom?: string
          updated_at?: string
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          kind?: string
          location_id?: string | null
          lot_number?: string
          name?: string | null
          notes?: string | null
          organization_id?: string
          qty_received?: number
          qty_remaining?: number
          sku?: string
          source_operation_id?: string | null
          source_order_id?: string | null
          source_receipt_id?: string | null
          status?: string
          supplier?: string | null
          uom?: string
          updated_at?: string
        }
        Relationships: []
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
      mock_portal_inbox: {
        Row: {
          connection_id: string
          created_at: string
          event_id: string | null
          event_type: string
          id: string
          organization_id: string
          payload: Json
          portal: string
          replied_at: string | null
          reply_event: string | null
          reply_outcome: string | null
          signature_ok: boolean
          status: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          event_id?: string | null
          event_type: string
          id?: string
          organization_id: string
          payload?: Json
          portal: string
          replied_at?: string | null
          reply_event?: string | null
          reply_outcome?: string | null
          signature_ok?: boolean
          status?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          event_id?: string | null
          event_type?: string
          id?: string
          organization_id?: string
          payload?: Json
          portal?: string
          replied_at?: string | null
          reply_event?: string | null
          reply_outcome?: string | null
          signature_ok?: boolean
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_portal_inbox_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "portal_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      nonconformances: {
        Row: {
          batch_id: string | null
          created_at: string
          decided_at: string | null
          decided_by_name: string | null
          decision: string | null
          decision_notes: string | null
          decision_source: string | null
          description: string
          id: string
          inspection_result_id: string | null
          operation_id: string | null
          organization_id: string
          production_order_id: string
          qty: number
          raised_by_name: string | null
          raised_by_user_id: string | null
          rework_task_id: string | null
          severity: string
          status: string
          uom: string | null
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by_name?: string | null
          decision?: string | null
          decision_notes?: string | null
          decision_source?: string | null
          description: string
          id?: string
          inspection_result_id?: string | null
          operation_id?: string | null
          organization_id: string
          production_order_id: string
          qty?: number
          raised_by_name?: string | null
          raised_by_user_id?: string | null
          rework_task_id?: string | null
          severity?: string
          status?: string
          uom?: string | null
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by_name?: string | null
          decision?: string | null
          decision_notes?: string | null
          decision_source?: string | null
          description?: string
          id?: string
          inspection_result_id?: string | null
          operation_id?: string | null
          organization_id?: string
          production_order_id?: string
          qty?: number
          raised_by_name?: string | null
          raised_by_user_id?: string | null
          rework_task_id?: string | null
          severity?: string
          status?: string
          uom?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nonconformances_inspection_result_id_fkey"
            columns: ["inspection_result_id"]
            isOneToOne: false
            referencedRelation: "inspection_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nonconformances_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "order_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          enabled: boolean
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          enabled?: boolean
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          enabled?: boolean
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          organization_id: string | null
          read_at: string | null
          severity: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          organization_id?: string | null
          read_at?: string | null
          severity?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          organization_id?: string | null
          read_at?: string | null
          severity?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      operation_events: {
        Row: {
          actor_name: string | null
          actor_user_id: string | null
          at: string
          event_type: string
          id: string
          operation_id: string
          organization_id: string
          payload: Json
          production_order_id: string
          reason: string | null
        }
        Insert: {
          actor_name?: string | null
          actor_user_id?: string | null
          at?: string
          event_type: string
          id?: string
          operation_id: string
          organization_id?: string
          payload?: Json
          production_order_id: string
          reason?: string | null
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string | null
          at?: string
          event_type?: string
          id?: string
          operation_id?: string
          organization_id?: string
          payload?: Json
          production_order_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operation_events_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "order_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_events_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_skills: {
        Row: {
          certificate_ref: string | null
          certified_at: string
          certified_by_name: string | null
          created_at: string
          expires_at: string | null
          id: string
          level: string
          mes_user_id: string
          organization_id: string
          skill_id: string
          updated_at: string
        }
        Insert: {
          certificate_ref?: string | null
          certified_at?: string
          certified_by_name?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          level?: string
          mes_user_id: string
          organization_id: string
          skill_id: string
          updated_at?: string
        }
        Update: {
          certificate_ref?: string | null
          certified_at?: string
          certified_by_name?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          level?: string
          mes_user_id?: string
          organization_id?: string
          skill_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_skills_mes_user_id_fkey"
            columns: ["mes_user_id"]
            isOneToOne: false
            referencedRelation: "mes_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
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
      order_holds: {
        Row: {
          comments: string | null
          created_at: string
          hold_type: string
          id: string
          opened_at: string
          opened_by_name: string | null
          opened_by_user_id: string | null
          organization_id: string
          prev_status: string | null
          production_order_id: string
          reason: string
          release_comments: string | null
          released_at: string | null
          released_by_name: string | null
          released_by_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          hold_type?: string
          id?: string
          opened_at?: string
          opened_by_name?: string | null
          opened_by_user_id?: string | null
          organization_id?: string
          prev_status?: string | null
          production_order_id: string
          reason: string
          release_comments?: string | null
          released_at?: string | null
          released_by_name?: string | null
          released_by_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          hold_type?: string
          id?: string
          opened_at?: string
          opened_by_name?: string | null
          opened_by_user_id?: string | null
          organization_id?: string
          prev_status?: string | null
          production_order_id?: string
          reason?: string
          release_comments?: string | null
          released_at?: string | null
          released_by_name?: string | null
          released_by_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_holds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_holds_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_operations: {
        Row: {
          actual_downtime_min: number | null
          actual_duration_min: number | null
          actual_processing_min: number | null
          actual_setup_min: number | null
          actual_waiting_min: number | null
          approval_comment: string | null
          approved_at: string | null
          approved_by_name: string | null
          approved_by_user_id: string | null
          batch_id: string | null
          completed_at: string | null
          completed_by: string | null
          completion_notes: string | null
          completion_reason: string | null
          created_at: string
          hold_category: string | null
          id: string
          machine_id: string | null
          name: string
          organization_id: string
          parameters: Json
          production_order_id: string
          qty_input: number
          qty_processed: number
          qty_rejected: number
          qty_scrap: number
          qty_yield: number
          required_fields: string[]
          requires_approval: boolean
          run_min_per_unit: number
          sequence: number
          setup_completed_at: string | null
          setup_min: number
          setup_started_at: string | null
          started_at: string | null
          started_by: string | null
          started_by_user_id: string | null
          station_id: string | null
          status: string
          status_reason: string | null
          updated_at: string
          work_center_id: string | null
          work_instructions: string | null
        }
        Insert: {
          actual_downtime_min?: number | null
          actual_duration_min?: number | null
          actual_processing_min?: number | null
          actual_setup_min?: number | null
          actual_waiting_min?: number | null
          approval_comment?: string | null
          approved_at?: string | null
          approved_by_name?: string | null
          approved_by_user_id?: string | null
          batch_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          completion_reason?: string | null
          created_at?: string
          hold_category?: string | null
          id?: string
          machine_id?: string | null
          name: string
          organization_id?: string
          parameters?: Json
          production_order_id: string
          qty_input?: number
          qty_processed?: number
          qty_rejected?: number
          qty_scrap?: number
          qty_yield?: number
          required_fields?: string[]
          requires_approval?: boolean
          run_min_per_unit?: number
          sequence: number
          setup_completed_at?: string | null
          setup_min?: number
          setup_started_at?: string | null
          started_at?: string | null
          started_by?: string | null
          started_by_user_id?: string | null
          station_id?: string | null
          status?: string
          status_reason?: string | null
          updated_at?: string
          work_center_id?: string | null
          work_instructions?: string | null
        }
        Update: {
          actual_downtime_min?: number | null
          actual_duration_min?: number | null
          actual_processing_min?: number | null
          actual_setup_min?: number | null
          actual_waiting_min?: number | null
          approval_comment?: string | null
          approved_at?: string | null
          approved_by_name?: string | null
          approved_by_user_id?: string | null
          batch_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          completion_reason?: string | null
          created_at?: string
          hold_category?: string | null
          id?: string
          machine_id?: string | null
          name?: string
          organization_id?: string
          parameters?: Json
          production_order_id?: string
          qty_input?: number
          qty_processed?: number
          qty_rejected?: number
          qty_scrap?: number
          qty_yield?: number
          required_fields?: string[]
          requires_approval?: boolean
          run_min_per_unit?: number
          sequence?: number
          setup_completed_at?: string | null
          setup_min?: number
          setup_started_at?: string | null
          started_at?: string | null
          started_by?: string | null
          started_by_user_id?: string | null
          station_id?: string | null
          status?: string
          status_reason?: string | null
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
          category: string | null
          created_at: string
          description: string
          key: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description: string
          key: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          key?: string
        }
        Relationships: []
      }
      portal_connections: {
        Row: {
          active: boolean
          created_at: string
          id: string
          last_received_at: string | null
          last_sent_at: string | null
          name: string
          organization_id: string
          outbound_url: string | null
          portal: string
          shared_secret: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          last_received_at?: string | null
          last_sent_at?: string | null
          name: string
          organization_id: string
          outbound_url?: string | null
          portal: string
          shared_secret: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          last_received_at?: string | null
          last_sent_at?: string | null
          name?: string
          organization_id?: string
          outbound_url?: string | null
          portal?: string
          shared_secret?: string
          updated_at?: string
        }
        Relationships: []
      }
      portal_events: {
        Row: {
          attempts: number
          connection_id: string | null
          created_at: string
          direction: string
          event_type: string
          id: string
          last_error: string | null
          organization_id: string
          payload: Json
          portal: string
          processed_at: string | null
          ref_id: string | null
          ref_table: string | null
          status: string
        }
        Insert: {
          attempts?: number
          connection_id?: string | null
          created_at?: string
          direction: string
          event_type: string
          id?: string
          last_error?: string | null
          organization_id: string
          payload?: Json
          portal: string
          processed_at?: string | null
          ref_id?: string | null
          ref_table?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          connection_id?: string | null
          created_at?: string
          direction?: string
          event_type?: string
          id?: string
          last_error?: string | null
          organization_id?: string
          payload?: Json
          portal?: string
          processed_at?: string | null
          ref_id?: string | null
          ref_table?: string | null
          status?: string
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
          located_at: string | null
          location_id: string | null
          lot_number: string
          merged_into: string | null
          notes: string | null
          number: string
          operator: string | null
          organization_id: string
          parent_batch_id: string | null
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
          located_at?: string | null
          location_id?: string | null
          lot_number: string
          merged_into?: string | null
          notes?: string | null
          number: string
          operator?: string | null
          organization_id?: string
          parent_batch_id?: string | null
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
          located_at?: string | null
          location_id?: string | null
          lot_number?: string
          merged_into?: string | null
          notes?: string | null
          number?: string
          operator?: string | null
          organization_id?: string
          parent_batch_id?: string | null
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
            foreignKeyName: "production_batches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "wip_locations"
            referencedColumns: ["id"]
          },
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
          completion_reason: string | null
          correlation_id: string | null
          created_at: string
          final: boolean
          id: string
          notes: string | null
          operation_id: string | null
          organization_id: string
          post_goods_receipt: boolean
          production_order_id: string
          qty_input: number | null
          qty_produced: number | null
          qty_rejected: number
          qty_scrap: number
          qty_yield: number
          reject_reason: string | null
          scrap_reason: string | null
        }
        Insert: {
          actor_name?: string | null
          actor_user_id?: string | null
          batch_id?: string | null
          completion_reason?: string | null
          correlation_id?: string | null
          created_at?: string
          final?: boolean
          id?: string
          notes?: string | null
          operation_id?: string | null
          organization_id?: string
          post_goods_receipt?: boolean
          production_order_id: string
          qty_input?: number | null
          qty_produced?: number | null
          qty_rejected?: number
          qty_scrap?: number
          qty_yield?: number
          reject_reason?: string | null
          scrap_reason?: string | null
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string | null
          batch_id?: string | null
          completion_reason?: string | null
          correlation_id?: string | null
          created_at?: string
          final?: boolean
          id?: string
          notes?: string | null
          operation_id?: string | null
          organization_id?: string
          post_goods_receipt?: boolean
          production_order_id?: string
          qty_input?: number | null
          qty_produced?: number | null
          qty_rejected?: number
          qty_scrap?: number
          qty_yield?: number
          reject_reason?: string | null
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
      production_exceptions: {
        Row: {
          blocks_execution: boolean
          created_at: string
          description: string
          ended_at: string | null
          exception_type: string
          id: string
          line_id: string | null
          machine_id: string | null
          operation_id: string | null
          operator_name: string | null
          operator_user_id: string | null
          organization_id: string
          production_order_id: string | null
          reason_code: string | null
          resolution: string | null
          resolved_by_name: string | null
          resolved_by_user_id: string | null
          resource: string | null
          severity: string
          started_at: string
          station_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          blocks_execution?: boolean
          created_at?: string
          description: string
          ended_at?: string | null
          exception_type: string
          id?: string
          line_id?: string | null
          machine_id?: string | null
          operation_id?: string | null
          operator_name?: string | null
          operator_user_id?: string | null
          organization_id?: string
          production_order_id?: string | null
          reason_code?: string | null
          resolution?: string | null
          resolved_by_name?: string | null
          resolved_by_user_id?: string | null
          resource?: string | null
          severity?: string
          started_at?: string
          station_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          blocks_execution?: boolean
          created_at?: string
          description?: string
          ended_at?: string | null
          exception_type?: string
          id?: string
          line_id?: string | null
          machine_id?: string | null
          operation_id?: string | null
          operator_name?: string | null
          operator_user_id?: string | null
          organization_id?: string
          production_order_id?: string | null
          reason_code?: string | null
          resolution?: string | null
          resolved_by_name?: string | null
          resolved_by_user_id?: string | null
          resource?: string | null
          severity?: string
          started_at?: string
          station_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_exceptions_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "order_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_exceptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_exceptions_production_order_id_fkey"
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
      rework_tasks: {
        Row: {
          assigned_to: string | null
          attempts: number
          batch_id: string | null
          completed_at: string | null
          created_at: string
          created_by_name: string | null
          created_by_user_id: string | null
          id: string
          inspected_at: string | null
          inspection_notes: string | null
          inspection_result: string | null
          inspection_source: string | null
          inspector_name: string | null
          instructions: string | null
          operation_id: string | null
          organization_id: string
          production_order_id: string
          qty: number
          reason: string
          status: string
          uom: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attempts?: number
          batch_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_name?: string | null
          created_by_user_id?: string | null
          id?: string
          inspected_at?: string | null
          inspection_notes?: string | null
          inspection_result?: string | null
          inspection_source?: string | null
          inspector_name?: string | null
          instructions?: string | null
          operation_id?: string | null
          organization_id: string
          production_order_id: string
          qty: number
          reason: string
          status?: string
          uom?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attempts?: number
          batch_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_name?: string | null
          created_by_user_id?: string | null
          id?: string
          inspected_at?: string | null
          inspection_notes?: string | null
          inspection_result?: string | null
          inspection_source?: string | null
          inspector_name?: string | null
          instructions?: string | null
          operation_id?: string | null
          organization_id?: string
          production_order_id?: string
          qty?: number
          reason?: string
          status?: string
          uom?: string | null
          updated_at?: string
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
          color: string | null
          created_at: string
          description: string | null
          is_system: boolean
          key: string
          label: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          is_system?: boolean
          key: string
          label: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          is_system?: boolean
          key?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      routing_operations: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          required_fields: string[]
          requires_approval: boolean
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
          required_fields?: string[]
          requires_approval?: boolean
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
          required_fields?: string[]
          requires_approval?: boolean
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
      routing_rule_hits: {
        Row: {
          action: string
          created_at: string
          detail: string | null
          id: string
          operation_id: string | null
          organization_id: string
          production_order_id: string
          rule_id: string
        }
        Insert: {
          action: string
          created_at?: string
          detail?: string | null
          id?: string
          operation_id?: string | null
          organization_id: string
          production_order_id: string
          rule_id: string
        }
        Update: {
          action?: string
          created_at?: string
          detail?: string | null
          id?: string
          operation_id?: string | null
          organization_id?: string
          production_order_id?: string
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routing_rule_hits_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "routing_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      routing_rules: {
        Row: {
          action: string
          active: boolean
          created_at: string
          id: string
          max_value: number | null
          min_value: number | null
          name: string
          notes: string | null
          operation_name: string | null
          organization_id: string
          parameter: string | null
          priority: number
          product_id: string | null
          target_operation_name: string | null
          trigger_kind: string
          updated_at: string
        }
        Insert: {
          action: string
          active?: boolean
          created_at?: string
          id?: string
          max_value?: number | null
          min_value?: number | null
          name: string
          notes?: string | null
          operation_name?: string | null
          organization_id: string
          parameter?: string | null
          priority?: number
          product_id?: string | null
          target_operation_name?: string | null
          trigger_kind: string
          updated_at?: string
        }
        Update: {
          action?: string
          active?: boolean
          created_at?: string
          id?: string
          max_value?: number | null
          min_value?: number | null
          name?: string
          notes?: string | null
          operation_name?: string | null
          organization_id?: string
          parameter?: string | null
          priority?: number
          product_id?: string | null
          target_operation_name?: string | null
          trigger_kind?: string
          updated_at?: string
        }
        Relationships: []
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
      shift_plans: {
        Row: {
          data: Json
          key: string
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          data?: Json
          key: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          data?: Json
          key?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
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
      skill_requirements: {
        Row: {
          created_at: string
          id: string
          operation_name: string
          organization_id: string
          product_id: string | null
          skill_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation_name: string
          organization_id: string
          product_id?: string | null
          skill_id: string
        }
        Update: {
          created_at?: string
          id?: string
          operation_name?: string
          organization_id?: string
          product_id?: string | null
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_requirements_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
          validity_months: number | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
          validity_months?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
          validity_months?: number | null
        }
        Relationships: []
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
      tool_usages: {
        Row: {
          created_at: string
          id: string
          order_operation_id: string | null
          organization_id: string
          tool_id: string
          used_by: string | null
          used_by_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_operation_id?: string | null
          organization_id: string
          tool_id: string
          used_by?: string | null
          used_by_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_operation_id?: string | null
          organization_id?: string
          tool_id?: string
          used_by?: string | null
          used_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_usages_order_operation_id_fkey"
            columns: ["order_operation_id"]
            isOneToOne: false
            referencedRelation: "order_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_usages_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["id"]
          },
        ]
      }
      tools: {
        Row: {
          calibration_due: string | null
          code: string
          created_at: string
          id: string
          kind: string
          max_uses: number | null
          name: string
          notes: string | null
          organization_id: string
          station_id: string | null
          status: string
          updated_at: string
          uses: number
        }
        Insert: {
          calibration_due?: string | null
          code: string
          created_at?: string
          id?: string
          kind?: string
          max_uses?: number | null
          name: string
          notes?: string | null
          organization_id: string
          station_id?: string | null
          status?: string
          updated_at?: string
          uses?: number
        }
        Update: {
          calibration_due?: string | null
          code?: string
          created_at?: string
          id?: string
          kind?: string
          max_uses?: number | null
          name?: string
          notes?: string | null
          organization_id?: string
          station_id?: string | null
          status?: string
          updated_at?: string
          uses?: number
        }
        Relationships: []
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
          kind: string
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
          kind?: string
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
          kind?: string
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
      wip_counts: {
        Row: {
          actor_name: string | null
          actor_user_id: string | null
          batch_id: string
          counted_qty: number
          created_at: string
          expected_qty: number
          id: string
          location_id: string
          organization_id: string
          reason: string | null
          variance: number | null
        }
        Insert: {
          actor_name?: string | null
          actor_user_id?: string | null
          batch_id: string
          counted_qty: number
          created_at?: string
          expected_qty: number
          id?: string
          location_id: string
          organization_id: string
          reason?: string | null
          variance?: number | null
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string | null
          batch_id?: string
          counted_qty?: number
          created_at?: string
          expected_qty?: number
          id?: string
          location_id?: string
          organization_id?: string
          reason?: string | null
          variance?: number | null
        }
        Relationships: []
      }
      wip_locations: {
        Row: {
          active: boolean
          aging_limit_hours: number
          created_at: string
          id: string
          kind: string
          line_id: string | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          aging_limit_hours?: number
          created_at?: string
          id: string
          kind?: string
          line_id?: string | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          aging_limit_hours?: number
          created_at?: string
          id?: string
          kind?: string
          line_id?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      wip_moves: {
        Row: {
          actor_name: string | null
          actor_user_id: string | null
          batch_id: string
          created_at: string
          from_location_id: string | null
          id: string
          organization_id: string
          qty: number | null
          reason: string | null
          to_location_id: string
        }
        Insert: {
          actor_name?: string | null
          actor_user_id?: string | null
          batch_id: string
          created_at?: string
          from_location_id?: string | null
          id?: string
          organization_id: string
          qty?: number | null
          reason?: string | null
          to_location_id: string
        }
        Update: {
          actor_name?: string | null
          actor_user_id?: string | null
          batch_id?: string
          created_at?: string
          from_location_id?: string | null
          id?: string
          organization_id?: string
          qty?: number | null
          reason?: string | null
          to_location_id?: string
        }
        Relationships: []
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
      lot_genealogy: {
        Row: {
          input_lot: string | null
          input_lot_id: string | null
          input_sku: string | null
          organization_id: string | null
          output_lot: string | null
          output_name: string | null
          output_sku: string | null
          production_order_id: string | null
          qty_used: number | null
          uom: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_consumptions_lot_id_fkey"
            columns: ["input_lot_id"]
            isOneToOne: false
            referencedRelation: "material_lots"
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
      actor_name: { Args: never; Returns: string }
      apply_production_version: {
        Args: { _po_id: string; _version_id: string }
        Returns: undefined
      }
      assert_status_transition: {
        Args: { _entity: string; _from: string; _to: string }
        Returns: undefined
      }
      can_admin_users: { Args: { _user_id: string }; Returns: boolean }
      enqueue_portal_event: {
        Args: {
          _org: string
          _payload: Json
          _portal: string
          _ref_id: string
          _ref_table: string
          _type: string
        }
        Returns: undefined
      }
      has_action: {
        Args: { _action: string; _user_id: string }
        Returns: boolean
      }
      has_approval: {
        Args: { _kind: string; _min_qty?: number; _ref: string }
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
      merge_batches: {
        Args: { _reason: string; _sources: string[]; _target: string }
        Returns: undefined
      }
      move_batch: {
        Args: { _batch_id: string; _reason: string; _to: string }
        Returns: undefined
      }
      notify_user: {
        Args: {
          _link: string
          _msg: string
          _org: string
          _sev: string
          _title: string
          _type: string
          _uid: string
        }
        Returns: undefined
      }
      notify_users: {
        Args: {
          _action: string
          _exclude?: string
          _link: string
          _msg: string
          _org: string
          _sev: string
          _title: string
          _type: string
        }
        Returns: undefined
      }
      operation_block_reason: {
        Args: { _check_sequence: boolean; _op_id: string }
        Returns: string
      }
      operation_hold_minutes: {
        Args: { _op_id: string; _until: string }
        Returns: Record<string, unknown>
      }
      operation_missing_skills: {
        Args: { _op_id: string; _user_id: string }
        Returns: string[]
      }
      order_release_check: { Args: { _po_id: string }; Returns: Json }
      scope_ancestors: {
        Args: { _id: string; _kind: string }
        Returns: {
          scope_id: string
          scope_kind: string
        }[]
      }
      split_batch: {
        Args: { _batch_id: string; _qty: number; _reason: string }
        Returns: string
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
