import prisma from '../models/prisma';
import { CartItem } from './conversationState';

export async function findOrCreateCustomer(
  sellerId: string,
  whatsappNumber: string,
  name?: string
) {
  const existing = await prisma.customer.findUnique({
    where: {
      seller_id_whatsapp_number: { seller_id: sellerId, whatsapp_number: whatsappNumber },
    },
  });

  if (existing) {
    if (name && !existing.name) {
      return prisma.customer.update({ where: { id: existing.id }, data: { name } });
    }
    return existing;
  }

  return prisma.customer.create({
    data: { seller_id: sellerId, whatsapp_number: whatsappNumber, name },
  });
}

export async function createOrder(
  sellerId: string,
  customerId: string,
  items: CartItem[],
  total: number
) {
  return prisma.order.create({
    data: {
      seller_id: sellerId,
      customer_id: customerId,
      items: JSON.parse(JSON.stringify(items)), // CartItem[] → plain JSON
      total: total,
      status: 'NEW',
      payment_status: 'PAID',
    },
  });
}
