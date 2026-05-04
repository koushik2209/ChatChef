import { Request, Response } from 'express';
import { PaymentStatus } from '@prisma/client';
import prisma from '../models/prisma';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function listPayments(req: Request, res: Response): Promise<void> {
  const sellerId = req.seller!.id;
  const { payment_status } = req.query as { payment_status?: string };

  const validStatuses = Object.values(PaymentStatus);
  if (payment_status && !validStatuses.includes(payment_status as PaymentStatus)) {
    res.status(400).json({
      success: false,
      message: `Invalid payment_status. Valid values: ${validStatuses.join(', ')}`,
    });
    return;
  }

  const orders = await prisma.order.findMany({
    where: {
      seller_id: sellerId,
      created_at: { gte: startOfToday() },
      ...(payment_status ? { payment_status: payment_status as PaymentStatus } : {}),
    },
    include: {
      customer: { select: { id: true, name: true, whatsapp_number: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  const paidTotal = orders
    .filter((o) => o.payment_status === PaymentStatus.PAID)
    .reduce((sum, o) => sum + Number(o.total), 0);

  const pendingTotal = orders
    .filter((o) => o.payment_status === PaymentStatus.PENDING)
    .reduce((sum, o) => sum + Number(o.total), 0);

  res.json({
    success: true,
    data: {
      orders,
      summary: {
        paid_count: orders.filter((o) => o.payment_status === PaymentStatus.PAID).length,
        pending_count: orders.filter((o) => o.payment_status === PaymentStatus.PENDING).length,
        paid_total: paidTotal,
        pending_total: pendingTotal,
      },
    },
  });
}

export async function markPaid(req: Request, res: Response): Promise<void> {
  const sellerId = req.seller!.id;
  const orderId = req.params['orderId'] as string;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.seller_id !== sellerId) {
    res.status(404).json({ success: false, message: 'Order not found' });
    return;
  }

  if (order.payment_status === PaymentStatus.PAID) {
    res.status(409).json({ success: false, message: 'Order is already marked as paid' });
    return;
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { payment_status: PaymentStatus.PAID },
    include: { customer: { select: { id: true, name: true, whatsapp_number: true } } },
  });

  res.json({ success: true, data: updated });
}
