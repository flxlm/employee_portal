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
      allowed_emails: {
        Row: {
          as_admin: boolean
          created_at: string
          email: string
          id: string
          invited_by: string | null
        }
        Insert: {
          as_admin?: boolean
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
        }
        Update: {
          as_admin?: boolean
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      daily_messages: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          message: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          message: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          message?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_inquiries: {
        Row: {
          arrival_time: string
          bar_service: string
          budget: string
          created_at: string
          description: string
          dj: string
          email: string
          end_time: string
          event_date: string | null
          event_date_raw: string
          food_budget: number
          food_restrictions: string
          food_service: string
          food_service_time: string
          guests: string
          id: string
          new_date_raw: string
          premium_drinks: string
          premium_drinks_details: string
          prepaid: string
          referral_source: string
          reservation_type: string
          start_time: string
          status: string
          submission_date: string
          submission_id: string | null
          updated_at: string
          wedding_sections: string
        }
        Insert: {
          arrival_time?: string
          bar_service?: string
          budget?: string
          created_at?: string
          description?: string
          dj?: string
          email?: string
          end_time?: string
          event_date?: string | null
          event_date_raw?: string
          food_budget?: number
          food_restrictions?: string
          food_service?: string
          food_service_time?: string
          guests?: string
          id?: string
          new_date_raw?: string
          premium_drinks?: string
          premium_drinks_details?: string
          prepaid?: string
          referral_source?: string
          reservation_type?: string
          start_time?: string
          status?: string
          submission_date?: string
          submission_id?: string | null
          updated_at?: string
          wedding_sections?: string
        }
        Update: {
          arrival_time?: string
          bar_service?: string
          budget?: string
          created_at?: string
          description?: string
          dj?: string
          email?: string
          end_time?: string
          event_date?: string | null
          event_date_raw?: string
          food_budget?: number
          food_restrictions?: string
          food_service?: string
          food_service_time?: string
          guests?: string
          id?: string
          new_date_raw?: string
          premium_drinks?: string
          premium_drinks_details?: string
          prepaid?: string
          referral_source?: string
          reservation_type?: string
          start_time?: string
          status?: string
          submission_date?: string
          submission_id?: string | null
          updated_at?: string
          wedding_sections?: string
        }
        Relationships: []
      }
      inventory_categories: {
        Row: {
          archived_at: string | null
          created_at: string
          display_order: number
          id: string
          name: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          display_order?: number
          id?: string
          name: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          display_order?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      inventory_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          item_id: string
          new_quantity: number
          old_quantity: number
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          item_id: string
          new_quantity: number
          old_quantity: number
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          item_id?: string
          new_quantity?: number
          old_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_item_suppliers: {
        Row: {
          cost: number
          created_at: string
          id: string
          item_id: string
          notes: string | null
          pack_size: number
          supplier: string
          updated_at: string
        }
        Insert: {
          cost?: number
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          pack_size?: number
          supplier?: string
          updated_at?: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          pack_size?: number
          supplier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_item_suppliers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          archived_at: string | null
          category_id: string
          created_at: string
          current_quantity: number
          id: string
          last_supplier: string | null
          name: string
          notes: string | null
          par_level: number
          reorder_threshold: number
          unit: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          category_id: string
          created_at?: string
          current_quantity?: number
          id?: string
          last_supplier?: string | null
          name?: string
          notes?: string | null
          par_level?: number
          reorder_threshold?: number
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          category_id?: string
          created_at?: string
          current_quantity?: number
          id?: string
          last_supplier?: string | null
          name?: string
          notes?: string | null
          par_level?: number
          reorder_threshold?: number
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      item_modifications: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_deleted: boolean
          item_id: string
          modification_name: string
          price_modifier_cents: number
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_deleted?: boolean
          item_id: string
          modification_name?: string
          price_modifier_cents?: number
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_deleted?: boolean
          item_id?: string
          modification_name?: string
          price_modifier_cents?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_modifications_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_display_view"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "item_modifications_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_formatting: {
        Row: {
          id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          id?: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          base_price_cents: number
          created_at: string
          description: string
          description_en: string | null
          description_is_manual_override: boolean
          description_source_lang: string
          description_translated_from: string | null
          display_order: number
          do_not_translate: boolean
          id: string
          is_deleted: boolean
          is_hidden: boolean
          sold_out_date: string | null
          subsection_id: string
          title: string
          title_en: string | null
          title_is_manual_override: boolean
          title_source_lang: string
          title_translated_from: string | null
          updated_at: string
          version: number
        }
        Insert: {
          base_price_cents?: number
          created_at?: string
          description?: string
          description_en?: string | null
          description_is_manual_override?: boolean
          description_source_lang?: string
          description_translated_from?: string | null
          display_order?: number
          do_not_translate?: boolean
          id?: string
          is_deleted?: boolean
          is_hidden?: boolean
          sold_out_date?: string | null
          subsection_id: string
          title?: string
          title_en?: string | null
          title_is_manual_override?: boolean
          title_source_lang?: string
          title_translated_from?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          base_price_cents?: number
          created_at?: string
          description?: string
          description_en?: string | null
          description_is_manual_override?: boolean
          description_source_lang?: string
          description_translated_from?: string | null
          display_order?: number
          do_not_translate?: boolean
          id?: string
          is_deleted?: boolean
          is_hidden?: boolean
          sold_out_date?: string | null
          subsection_id?: string
          title?: string
          title_en?: string | null
          title_is_manual_override?: boolean
          title_source_lang?: string
          title_translated_from?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_subsection_id_fkey"
            columns: ["subsection_id"]
            isOneToOne: false
            referencedRelation: "menu_display_view"
            referencedColumns: ["subsection_id"]
          },
          {
            foreignKeyName: "menu_items_subsection_id_fkey"
            columns: ["subsection_id"]
            isOneToOne: false
            referencedRelation: "menu_subsections"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_schedule: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          menu_key: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          menu_key: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          menu_key?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_sections: {
        Row: {
          created_at: string
          description: string
          description_en: string | null
          description_is_manual_override: boolean
          description_source_lang: string
          description_translated_from: string | null
          display_order: number
          do_not_translate: boolean
          id: string
          is_deleted: boolean
          is_hidden: boolean
          name: string
          name_en: string | null
          name_is_manual_override: boolean
          name_source_lang: string
          name_translated_from: string | null
          sold_out_date: string | null
          updated_at: string
          version: number
          visible_menus: string[]
        }
        Insert: {
          created_at?: string
          description?: string
          description_en?: string | null
          description_is_manual_override?: boolean
          description_source_lang?: string
          description_translated_from?: string | null
          display_order?: number
          do_not_translate?: boolean
          id?: string
          is_deleted?: boolean
          is_hidden?: boolean
          name?: string
          name_en?: string | null
          name_is_manual_override?: boolean
          name_source_lang?: string
          name_translated_from?: string | null
          sold_out_date?: string | null
          updated_at?: string
          version?: number
          visible_menus?: string[]
        }
        Update: {
          created_at?: string
          description?: string
          description_en?: string | null
          description_is_manual_override?: boolean
          description_source_lang?: string
          description_translated_from?: string | null
          display_order?: number
          do_not_translate?: boolean
          id?: string
          is_deleted?: boolean
          is_hidden?: boolean
          name?: string
          name_en?: string | null
          name_is_manual_override?: boolean
          name_source_lang?: string
          name_translated_from?: string | null
          sold_out_date?: string | null
          updated_at?: string
          version?: number
          visible_menus?: string[]
        }
        Relationships: []
      }
      menu_subsections: {
        Row: {
          created_at: string
          description: string
          description_en: string | null
          description_is_manual_override: boolean
          description_source_lang: string
          description_translated_from: string | null
          display_order: number
          do_not_translate: boolean
          id: string
          is_deleted: boolean
          is_hidden: boolean
          name: string
          name_en: string | null
          name_is_manual_override: boolean
          name_source_lang: string
          name_translated_from: string | null
          section_id: string
          sold_out_date: string | null
          updated_at: string
          version: number
          visible_menus: string[]
        }
        Insert: {
          created_at?: string
          description?: string
          description_en?: string | null
          description_is_manual_override?: boolean
          description_source_lang?: string
          description_translated_from?: string | null
          display_order?: number
          do_not_translate?: boolean
          id?: string
          is_deleted?: boolean
          is_hidden?: boolean
          name?: string
          name_en?: string | null
          name_is_manual_override?: boolean
          name_source_lang?: string
          name_translated_from?: string | null
          section_id: string
          sold_out_date?: string | null
          updated_at?: string
          version?: number
          visible_menus?: string[]
        }
        Update: {
          created_at?: string
          description?: string
          description_en?: string | null
          description_is_manual_override?: boolean
          description_source_lang?: string
          description_translated_from?: string | null
          display_order?: number
          do_not_translate?: boolean
          id?: string
          is_deleted?: boolean
          is_hidden?: boolean
          name?: string
          name_en?: string | null
          name_is_manual_override?: boolean
          name_source_lang?: string
          name_translated_from?: string | null
          section_id?: string
          sold_out_date?: string | null
          updated_at?: string
          version?: number
          visible_menus?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "menu_subsections_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "menu_display_view"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "menu_subsections_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "menu_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          display_order: number
          id: string
          key: string
          label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          key: string
          label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          key?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      open_close_logs: {
        Row: {
          cash_tips: number
          confirmed: boolean
          created_at: string
          id: string
          log_date: string
          notes: string | null
          photo_path: string | null
          shift_type: Database["public"]["Enums"]["shift_type"]
          till_amount: number
          till_difference: number
          till_status: string
          user_email: string
          user_id: string
        }
        Insert: {
          cash_tips?: number
          confirmed?: boolean
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          photo_path?: string | null
          shift_type: Database["public"]["Enums"]["shift_type"]
          till_amount: number
          till_difference?: number
          till_status: string
          user_email: string
          user_id: string
        }
        Update: {
          cash_tips?: number
          confirmed?: boolean
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          photo_path?: string | null
          shift_type?: Database["public"]["Enums"]["shift_type"]
          till_amount?: number
          till_difference?: number
          till_status?: string
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      order_requests: {
        Row: {
          ad_hoc_name: string | null
          flagged_at: string
          flagged_by: string | null
          id: string
          inventory_item_id: string | null
          notes: string | null
          ordered_at: string | null
          ordered_by: string | null
          quantity_needed: number | null
          status: Database["public"]["Enums"]["order_request_status"]
          supplier: string | null
          unit: string | null
        }
        Insert: {
          ad_hoc_name?: string | null
          flagged_at?: string
          flagged_by?: string | null
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          ordered_at?: string | null
          ordered_by?: string | null
          quantity_needed?: number | null
          status?: Database["public"]["Enums"]["order_request_status"]
          supplier?: string | null
          unit?: string | null
        }
        Update: {
          ad_hoc_name?: string | null
          flagged_at?: string
          flagged_by?: string | null
          id?: string
          inventory_item_id?: string | null
          notes?: string | null
          ordered_at?: string | null
          ordered_by?: string | null
          quantity_needed?: number | null
          status?: Database["public"]["Enums"]["order_request_status"]
          supplier?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_requests_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      passcodes: {
        Row: {
          admin_only: boolean
          code: string
          created_at: string
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          admin_only?: boolean
          code: string
          created_at?: string
          id?: string
          label: string
          updated_at?: string
        }
        Update: {
          admin_only?: boolean
          code?: string
          created_at?: string
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      recipes: {
        Row: {
          category: string
          created_at: string
          dish_used: string
          id: string
          product: string
          recipe: string
          sort_order: number
          special_instructions: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          dish_used?: string
          id?: string
          product?: string
          recipe?: string
          sort_order?: number
          special_instructions?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          dish_used?: string
          id?: string
          product?: string
          recipe?: string
          sort_order?: number
          special_instructions?: string
          updated_at?: string
        }
        Relationships: []
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
      wines: {
        Row: {
          added_by: string
          bottle: number
          colour: string
          cost: number
          country: string
          created_at: string
          domaine: string
          glass: number
          id: string
          inventory: number
          markup: number
          name: string
          togo: number
          type: string
          updated_at: string
          year: string
        }
        Insert: {
          added_by?: string
          bottle?: number
          colour?: string
          cost?: number
          country?: string
          created_at?: string
          domaine?: string
          glass?: number
          id?: string
          inventory?: number
          markup?: number
          name?: string
          togo?: number
          type?: string
          updated_at?: string
          year?: string
        }
        Update: {
          added_by?: string
          bottle?: number
          colour?: string
          cost?: number
          country?: string
          created_at?: string
          domaine?: string
          glass?: number
          id?: string
          inventory?: number
          markup?: number
          name?: string
          togo?: number
          type?: string
          updated_at?: string
          year?: string
        }
        Relationships: []
      }
    }
    Views: {
      menu_display_view: {
        Row: {
          base_price_cents: number | null
          item_description: string | null
          item_id: string | null
          item_is_hidden: boolean | null
          item_order: number | null
          item_sold_out_date: string | null
          item_title: string | null
          modifications: Json | null
          section_description: string | null
          section_id: string | null
          section_is_hidden: boolean | null
          section_name: string | null
          section_order: number | null
          section_sold_out_date: string | null
          section_visible_menus: string[] | null
          subsection_description: string | null
          subsection_id: string | null
          subsection_is_hidden: boolean | null
          subsection_name: string | null
          subsection_order: number | null
          subsection_sold_out_date: string | null
          subsection_visible_menus: string[] | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_email_allowed: { Args: { _email: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "employee"
      order_request_status: "pending" | "ordered" | "cancelled" | "received"
      shift_type: "open" | "close"
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
      app_role: ["admin", "employee"],
      order_request_status: ["pending", "ordered", "cancelled", "received"],
      shift_type: ["open", "close"],
    },
  },
} as const
