import { api } from '../lib/axios';
import type { Order, PaymentStatus, PaymentSummary } from '../types';

interface PaymentsResponse {
  orders: Order[];
  summary: PaymentSummary;
}

export async function fetchPayments(paymentStatus?: PaymentStatus): Promise<PaymentsResponse> {
  const params = paymentStatus ? { payment_status: paymentStatus } : {};
  const res = await api.get('/payments', { params });
  return res.data.data;
}

export async function markPaid(orderId: string): Promise<Order> {
  const res = await api.patch(`/payments/${orderId}/mark-paid`);
  return res.data.data;
}
