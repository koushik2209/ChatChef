import { Request, Response } from 'express';
import { handleIncomingMessage } from '../services/messageHandler';
import { ParsedMessage } from '../types/whatsapp';

// ── Gupshup inbound webhook types ────────────────────────────────────────────

interface GupshupSender {
  phone: string;
  name?: string;
}

interface GupshupInteractive {
  type: 'button_reply' | 'list_reply';
  button_reply?: { id: string; title: string };
  list_reply?: { id: string; title: string; description?: string };
}

interface GupshupPayload {
  type: string;
  sender: GupshupSender;
  receiver?: { phone: string };
  text?: string;
  interactive?: GupshupInteractive;
}

interface GupshupWebhookBody {
  type: string;
  payload: GupshupPayload;
}

// ── Parser ────────────────────────────────────────────────────────────────────

function parseGupshupMessage(body: GupshupWebhookBody): ParsedMessage | null {
  // Ignore delivery receipts, read events, and anything else that isn't a message
  if (body?.type !== 'message') return null;

  const payload = body.payload;
  const from = payload?.sender?.phone;
  if (!from) return null;

  const displayPhoneNumber = payload.receiver?.phone ?? '';
  const contactName = payload.sender.name;
  const base = { from, phoneNumberId: '', displayPhoneNumber, contactName };

  switch (payload.type) {
    case 'text':
      return { ...base, type: 'text', text: payload.text ?? '' };

    case 'interactive': {
      const ia = payload.interactive;
      if (!ia) return { ...base, type: 'unsupported' };

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

      return { ...base, type: 'unsupported' };
    }

    default:
      return { ...base, type: 'unsupported' };
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

// GET /webhook — Gupshup doesn't require a challenge; just return 200
export function verifyWebhook(_req: Request, res: Response): void {
  res.sendStatus(200);
}

// POST /webhook — Gupshup sends JSON; always respond 200 immediately
export async function receiveWebhook(req: Request, res: Response): Promise<void> {
  res.status(200).end();

  console.log('[webhook] raw body:', JSON.stringify(req.body, null, 2));

  const message = parseGupshupMessage(req.body as GupshupWebhookBody);
  if (!message) return;

  console.log(`[webhook] ${message.type} from=${message.from} to=${message.displayPhoneNumber}`);

  try {
    await handleIncomingMessage(message);
  } catch (err) {
    console.error(`[webhook] Error handling message from ${message.from}:`, err);
  }
}
