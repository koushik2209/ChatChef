export type OrderStatus = 'NEW' | 'CONFIRMED' | 'PREPARING' | 'DONE' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PAID';

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Customer {
  id: string;
  name: string | null;
  whatsapp_number: string;
  order_count: number;
  last_order_at: string | null;
  last_order_total: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  seller_id: string;
  customer_id: string;
  customer: { id: string; name: string | null; whatsapp_number: string };
  items: CartItem[];
  total: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  seller_id: string;
  name: string;
  price: string;
  original_price: string | null;
  category: string;
  image_url: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface CookingItem {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface PaymentSummary {
  paid_count: number;
  pending_count: number;
  paid_total: number;
  pending_total: number;
}

export interface DashboardSummary {
  today: {
    total_orders: number;
    active_orders: number;
    cancelled_orders: number;
    revenue: number;
    pending_payments_count: number;
    pending_payments_amount: number;
    orders_by_status: Record<OrderStatus, number>;
  };
  all_time: { total_customers: number };
}

export interface Seller {
  id: string;
  name: string;
  whatsapp_number: string;
  upi_id: string;
  slug: string;
}
