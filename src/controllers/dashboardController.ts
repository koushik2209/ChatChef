import { Request, Response } from 'express';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import prisma from '../models/prisma';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getSummary(req: Request, res: Response): Promise<void> {
  const sellerId = req.seller!.id;
  const today = startOfToday();

  const [orders, totalCustomers] = await Promise.all([
    prisma.order.findMany({
      where: { seller_id: sellerId, created_at: { gte: today } },
      select: { status: true, payment_status: true, total: true },
    }),
    prisma.customer.count({ where: { seller_id: sellerId } }),
  ]);

  const totalOrders = orders.length;
  const cancelledOrders = orders.filter((o) => o.status === OrderStatus.CANCELLED).length;
  const activeOrders = totalOrders - cancelledOrders;

  const paidOrders = orders.filter((o) => o.payment_status === PaymentStatus.PAID);
  const pendingPayments = orders.filter(
    (o) => o.payment_status === PaymentStatus.PENDING && o.status !== OrderStatus.CANCELLED
  );

  const revenue = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const pendingAmount = pendingPayments.reduce((sum, o) => sum + Number(o.total), 0);

  const byStatus = Object.values(OrderStatus).reduce<Record<string, number>>((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {});

  res.json({
    success: true,
    data: {
      today: {
        total_orders: totalOrders,
        active_orders: activeOrders,
        cancelled_orders: cancelledOrders,
        revenue,
        pending_payments_count: pendingPayments.length,
        pending_payments_amount: pendingAmount,
        orders_by_status: byStatus,
      },
      all_time: {
        total_customers: totalCustomers,
      },
    },
  });
}
