import { api } from '../lib/axios';
import type { Order, OrderStatus, CookingItem } from '../types';

export async function fetchOrders(status?: string): Promise<Order[]> {
  const params = status ? { status } : {};
  const res = await api.get('/orders', { params });
  return res.data.data;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  const res = await api.patch(`/orders/${id}/status`, { status });
  return res.data.data;
}

export async function fetchCookingSummary(): Promise<CookingItem[]> {
  const res = await api.get('/orders/cooking-summary');
  return res.data.data;
}
