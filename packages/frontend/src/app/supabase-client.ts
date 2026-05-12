"use client";

import { createClient } from "@supabase/supabase-js";

type ArcPayDatabase = {
  public: {
    Tables: {
      user_policy_settings: {
        Row: {
          user_id: string;
          settings: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          settings?: unknown;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          settings?: unknown;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          user_id: string;
          display_name: string;
          role: string;
          notification_email: string;
          wallet_label: string;
          linked_wallet_address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          display_name?: string;
          role?: string;
          notification_email?: string;
          wallet_label?: string;
          linked_wallet_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          display_name?: string;
          role?: string;
          notification_email?: string;
          wallet_label?: string;
          linked_wallet_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_workspace_settings: {
        Row: {
          user_id: string;
          workspace_name: string;
          default_network: "devnet" | "mainnet";
          email_notifications: boolean;
          risk_alerts: boolean;
          auto_yield_sweeps: boolean;
          require_wallet_for_actions: boolean;
          enabled_integrations: Record<string, boolean>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          workspace_name?: string;
          default_network?: "devnet" | "mainnet";
          email_notifications?: boolean;
          risk_alerts?: boolean;
          auto_yield_sweeps?: boolean;
          require_wallet_for_actions?: boolean;
          enabled_integrations?: Record<string, boolean>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          workspace_name?: string;
          default_network?: "devnet" | "mainnet";
          email_notifications?: boolean;
          risk_alerts?: boolean;
          auto_yield_sweeps?: boolean;
          require_wallet_for_actions?: boolean;
          enabled_integrations?: Record<string, boolean>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      arcpay_payment_requests: {
        Row: {
          id: string;
          user_id: string;
          public_id: string;
          network: "devnet" | "mainnet";
          amount: number;
          token: "USDC" | "AUDD" | "PUSD" | "SOL";
          memo: string;
          route_to: string;
          status: "pending" | "settled" | "failed" | "cancelled";
          payment_url: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          public_id?: string;
          network?: "devnet" | "mainnet";
          amount: number;
          token: "USDC" | "AUDD" | "PUSD" | "SOL";
          memo?: string;
          route_to?: string;
          status?: "pending" | "settled" | "failed" | "cancelled";
          payment_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ArcPayDatabase["public"]["Tables"]["arcpay_payment_requests"]["Insert"]>;
        Relationships: [];
      };
      arcpay_invoices: {
        Row: {
          id: string;
          user_id: string;
          public_id: string;
          client: string;
          email: string;
          amount: number;
          token: "USDC" | "AUDD" | "PUSD" | "SOL";
          due: string;
          memo: string;
          status: "paid" | "pending" | "overdue" | "failed" | "cancelled";
          payment_url: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          public_id?: string;
          client: string;
          email: string;
          amount: number;
          token: "USDC" | "AUDD" | "PUSD" | "SOL";
          due: string;
          memo?: string;
          status?: "paid" | "pending" | "overdue" | "failed" | "cancelled";
          payment_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ArcPayDatabase["public"]["Tables"]["arcpay_invoices"]["Insert"]>;
        Relationships: [];
      };
      arcpay_contractors: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          wallet: string;
          currency: "USDC" | "AUDD" | "PUSD" | "SOL";
          risk_score: number;
          risk_status: "approve" | "review" | "reject" | "unscored" | "error";
          risk_reasons: string[];
          private_route: boolean;
          paid_30: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          wallet: string;
          currency?: "USDC" | "AUDD" | "PUSD" | "SOL";
          risk_score?: number;
          risk_status?: "approve" | "review" | "reject" | "unscored" | "error";
          risk_reasons?: string[];
          private_route?: boolean;
          paid_30?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ArcPayDatabase["public"]["Tables"]["arcpay_contractors"]["Insert"]>;
        Relationships: [];
      };
      arcpay_privacy_events: {
        Row: {
          id: string;
          user_id: string;
          action: "shield" | "viewing_key";
          provider: string;
          amount: number | null;
          token: string;
          recipient_name: string;
          recipient_email: string;
          scope: string;
          status: "pending" | "ready_to_sign" | "submitted" | "failed" | "configured";
          provider_response: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: "shield" | "viewing_key";
          provider: string;
          amount?: number | null;
          token?: string;
          recipient_name?: string;
          recipient_email?: string;
          scope?: string;
          status?: "pending" | "ready_to_sign" | "submitted" | "failed" | "configured";
          provider_response?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ArcPayDatabase["public"]["Tables"]["arcpay_privacy_events"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let client: ReturnType<typeof createClient<ArcPayDatabase>> | null = null;

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase public URL/key are not configured.");
  }

  client ??= createClient<ArcPayDatabase>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}

export function getOptionalSupabaseClient() {
  try {
    return getSupabaseClient();
  } catch {
    return null;
  }
}
