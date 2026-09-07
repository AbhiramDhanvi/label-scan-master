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
      lm_inspections: {
        Row: {
          batch_no: string
          created_at: string
          flagged: string[]
          id: string
          inspected_on: string
          label_image_url: string | null
          lot_size: string
          note: string
          officer: string
          product_code: string
          site: string
          verdict: string
        }
        Insert: {
          batch_no?: string
          created_at?: string
          flagged?: string[]
          id?: string
          inspected_on?: string
          label_image_url?: string | null
          lot_size?: string
          note?: string
          officer?: string
          product_code: string
          site?: string
          verdict: string
        }
        Update: {
          batch_no?: string
          created_at?: string
          flagged?: string[]
          id?: string
          inspected_on?: string
          label_image_url?: string | null
          lot_size?: string
          note?: string
          officer?: string
          product_code?: string
          site?: string
          verdict?: string
        }
        Relationships: []
      }
      lm_limits: {
        Row: {
          citation: string | null
          code: string
          created_at: string
          id: string
          kind: string
          max_quantity_base: number | null
          min_height_mm: number | null
          requirement: string
          title: string
        }
        Insert: {
          citation?: string | null
          code: string
          created_at?: string
          id?: string
          kind: string
          max_quantity_base?: number | null
          min_height_mm?: number | null
          requirement: string
          title: string
        }
        Update: {
          citation?: string | null
          code?: string
          created_at?: string
          id?: string
          kind?: string
          max_quantity_base?: number | null
          min_height_mm?: number | null
          requirement?: string
          title?: string
        }
        Relationships: []
      }
      lm_products: {
        Row: {
          category: string
          code: string
          created_at: string
          flagged: string[]
          id: string
          imported: boolean
          label_image_url: string | null
          mrp: number
          net_quantity: string
          note: string
          product: string
          quantity_base: number
          unit_symbol: string
          verdict: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          flagged?: string[]
          id?: string
          imported?: boolean
          label_image_url?: string | null
          mrp?: number
          net_quantity: string
          note?: string
          product: string
          quantity_base: number
          unit_symbol?: string
          verdict?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          flagged?: string[]
          id?: string
          imported?: boolean
          label_image_url?: string | null
          mrp?: number
          net_quantity?: string
          note?: string
          product?: string
          quantity_base?: number
          unit_symbol?: string
          verdict?: string
        }
        Relationships: []
      }
      lm_units: {
        Row: {
          base_factor: number
          created_at: string
          id: string
          kind: string
          label: string
          symbol: string
        }
        Insert: {
          base_factor?: number
          created_at?: string
          id?: string
          kind: string
          label: string
          symbol: string
        }
        Update: {
          base_factor?: number
          created_at?: string
          id?: string
          kind?: string
          label?: string
          symbol?: string
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
