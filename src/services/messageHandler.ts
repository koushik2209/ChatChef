import {
  WhatsAppWebhookPayload,
  WhatsAppRawMessage,
  WhatsAppContact,
  ParsedMessage,
} from '../types/whatsapp';
import { getSession, upsertSession, ConversationStep } from './conversationState';
import { handleConversationStep } from './conversationFlow';
import prisma from '../models/prisma';

export function parseWebhookPayload(body: WhatsAppWebhookPayload): ParsedMessage[] {
  const messages: ParsedMessage[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;

      const { metadata, messages: rawMessages, contacts } = change.value;
      const { phone_number_id, display_phone_number } = metadata;
      const contactMap = buildContactMap(contacts ?? []);

      for (const raw of rawMessages ?? []) {
        messages.push(normalise(raw, phone_number_id, display_phone_number, contactMap));
      }
    }
  }

  return messages;
}

function buildContactMap(contacts: WhatsAppContact[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of contacts) map.set(c.wa_id, c.profile.name);
  return map;
}

function normalise(
  raw: WhatsAppRawMessage,
  phoneNumberId: string,
  displayPhoneNumber: string,
  contactMap: Map<string, string>
): ParsedMessage {
  const base = {
    from: raw.from,
    phoneNumberId,
    displayPhoneNumber,
    contactName: contactMap.get(raw.from),
  };

  switch (raw.type) {
    case 'text':
      return { ...base, type: 'text', text: raw.text?.body ?? '' };

    case 'interactive': {
      const ia = raw.interactive!;
      if (ia.type === 'button_reply' && ia.button_reply) {
        return {
          ...base,
          type: 'button_reply',
          buttonId: ia.button_reply.id,
          buttonTitle: ia.button_reply.title,
        };
      }
      if (ia.type === 'list_reply' && ia.list_reply) {
        return {
          ...base,
          type: 'list_reply',
          itemId: ia.list_reply.id,
          itemTitle: ia.list_reply.title,
        };
      }
      break;
    }

    case 'location':
      if (raw.location) {
        return {
          ...base,
          type: 'location',
          latitude: raw.location.latitude,
          longitude: raw.location.longitude,
          address: raw.location.address,
        };
      }
      break;
  }

  return { ...base, type: 'unsupported' };
}

export async function handleIncomingMessage(message: ParsedMessage): Promise<void> {
  const { from, phoneNumberId, displayPhoneNumber } = message;

  let session = getSession(from, phoneNumberId);

  if (!session) {
    const seller = await prisma.seller.findFirst({
      where: { whatsapp_number: displayPhoneNumber, is_active: true },
      select: { id: true, name: true, upi_id: true },
    });

    if (!seller) {
      console.warn(`[handler] No active seller for number: ${displayPhoneNumber}`);
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
