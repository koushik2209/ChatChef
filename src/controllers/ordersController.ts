import { Request, Response } from 'express';
import { OrderStatus } from '@prisma/client';
import prisma from '../models/prisma';

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isValidStatus(s: string): s is OrderStatus {
  return Object.values(OrderStatus).includes(s as OrderStatus);
}

export async function listOrders(req: Request, res: Response): Promise<void> {
  const sellerId = req.seller!.id;
  const { status } = req.query as { status?: string };

  if (status && !isValidStatus(status)) {
    res.status(400).json({ success: false, message: `Invalid status. Valid values: ${Object.values(OrderStatus).join(', ')}` });
    return;
  }

  const orders = await prisma.order.findMany({
    where: {
      seller_id: sellerId,
      created_at: { gte: startOfToday() },
      ...(status ? { status: status as OrderStatus } : {}),
    },
    include: {
      customer: { select: { id: true, name: true, whatsapp_number: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  res.json({ success: true, data: orders });
}

export async function updateOrderStatus(req: Request, res: Response): Promise<void> {
  const sellerId = req.seller!.id;
  const id = req.params['id'] as string;
  const { status } = req.body as { status?: string };

  if (!status || !isValidStatus(status)) {
    res.status(400).json({ success: false, message: `Invalid status. Valid values: ${Object.values(OrderStatus).join(', ')}` });
    return;
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.seller_id !== sellerId) {
    res.status(404).json({ success: false, message: 'Order not found' });
    return;
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: status as OrderStatus },
    include: { customer: { select: { id: true, name: true, whatsapp_number: true } } },
  });

  res.json({ success: true, data: updated });
}

export async function cookingSummary(req: Request, res: Response): Promise<void> {
  const sellerId = req.seller!.id;

  const orders = await prisma.order.findMany({
    where: {
      seller_id: sellerId,
      created_at: { gte: startOfToday() },
      status: { in: [OrderStatus.NEW, OrderStatus.CONFIRMED, OrderStatus.PREPARING] },
    },
    select: { items: true },
  });

  const tally = new Map<string, { name: string; quantity: number; unitPrice: number }>();

  for (const order of orders) {
    const items = order.items as unknown as CartItem[];
    for (const item of items) {
      const entry = tally.get(item.menuItemId);
      if (entry) {
        entry.quantity += item.quantity;
      } else {
        tally.set(item.menuItemId, {
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
        });
      }
    }
  }

  const summary = Array.from(tally.entries())
    .map(([menuItemId, data]) => ({ menuItemId, ...data }))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({ success: true, data: summary });
}
