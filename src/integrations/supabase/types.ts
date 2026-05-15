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
      menu_items: {
        Row: {
          base_price_cents: number
          created_at: string
          description: string
          display_order: number
          id: string
          is_deleted: boolean
          subsection_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          base_price_cents?: number
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          is_deleted?: boolean
          subsection_id: string
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          base_price_cents?: number
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          is_deleted?: boolean
          subsection_id?: string
          title?: string
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
      menu_sections: {
        Row: {
          created_at: string
          description: string
          display_order: number
          id: string
          is_deleted: boolean
          name: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          is_deleted?: boolean
          name?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          is_deleted?: boolean
          name?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      menu_subsections: {
        Row: {
          created_at: string
          description: string
          display_order: number
          id: string
          is_deleted: boolean
          name: string
          section_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          is_deleted?: boolean
          name?: string
          section_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          is_deleted?: boolean
          name?: string
          section_id?: string
          updated_at?: string
          version?: number
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
          item_order: number | null
          item_title: string | null
          modifications: Json | null
          section_description: string | null
          section_id: string | null
          section_name: string | null
          section_order: number | null
          subsection_description: string | null
          subsection_id: string | null
          subsection_name: string | null
          subsection_order: number | null
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
      shift_type: ["open", "close"],
    },
  },
} as const
