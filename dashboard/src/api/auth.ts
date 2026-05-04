import { api } from '../lib/axios';
import type { Seller } from '../types';

export async function requestOtp(phone: string): Promise<void> {
  await api.post('/auth/request-otp', { phone });
}

export async function verifyOtp(phone: string, otp: string): Promise<{ token: string; seller: Seller }> {
  const res = await api.post('/auth/verify-otp', { phone, otp });
  return res.data.data;
}
