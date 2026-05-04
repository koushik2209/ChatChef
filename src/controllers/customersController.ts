import { Request, Response } from 'express';
import prisma from '../models/prisma';

export async function listCustomers(req: Request, res: Response): Promise<void> {
  const sellerId = req.seller!.id;
  const limit = Math.min(parseInt((req.query.limit as string) ?? '50', 10), 200);
  const offset = parseInt((req.query.offset as string) ?? '0', 10);

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where: { seller_id: sellerId },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
      include: {
        _count: { select: { orders: true } },
        orders: {
          orderBy: { created_at: 'desc' },
          take: 1,
          select: { created_at: true, total: true },
        },
      },
    }),
    prisma.customer.count({ where: { seller_id: sellerId } }),
  ]);

  const data = customers.map((c) => ({
    id: c.id,
    name: c.name,
    whatsapp_number: c.whatsapp_number,
    address: c.address,
    order_count: c._count.orders,
    last_order_at: c.orders[0]?.created_at ?? null,
    last_order_total: c.orders[0]?.total ?? null,
    created_at: c.created_at,
  }));

  res.json({ success: true, data, meta: { total, limit, offset } });
}
