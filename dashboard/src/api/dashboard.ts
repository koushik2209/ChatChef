import { api } from '../lib/axios';
import type { DashboardSummary } from '../types';

export async function fetchSummary(): Promise<DashboardSummary> {
  const res = await api.get('/dashboard/summary');
  return res.data.data;
}
