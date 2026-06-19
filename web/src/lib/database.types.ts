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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_notices: {
        Row: {
          body: string
          created_at: string
          dismissal_version: number
          id: string
          is_active: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          dismissal_version?: number
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          dismissal_version?: number
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      books: {
        Row: {
          author: string | null
          category_id: string | null
          comments: string | null
          cover_path: string | null
          date_added: string
          description: string | null
          id: string
          pages: number | null
          serial_number: number
          title: string
        }
        Insert: {
          author?: string | null
          category_id?: string | null
          comments?: string | null
          cover_path?: string | null
          date_added?: string
          description?: string | null
          id?: string
          pages?: number | null
          serial_number?: number
          title: string
        }
        Update: {
          author?: string | null
          category_id?: string | null
          comments?: string | null
          cover_path?: string | null
          date_added?: string
          description?: string | null
          id?: string
          pages?: number | null
          serial_number?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      email_log: {
        Row: {
          dedupe_key: string | null
          id: string
          loan_id: string | null
          recipient: string
          reservation_id: string | null
          sent_at: string
          type: string
        }
        Insert: {
          dedupe_key?: string | null
          id?: string
          loan_id?: string | null
          recipient: string
          reservation_id?: string | null
          sent_at?: string
          type: string
        }
        Update: {
          dedupe_key?: string | null
          id?: string
          loan_id?: string | null
          recipient?: string
          reservation_id?: string | null
          sent_at?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          book_id: string
          comments: string | null
          created_at: string
          date_given: string
          date_returned: string | null
          due_date: string
          id: string
          member_id: string
          reservation_item_id: string | null
        }
        Insert: {
          book_id: string
          comments?: string | null
          created_at?: string
          date_given?: string
          date_returned?: string | null
          due_date: string
          id?: string
          member_id: string
          reservation_item_id?: string | null
        }
        Update: {
          book_id?: string
          comments?: string | null
          created_at?: string
          date_given?: string
          date_returned?: string | null
          due_date?: string
          id?: string
          member_id?: string
          reservation_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loans_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "book_availability"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "loans_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_reservation_item_id_fkey"
            columns: ["reservation_item_id"]
            isOneToOne: true
            referencedRelation: "reservation_items"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address: string | null
          auth_user_id: string | null
          comments: string | null
          date_added: string
          email: string | null
          fees_owed: number
          has_password: boolean
          id: string
          is_admin: boolean
          name: string
          paid: boolean
          phone: string | null
        }
        Insert: {
          address?: string | null
          auth_user_id?: string | null
          comments?: string | null
          date_added?: string
          email?: string | null
          fees_owed?: number
          has_password?: boolean
          id?: string
          is_admin?: boolean
          name: string
          paid?: boolean
          phone?: string | null
        }
        Update: {
          address?: string | null
          auth_user_id?: string | null
          comments?: string | null
          date_added?: string
          email?: string | null
          fees_owed?: number
          has_password?: boolean
          id?: string
          is_admin?: boolean
          name?: string
          paid?: boolean
          phone?: string | null
        }
        Relationships: []
      }
      reservation_items: {
        Row: {
          book_id: string
          decided_at: string | null
          id: string
          loan_id: string | null
          reservation_id: string
          status: Database["public"]["Enums"]["reservation_item_status"]
        }
        Insert: {
          book_id: string
          decided_at?: string | null
          id?: string
          loan_id?: string | null
          reservation_id: string
          status?: Database["public"]["Enums"]["reservation_item_status"]
        }
        Update: {
          book_id?: string
          decided_at?: string | null
          id?: string
          loan_id?: string | null
          reservation_id?: string
          status?: Database["public"]["Enums"]["reservation_item_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reservation_items_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "book_availability"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "reservation_items_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_items_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_items_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          address: string | null
          admin_note: string | null
          comments: string | null
          created_at: string
          email: string
          finalized_at: string | null
          id: string
          member_id: string | null
          name: string
          phone: string | null
          pickup_time: string | null
        }
        Insert: {
          address?: string | null
          admin_note?: string | null
          comments?: string | null
          created_at?: string
          email: string
          finalized_at?: string | null
          id?: string
          member_id?: string | null
          name: string
          phone?: string | null
          pickup_time?: string | null
        }
        Update: {
          address?: string | null
          admin_note?: string | null
          comments?: string | null
          created_at?: string
          email?: string
          finalized_at?: string | null
          id?: string
          member_id?: string | null
          name?: string
          phone?: string | null
          pickup_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          description: string | null
          key: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      active_app_notices: {
        Row: {
          body: string | null
          dismissal_version: number | null
          id: string | null
          sort_order: number | null
          title: string | null
        }
        Relationships: []
      }
      book_availability: {
        Row: {
          book_id: string | null
          expected_return: string | null
          is_available: boolean | null
        }
        Relationships: []
      }
      public_settings: {
        Row: {
          key: string | null
          value: Json | null
        }
        Insert: {
          key?: string | null
          value?: Json | null
        }
        Update: {
          key?: string | null
          value?: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      cancel_my_item: { Args: { item_id: string }; Returns: undefined }
      claim_membership: { Args: never; Returns: string }
      current_member_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      mark_password_set: { Args: never; Returns: undefined }
    }
    Enums: {
      reservation_item_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "fulfilled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      reservation_item_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "fulfilled",
      ],
    },
  },
} as const
