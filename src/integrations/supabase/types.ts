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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      action_point_reminders_sent: {
        Row: {
          action_point_id: string
          error: string | null
          id: string
          recipient_email: string
          reminder_type: string
          sent_at: string
          success: boolean
        }
        Insert: {
          action_point_id: string
          error?: string | null
          id?: string
          recipient_email: string
          reminder_type: string
          sent_at?: string
          success?: boolean
        }
        Update: {
          action_point_id?: string
          error?: string | null
          id?: string
          recipient_email?: string
          reminder_type?: string
          sent_at?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "action_point_reminders_sent_action_point_id_fkey"
            columns: ["action_point_id"]
            isOneToOne: false
            referencedRelation: "briefing_action_points"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      ad_config: {
        Row: {
          base_dn: string
          bind_password_set: boolean
          bind_username: string
          connection_checked_at: string | null
          connection_status: string
          created_at: string
          default_role: Database["public"]["Enums"]["app_role"]
          domain_name: string
          enabled: boolean
          group_mapping_enabled: boolean
          groups_search_base: string
          id: boolean
          last_successful_sync_at: string | null
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          ldap_host: string
          ldap_port: number
          ldaps_port: number
          ssl_enabled: boolean
          sync_interval: string
          updated_at: string
          updated_by: string | null
          users_search_base: string
          validate_certificate: boolean
        }
        Insert: {
          base_dn?: string
          bind_password_set?: boolean
          bind_username?: string
          connection_checked_at?: string | null
          connection_status?: string
          created_at?: string
          default_role?: Database["public"]["Enums"]["app_role"]
          domain_name?: string
          enabled?: boolean
          group_mapping_enabled?: boolean
          groups_search_base?: string
          id?: boolean
          last_successful_sync_at?: string | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          ldap_host?: string
          ldap_port?: number
          ldaps_port?: number
          ssl_enabled?: boolean
          sync_interval?: string
          updated_at?: string
          updated_by?: string | null
          users_search_base?: string
          validate_certificate?: boolean
        }
        Update: {
          base_dn?: string
          bind_password_set?: boolean
          bind_username?: string
          connection_checked_at?: string | null
          connection_status?: string
          created_at?: string
          default_role?: Database["public"]["Enums"]["app_role"]
          domain_name?: string
          enabled?: boolean
          group_mapping_enabled?: boolean
          groups_search_base?: string
          id?: boolean
          last_successful_sync_at?: string | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          ldap_host?: string
          ldap_port?: number
          ldaps_port?: number
          ssl_enabled?: boolean
          sync_interval?: string
          updated_at?: string
          updated_by?: string | null
          users_search_base?: string
          validate_certificate?: boolean
        }
        Relationships: []
      }
      ad_group_mappings: {
        Row: {
          ad_group: string
          created_at: string
          id: string
          priority: number
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          ad_group: string
          created_at?: string
          id?: string
          priority?: number
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          ad_group?: string
          created_at?: string
          id?: string
          priority?: number
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      ad_sync_runs: {
        Row: {
          departments_created: number
          error_count: number
          errors: Json
          finished_at: string | null
          id: string
          roles_applied: number
          started_at: string
          status: string
          trigger_source: string
          triggered_by: string | null
          users_created: number
          users_disabled: number
          users_found: number
          users_updated: number
        }
        Insert: {
          departments_created?: number
          error_count?: number
          errors?: Json
          finished_at?: string | null
          id?: string
          roles_applied?: number
          started_at?: string
          status?: string
          trigger_source?: string
          triggered_by?: string | null
          users_created?: number
          users_disabled?: number
          users_found?: number
          users_updated?: number
        }
        Update: {
          departments_created?: number
          error_count?: number
          errors?: Json
          finished_at?: string | null
          id?: string
          roles_applied?: number
          started_at?: string
          status?: string
          trigger_source?: string
          triggered_by?: string | null
          users_created?: number
          users_disabled?: number
          users_found?: number
          users_updated?: number
        }
        Relationships: []
      }
      asset_movements: {
        Row: {
          asset_id: string
          from_location_id: string | null
          from_user_id: string | null
          id: string
          moved_at: string
          moved_by: string | null
          notes: string | null
          to_location_id: string | null
          to_user_id: string | null
        }
        Insert: {
          asset_id: string
          from_location_id?: string | null
          from_user_id?: string | null
          id?: string
          moved_at?: string
          moved_by?: string | null
          notes?: string | null
          to_location_id?: string | null
          to_user_id?: string | null
        }
        Update: {
          asset_id?: string
          from_location_id?: string | null
          from_user_id?: string | null
          id?: string
          moved_at?: string
          moved_by?: string | null
          notes?: string | null
          to_location_id?: string | null
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_movements_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          ad_computer_name: string | null
          asset_tag: string
          asset_type: Database["public"]["Enums"]["asset_type"]
          assigned_user_id: string | null
          barcode: string | null
          cpu: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          gpu: string | null
          hostname: string | null
          id: string
          invoice_number: string | null
          ip_address: string | null
          location_id: string | null
          location_text: string | null
          mac_address: string | null
          manufacturer: string | null
          model: string | null
          notes: string | null
          office_version: string | null
          operating_system: string | null
          purchase_cost: number | null
          purchase_date: string | null
          qr_code: string | null
          ram: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["asset_status"]
          storage: string | null
          updated_at: string
          vendor: string | null
          warranty_end: string | null
          warranty_start: string | null
          windows_version: string | null
        }
        Insert: {
          ad_computer_name?: string | null
          asset_tag?: string
          asset_type: Database["public"]["Enums"]["asset_type"]
          assigned_user_id?: string | null
          barcode?: string | null
          cpu?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          gpu?: string | null
          hostname?: string | null
          id?: string
          invoice_number?: string | null
          ip_address?: string | null
          location_id?: string | null
          location_text?: string | null
          mac_address?: string | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          office_version?: string | null
          operating_system?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          qr_code?: string | null
          ram?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          storage?: string | null
          updated_at?: string
          vendor?: string | null
          warranty_end?: string | null
          warranty_start?: string | null
          windows_version?: string | null
        }
        Update: {
          ad_computer_name?: string | null
          asset_tag?: string
          asset_type?: Database["public"]["Enums"]["asset_type"]
          assigned_user_id?: string | null
          barcode?: string | null
          cpu?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          gpu?: string | null
          hostname?: string | null
          id?: string
          invoice_number?: string | null
          ip_address?: string | null
          location_id?: string | null
          location_text?: string | null
          mac_address?: string | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          office_version?: string | null
          operating_system?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          qr_code?: string | null
          ram?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          storage?: string | null
          updated_at?: string
          vendor?: string | null
          warranty_end?: string | null
          warranty_start?: string | null
          windows_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      auth_audit_log: {
        Row: {
          created_at: string
          event: string
          id: string
          ip_address: string | null
          reason: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
          username: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          ip_address?: string | null
          reason?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
          username: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          ip_address?: string | null
          reason?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
      briefing_action_points: {
        Row: {
          action_number: string
          allowed_time: Database["public"]["Enums"]["allowed_time_option"]
          assigned_at: string
          briefing_id: string
          comments: string | null
          completed_at: string | null
          completed_by: string | null
          completion_notes: string | null
          created_at: string
          created_by: string | null
          custom_minutes: number | null
          department_id: string | null
          description: string
          due_at: string
          id: string
          point_number: number | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          reminder_minutes_before: number
          responsible_id: string | null
          status: Database["public"]["Enums"]["action_status"]
          updated_at: string
        }
        Insert: {
          action_number?: string
          allowed_time?: Database["public"]["Enums"]["allowed_time_option"]
          assigned_at?: string
          briefing_id: string
          comments?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          custom_minutes?: number | null
          department_id?: string | null
          description: string
          due_at: string
          id?: string
          point_number?: number | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          reminder_minutes_before?: number
          responsible_id?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
        }
        Update: {
          action_number?: string
          allowed_time?: Database["public"]["Enums"]["allowed_time_option"]
          assigned_at?: string
          briefing_id?: string
          comments?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          custom_minutes?: number | null
          department_id?: string | null
          description?: string
          due_at?: string
          id?: string
          point_number?: number | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          reminder_minutes_before?: number
          responsible_id?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefing_action_points_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "briefings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefing_action_points_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_departments: {
        Row: {
          briefing_id: string
          department_id: string
        }
        Insert: {
          briefing_id: string
          department_id: string
        }
        Update: {
          briefing_id?: string
          department_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefing_departments_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "briefings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefing_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_participants: {
        Row: {
          briefing_id: string
          user_id: string
        }
        Insert: {
          briefing_id: string
          user_id: string
        }
        Update: {
          briefing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefing_participants_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "briefings"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_rooms: {
        Row: {
          breakfast_pax_tomorrow: number
          briefing_id: string
          created_at: string
          created_by: string | null
          duty_manager_id: string | null
          id: string
          occupancy_mtd: number
          occupancy_rate_today: number
          occupancy_today: number
          updated_at: string
          updated_by: string | null
          vip0_rooms: number
          vip1_rooms: number
          vip2_rooms: number
          vip3_rooms: number
        }
        Insert: {
          breakfast_pax_tomorrow?: number
          briefing_id: string
          created_at?: string
          created_by?: string | null
          duty_manager_id?: string | null
          id?: string
          occupancy_mtd?: number
          occupancy_rate_today?: number
          occupancy_today?: number
          updated_at?: string
          updated_by?: string | null
          vip0_rooms?: number
          vip1_rooms?: number
          vip2_rooms?: number
          vip3_rooms?: number
        }
        Update: {
          breakfast_pax_tomorrow?: number
          briefing_id?: string
          created_at?: string
          created_by?: string | null
          duty_manager_id?: string | null
          id?: string
          occupancy_mtd?: number
          occupancy_rate_today?: number
          occupancy_today?: number
          updated_at?: string
          updated_by?: string | null
          vip0_rooms?: number
          vip1_rooms?: number
          vip2_rooms?: number
          vip3_rooms?: number
        }
        Relationships: [
          {
            foreignKeyName: "briefing_rooms_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: true
            referencedRelation: "briefings"
            referencedColumns: ["id"]
          },
        ]
      }
      briefings: {
        Row: {
          briefing_date: string
          briefing_number: string
          created_at: string
          created_by: string | null
          discussion_points: string | null
          end_time: string | null
          general_notes: string | null
          id: string
          location: string | null
          meeting_type: Database["public"]["Enums"]["briefing_type"]
          organizer_id: string | null
          start_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          briefing_date?: string
          briefing_number?: string
          created_at?: string
          created_by?: string | null
          discussion_points?: string | null
          end_time?: string | null
          general_notes?: string | null
          id?: string
          location?: string | null
          meeting_type?: Database["public"]["Enums"]["briefing_type"]
          organizer_id?: string | null
          start_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          briefing_date?: string
          briefing_number?: string
          created_at?: string
          created_by?: string | null
          discussion_points?: string | null
          end_time?: string | null
          general_notes?: string | null
          id?: string
          location?: string | null
          meeting_type?: Database["public"]["Enums"]["briefing_type"]
          organizer_id?: string | null
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string | null
          created_at: string
          id: string
          manager_id: string | null
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          manager_id?: string | null
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          manager_id?: string | null
          name?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          building: string
          created_at: string
          floor: string | null
          id: string
          notes: string | null
          room: string | null
        }
        Insert: {
          building: string
          created_at?: string
          floor?: string | null
          id?: string
          notes?: string | null
          room?: string | null
        }
        Update: {
          building?: string
          created_at?: string
          floor?: string | null
          id?: string
          notes?: string | null
          room?: string | null
        }
        Relationships: []
      }
      network_devices: {
        Row: {
          config_backup_url: string | null
          created_at: string
          device_type: string
          firmware: string | null
          id: string
          ip_address: string | null
          location_id: string | null
          mac_address: string | null
          manufacturer: string | null
          model: string | null
          name: string
          notes: string | null
          rack: string | null
          serial_number: string | null
          support_info: string | null
          updated_at: string
          warranty_end: string | null
        }
        Insert: {
          config_backup_url?: string | null
          created_at?: string
          device_type: string
          firmware?: string | null
          id?: string
          ip_address?: string | null
          location_id?: string | null
          mac_address?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          notes?: string | null
          rack?: string | null
          serial_number?: string | null
          support_info?: string | null
          updated_at?: string
          warranty_end?: string | null
        }
        Update: {
          config_backup_url?: string | null
          created_at?: string
          device_type?: string
          firmware?: string | null
          id?: string
          ip_address?: string | null
          location_id?: string | null
          mac_address?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          rack?: string | null
          serial_number?: string | null
          support_info?: string | null
          updated_at?: string
          warranty_end?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "network_devices_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email_pm_reminders: boolean
          email_ticket_updates: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_pm_reminders?: boolean
          email_ticket_updates?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_pm_reminders?: boolean
          email_ticket_updates?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pm_reminders_sent: {
        Row: {
          error: string | null
          id: string
          recipient_email: string
          reminder_type: string
          sent_at: string
          success: boolean
          task_id: string
        }
        Insert: {
          error?: string | null
          id?: string
          recipient_email: string
          reminder_type: string
          sent_at?: string
          success?: boolean
          task_id: string
        }
        Update: {
          error?: string | null
          id?: string
          recipient_email?: string
          reminder_type?: string
          sent_at?: string
          success?: boolean
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_reminders_sent_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_schedules: {
        Row: {
          active: boolean
          assigned_to: string | null
          checklist: Json
          created_at: string
          created_by: string | null
          description: string | null
          frequency: Database["public"]["Enums"]["pm_frequency"]
          id: string
          interval_days: number | null
          last_completed: string | null
          next_due: string
          reminder_days_before: number
          target_id: string
          target_type: Database["public"]["Enums"]["pm_target"]
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          assigned_to?: string | null
          checklist?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency: Database["public"]["Enums"]["pm_frequency"]
          id?: string
          interval_days?: number | null
          last_completed?: string | null
          next_due: string
          reminder_days_before?: number
          target_id: string
          target_type: Database["public"]["Enums"]["pm_target"]
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          assigned_to?: string | null
          checklist?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency?: Database["public"]["Enums"]["pm_frequency"]
          id?: string
          interval_days?: number | null
          last_completed?: string | null
          next_due?: string
          reminder_days_before?: number
          target_id?: string
          target_type?: Database["public"]["Enums"]["pm_target"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      pm_tasks: {
        Row: {
          assigned_to: string | null
          checklist: Json
          completed_at: string | null
          completed_by: string | null
          completion_notes: string | null
          created_at: string
          due_date: string
          id: string
          schedule_id: string | null
          status: Database["public"]["Enums"]["pm_task_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["pm_target"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          checklist?: Json
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          created_at?: string
          due_date: string
          id?: string
          schedule_id?: string | null
          status?: Database["public"]["Enums"]["pm_task_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["pm_target"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          checklist?: Json
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          created_at?: string
          due_date?: string
          id?: string
          schedule_id?: string | null
          status?: Database["public"]["Enums"]["pm_task_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["pm_target"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_tasks_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "pm_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ad_dn: string | null
          ad_groups: string[]
          avatar_url: string | null
          company: string | null
          created_at: string
          department_id: string | null
          email: string | null
          employee_id: string | null
          first_name: string | null
          full_name: string | null
          id: string
          is_active: boolean
          is_ad_user: boolean
          job_title: string | null
          last_ad_sync: string | null
          last_login: string | null
          last_name: string | null
          manager_id: string | null
          manager_name: string | null
          mobile: string | null
          office: string | null
          phone: string | null
          sam_account_name: string | null
          updated_at: string
          user_principal_name: string | null
          username: string | null
        }
        Insert: {
          ad_dn?: string | null
          ad_groups?: string[]
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_id?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          is_ad_user?: boolean
          job_title?: string | null
          last_ad_sync?: string | null
          last_login?: string | null
          last_name?: string | null
          manager_id?: string | null
          manager_name?: string | null
          mobile?: string | null
          office?: string | null
          phone?: string | null
          sam_account_name?: string | null
          updated_at?: string
          user_principal_name?: string | null
          username?: string | null
        }
        Update: {
          ad_dn?: string | null
          ad_groups?: string[]
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          employee_id?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          is_ad_user?: boolean
          job_title?: string | null
          last_ad_sync?: string | null
          last_login?: string | null
          last_name?: string | null
          manager_id?: string | null
          manager_name?: string | null
          mobile?: string | null
          office?: string | null
          phone?: string | null
          sam_account_name?: string | null
          updated_at?: string
          user_principal_name?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_dept_fk"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      servers: {
        Row: {
          backup_status: string | null
          cluster: string | null
          cpu: string | null
          created_at: string
          hostname: string | null
          hypervisor: string | null
          id: string
          ip_address: string | null
          location_id: string | null
          name: string
          notes: string | null
          operating_system: string | null
          purpose: string | null
          ram: string | null
          server_kind: string
          snapshot_info: string | null
          storage: string | null
          updated_at: string
          vm_count: number | null
        }
        Insert: {
          backup_status?: string | null
          cluster?: string | null
          cpu?: string | null
          created_at?: string
          hostname?: string | null
          hypervisor?: string | null
          id?: string
          ip_address?: string | null
          location_id?: string | null
          name: string
          notes?: string | null
          operating_system?: string | null
          purpose?: string | null
          ram?: string | null
          server_kind?: string
          snapshot_info?: string | null
          storage?: string | null
          updated_at?: string
          vm_count?: number | null
        }
        Update: {
          backup_status?: string | null
          cluster?: string | null
          cpu?: string | null
          created_at?: string
          hostname?: string | null
          hypervisor?: string | null
          id?: string
          ip_address?: string | null
          location_id?: string | null
          name?: string
          notes?: string | null
          operating_system?: string | null
          purpose?: string | null
          ram?: string | null
          server_kind?: string
          snapshot_info?: string | null
          storage?: string | null
          updated_at?: string
          vm_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "servers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      software: {
        Row: {
          created_at: string
          created_by: string | null
          expiration_date: string | null
          id: string
          license_delivery: string | null
          license_key: string | null
          license_type: string | null
          name: string
          notes: string | null
          seats: number | null
          seats_used: number | null
          support_contact: string | null
          updated_at: string
          vendor: string | null
          version: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expiration_date?: string | null
          id?: string
          license_delivery?: string | null
          license_key?: string | null
          license_type?: string | null
          name: string
          notes?: string | null
          seats?: number | null
          seats_used?: number | null
          support_contact?: string | null
          updated_at?: string
          vendor?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expiration_date?: string | null
          id?: string
          license_delivery?: string | null
          license_key?: string | null
          license_type?: string | null
          name?: string
          notes?: string | null
          seats?: number | null
          seats_used?: number | null
          support_contact?: string | null
          updated_at?: string
          vendor?: string | null
          version?: string | null
        }
        Relationships: []
      }
      ticket_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          action_point_id: string | null
          asset_id: string | null
          assignee_id: string | null
          category: string | null
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          requester_id: string
          resolution: string | null
          resolved_at: string | null
          sla_due_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_number: string
          title: string
          updated_at: string
        }
        Insert: {
          action_point_id?: string | null
          asset_id?: string | null
          assignee_id?: string | null
          category?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          requester_id: string
          resolution?: string | null
          resolved_at?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number?: string
          title: string
          updated_at?: string
        }
        Update: {
          action_point_id?: string | null
          asset_id?: string | null
          assignee_id?: string | null
          category?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          requester_id?: string
          resolution?: string | null
          resolved_at?: string | null
          sla_due_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_action_point_id_fkey"
            columns: ["action_point_id"]
            isOneToOne: false
            referencedRelation: "briefing_action_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_briefing: { Args: { _briefing_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_it_staff: { Args: { _user_id: string }; Returns: boolean }
      log_activity: {
        Args: {
          _action: string
          _details: Json
          _entity_id: string
          _entity_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      action_status:
        | "open"
        | "in_progress"
        | "waiting"
        | "completed"
        | "overdue"
        | "cancelled"
      allowed_time_option:
        | "30m"
        | "1h"
        | "2h"
        | "4h"
        | "8h"
        | "1d"
        | "2d"
        | "3d"
        | "1w"
        | "custom"
      app_role:
        | "administrator"
        | "it_manager"
        | "it_supervisor"
        | "it_engineer"
        | "helpdesk"
        | "department_manager"
        | "employee"
        | "read_only"
      asset_status:
        | "in_use"
        | "in_stock"
        | "in_repair"
        | "retired"
        | "lost"
        | "disposed"
      asset_type:
        | "pc"
        | "laptop"
        | "server"
        | "printer"
        | "switch"
        | "firewall"
        | "router"
        | "access_point"
        | "ups"
        | "nas"
        | "phone"
        | "tablet"
        | "tv"
        | "pos"
        | "scanner"
        | "other"
      briefing_type:
        | "daily_briefing"
        | "management_meeting"
        | "department_meeting"
        | "it_meeting"
        | "emergency_meeting"
        | "followup_meeting"
        | "other"
      pm_frequency:
        | "weekly"
        | "monthly"
        | "quarterly"
        | "semiannual"
        | "annual"
        | "custom_days"
      pm_target: "asset" | "server" | "network_device"
      pm_task_status: "open" | "in_progress" | "done" | "skipped" | "overdue"
      ticket_priority: "low" | "medium" | "high" | "critical"
      ticket_status:
        | "open"
        | "in_progress"
        | "on_hold"
        | "resolved"
        | "closed"
        | "cancelled"
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
      action_status: [
        "open",
        "in_progress",
        "waiting",
        "completed",
        "overdue",
        "cancelled",
      ],
      allowed_time_option: [
        "30m",
        "1h",
        "2h",
        "4h",
        "8h",
        "1d",
        "2d",
        "3d",
        "1w",
        "custom",
      ],
      app_role: [
        "administrator",
        "it_manager",
        "it_supervisor",
        "it_engineer",
        "helpdesk",
        "department_manager",
        "employee",
        "read_only",
      ],
      asset_status: [
        "in_use",
        "in_stock",
        "in_repair",
        "retired",
        "lost",
        "disposed",
      ],
      asset_type: [
        "pc",
        "laptop",
        "server",
        "printer",
        "switch",
        "firewall",
        "router",
        "access_point",
        "ups",
        "nas",
        "phone",
        "tablet",
        "tv",
        "pos",
        "scanner",
        "other",
      ],
      briefing_type: [
        "daily_briefing",
        "management_meeting",
        "department_meeting",
        "it_meeting",
        "emergency_meeting",
        "followup_meeting",
        "other",
      ],
      pm_frequency: [
        "weekly",
        "monthly",
        "quarterly",
        "semiannual",
        "annual",
        "custom_days",
      ],
      pm_target: ["asset", "server", "network_device"],
      pm_task_status: ["open", "in_progress", "done", "skipped", "overdue"],
      ticket_priority: ["low", "medium", "high", "critical"],
      ticket_status: [
        "open",
        "in_progress",
        "on_hold",
        "resolved",
        "closed",
        "cancelled",
      ],
    },
  },
} as const
