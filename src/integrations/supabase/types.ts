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
          avatar_url: string | null
          created_at: string
          department_id: string | null
          email: string | null
          full_name: string | null
          id: string
          job_title: string | null
          phone: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
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
      app_role:
        | "administrator"
        | "it_manager"
        | "it_supervisor"
        | "it_engineer"
        | "helpdesk"
        | "department_manager"
        | "employee"
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
      app_role: [
        "administrator",
        "it_manager",
        "it_supervisor",
        "it_engineer",
        "helpdesk",
        "department_manager",
        "employee",
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
