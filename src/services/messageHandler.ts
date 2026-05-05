import { ParsedMessage } from '../types/whatsapp';
import { getSession, upsertSession, ConversationStep } from './conversationState';
import { handleConversationStep } from './conversationFlow';
import { handleSellerStep } from './sellerFlow';
import * as wa from './whatsapp';
import prisma from '../models/prisma';

export async function handleIncomingMessage(message: ParsedMessage): Promise<void> {
  const { from, phoneNumberId } = message;

  // ── 1. Check if sender is a registered seller ──────────────────────────────
  const sellerRecord = await prisma.seller.findFirst({
    where: { whatsapp_number: from, is_active: true },
    select: { id: true, name: true, upi_id: true },
  });

  if (sellerRecord) {
    let session = getSession(from, phoneNumberId);
    if (!session) {
      session = upsertSession(from, phoneNumberId, {
        step: ConversationStep.SELLER_GREETING,
        displayPhoneNumber: message.displayPhoneNumber,
        sellerId: sellerRecord.id,
        sellerName: sellerRecord.name,
        upiId: sellerRecord.upi_id,
        customerName: message.contactName,
      });
    }
    await handleSellerStep(from, phoneNumberId, session, message);
    return;
  }

  // ── 2. Customer flow ───────────────────────────────────────────────────────
  let session = getSession(from, phoneNumberId);

  if (!session) {
    // No existing session — need a valid seller slug to start one
    const slug =
      message.type === 'text' ? message.text.trim().toLowerCase() : null;

    if (!slug) {
      await wa.sendText(from, phoneNumberId, "Please use your seller's link to place an order. 🛍️");
      return;
    }

    const seller = await prisma.seller.findFirst({
      where: { slug, is_active: true },
      select: { id: true, name: true, upi_id: true },
    });

    if (!seller) {
      await wa.sendText(from, phoneNumberId, "Please use your seller's link to place an order. 🛍️");
      return;
    }

    session = upsertSession(from, phoneNumberId, {
      step: ConversationStep.GREETING,
      displayPhoneNumber: message.displayPhoneNumber,
      sellerId: seller.id,
      sellerName: seller.name,
      upiId: seller.upi_id,
      customerName: message.contactName,
    });
  } else if (message.contactName && !session.customerName) {
    session = upsertSession(from, phoneNumberId, { customerName: message.contactName });
  }

  if (message.type === 'unsupported') {
    console.log(`[handler] Unsupported message type from ${from} — ignoring`);
    return;
  }

  await handleConversationStep(from, phoneNumberId, session, message);
}
