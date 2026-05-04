import { api } from '../lib/axios';
import type { MenuItem } from '../types';

export async function fetchMenu(): Promise<MenuItem[]> {
  const res = await api.get('/menu');
  return res.data.data;
}

export interface CreateMenuItemInput {
  name: string;
  price: number;
  original_price?: number;
  category: string;
  image_url?: string;
  is_available?: boolean;
}

export async function createMenuItem(data: CreateMenuItemInput): Promise<MenuItem> {
  const res = await api.post('/menu', data);
  return res.data.data;
}

export async function updateMenuItem(id: string, data: Partial<CreateMenuItemInput>): Promise<MenuItem> {
  const res = await api.patch(`/menu/${id}`, data);
  return res.data.data;
}

export async function deleteMenuItem(id: string): Promise<void> {
  await api.delete(`/menu/${id}`);
}
