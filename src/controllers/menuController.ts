import { Request, Response } from 'express';
import prisma from '../models/prisma';

export async function listMenu(req: Request, res: Response): Promise<void> {
  const items = await prisma.menuItem.findMany({
    where: { seller_id: req.seller!.id },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  res.json({ success: true, data: items });
}

export async function createMenuItem(req: Request, res: Response): Promise<void> {
  const { name, price, original_price, category, image_url, is_available } = req.body as {
    name?: string;
    price?: number;
    original_price?: number;
    category?: string;
    image_url?: string;
    is_available?: boolean;
  };

  if (!name || price == null || !category) {
    res.status(400).json({ success: false, message: 'name, price, and category are required' });
    return;
  }

  const item = await prisma.menuItem.create({
    data: {
      seller_id: req.seller!.id,
      name,
      price,
      original_price: original_price ?? null,
      category,
      image_url: image_url ?? null,
      is_available: is_available ?? true,
    },
  });

  res.status(201).json({ success: true, data: item });
}

export async function updateMenuItem(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string;
  const sellerId = req.seller!.id;

  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing || existing.seller_id !== sellerId) {
    res.status(404).json({ success: false, message: 'Menu item not found' });
    return;
  }

  const { name, price, original_price, category, image_url, is_available } = req.body as {
    name?: string;
    price?: number;
    original_price?: number | null;
    category?: string;
    image_url?: string | null;
    is_available?: boolean;
  };

  const item = await prisma.menuItem.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(original_price !== undefined ? { original_price } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(image_url !== undefined ? { image_url } : {}),
      ...(is_available !== undefined ? { is_available } : {}),
    },
  });

  res.json({ success: true, data: item });
}

export async function deleteMenuItem(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string;
  const sellerId = req.seller!.id;

  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing || existing.seller_id !== sellerId) {
    res.status(404).json({ success: false, message: 'Menu item not found' });
    return;
  }

  await prisma.menuItem.delete({ where: { id } });
  res.json({ success: true, message: 'Menu item deleted' });
}
