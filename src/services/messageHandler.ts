import { ParsedMessage } from '../types/whatsapp';
import { getSession, upsertSession, ConversationStep } from './conversationState';
import { handleConversationStep } from './conversationFlow';
import { handleSellerMessage } from './sellerFlow';
import * as wa from './whatsapp';
import prisma from '../models/prisma';

const CHATCHEF_NUMBER = process.env.CHATCHEF_NUMBER ?? '';

export async function handleIncomingMessage(message: ParsedMessage): Promise<void> {
  console.log('[handler] incoming:', JSON.stringify(message, null, 2));
  const { from, phoneNumberId, displayPhoneNumber } = message;

  // ── Messages to the ChatChef number → seller flow ──────────────────────────
  if (displayPhoneNumber && displayPhoneNumber === CHATCHEF_NUMBER) {
    await handleSellerMessage(from, phoneNumberId, message);
    return;
  }

  // ── Messages to any other number → customer ordering flow ──────────────────
  let session = getSession(from, phoneNumberId);

  if (!session) {
    // No existing session — first message must be the seller's slug
    const slug = message.type === 'text' ? message.text.trim().toLowerCase() : null;

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
      displayPhoneNumber,
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
