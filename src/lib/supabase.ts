import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://beusgmqcwbmejxutgevn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJldXNnbXFjd2JtZWp4dXRnZXZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxODM1NDcsImV4cCI6MjA4NDc1OTU0N30.uf2XY8YAFD2o5F_FlBygP3F0wFGtisnBuGhk1APlKog';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          cedula: string;
          name: string;
          phone: string;
          email: string | null;
          address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      technicians: {
        Row: {
          id: string;
          name: string;
          phone: string;
          specialty: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['technicians']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['technicians']['Insert']>;
      };
      service_orders: {
        Row: {
          id: string;
          order_number: string;
          customer_id: string;
          technician_id: string | null;
          device_brand: string;
          device_model: string;
          device_color: string | null;
          device_imei: string | null;
          unlock_pattern: string | null;
          unlock_pin: string | null;
          account_password: string | null;
          reported_issue: string;
          aesthetic_notes: string | null;
          initial_budget: number;
          additional_costs: number;
          total_paid: number;
          status: 'pending' | 'in_progress' | 'completed' | 'delivered' | 'abandoned';
          warranty_days: number;
          warranty_expires_at: string | null;
          estimated_completion: string | null;
          created_at: string;
          updated_at: string;
          delivered_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['service_orders']['Row'], 'id' | 'order_number' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['service_orders']['Insert']>;
      };
      order_payments: {
        Row: {
          id: string;
          order_id: string;
          amount: number;
          payment_method: string;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['order_payments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['order_payments']['Insert']>;
      };
      order_additional_costs: {
        Row: {
          id: string;
          order_id: string;
          description: string;
          amount: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['order_additional_costs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['order_additional_costs']['Insert']>;
      };
      spare_parts: {
        Row: {
          id: string;
          name: string;
          category: string;
          brand: string | null;
          model_compatibility: string | null;
          purchase_price: number;
          sale_price: number;
          stock: number;
          min_stock: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['spare_parts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['spare_parts']['Insert']>;
      };
      spare_parts_usage: {
        Row: {
          id: string;
          order_id: string;
          spare_part_id: string;
          quantity: number;
          unit_price: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['spare_parts_usage']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['spare_parts_usage']['Insert']>;
      };
      company_settings: {
        Row: {
          id: string;
          name: string;
          rif: string | null;
          address: string | null;
          phone: string | null;
          email: string | null;
          logo_url: string | null;
          default_warranty_days: number;
          terms_conditions: string | null;
          abandonment_days: number;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['company_settings']['Row'], 'id' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['company_settings']['Insert']>;
      };
      whatsapp_templates: {
        Row: {
          id: string;
          name: string;
          template: string;
          status_trigger: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['whatsapp_templates']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['whatsapp_templates']['Insert']>;
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          details: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['activity_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['activity_logs']['Insert']>;
      };
    };
  };
};
