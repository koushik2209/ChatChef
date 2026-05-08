import { Request, Response } from 'express';
import { handleIncomingMessage } from '../services/messageHandler';
import { ParsedMessage } from '../types/whatsapp';

// ── Meta/WhatsApp Cloud API webhook types (Gupshup v3 format) ────────────────

interface MetaInteractive {
  type: 'button_reply' | 'list_reply';
  button_reply?: { id: string; title: string };
  list_reply?: { id: string; title: string; description?: string };
}

interface MetaMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  interactive?: MetaInteractive;
}

interface MetaChangeValue {
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: { profile?: { name?: string }; wa_id?: string }[];
  messages?: MetaMessage[];
}

interface MetaWebhookBody {
  object?: string;
  entry?: { changes?: { value?: MetaChangeValue; field?: string }[] }[];
}

// ── Parser ────────────────────────────────────────────────────────────────────

const CHATCHEF_NUMBER = process.env.CHATCHEF_NUMBER ?? '';

function parseGupshupMessage(body: MetaWebhookBody): ParsedMessage | null {
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  if (!value) return null;

  // Status updates have no messages array — ignore them
  const msg = value.messages?.[0];
  if (!msg) return null;

  const from = msg.from;
  if (!from) return null;

  const displayPhoneNumber = value.metadata?.display_phone_number ?? '';
  const contactName = value.contacts?.[0]?.profile?.name;

  console.log(
    `[webhook] displayPhoneNumber="${displayPhoneNumber}" CHATCHEF_NUMBER="${CHATCHEF_NUMBER}" match=${displayPhoneNumber === CHATCHEF_NUMBER}`
  );

  const base = { from, phoneNumberId: '', displayPhoneNumber, contactName };

  switch (msg.type) {
    case 'text':
      return { ...base, type: 'text', text: msg.text?.body ?? '' };

    case 'interactive': {
      const ia = msg.interactive;
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

  const message = parseGupshupMessage(req.body as MetaWebhookBody);
  if (!message) return;

  console.log(`[webhook] ${message.type} from=${message.from} to=${message.displayPhoneNumber}`);

  try {
    await handleIncomingMessage(message);
  } catch (err) {
    console.error(`[webhook] Error handling message from ${message.from}:`, err);
  }
}
