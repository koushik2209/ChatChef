import { api } from '../lib/axios';
import type { Seller } from '../types';

export async function requestOtp(phone: string): Promise<void> {
  await api.post('/auth/request-otp', { phone });
}

export async function verifyOtp(phone: string, otp: string): Promise<{ token: string; seller: Seller }> {
  const res = await api.post('/auth/verify-otp', { phone, otp });
  return res.data.data;
}

export interface RegisterInput {
  name: string;
  whatsapp_number: string;
  upi_id: string;
}

export async function registerSeller(data: RegisterInput): Promise<{ slug: string; name: string }> {
  const res = await api.post('/auth/register', data);
  return res.data.data;
}
