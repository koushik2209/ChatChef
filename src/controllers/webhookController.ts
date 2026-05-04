import { Request, Response } from 'express';
import { WhatsAppWebhookPayload } from '../types/whatsapp';
import { parseWebhookPayload, handleIncomingMessage } from '../services/messageHandler';

// GET /webhook — Meta hub verification handshake
export function verifyWebhook(req: Request, res: Response): void {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[webhook] Verification successful');
    res.status(200).send(challenge);
    return;
  }

  console.warn('[webhook] Verification failed — token mismatch or wrong mode');
  res.sendStatus(403);
}

// POST /webhook — incoming messages from Meta
export async function receiveWebhook(req: Request, res: Response): Promise<void> {
  // Always respond 200 immediately so Meta doesn't retry
  res.sendStatus(200);

  const body = req.body as WhatsAppWebhookPayload;

  if (body.object !== 'whatsapp_business_account') return;

  const messages = parseWebhookPayload(body);

  for (const message of messages) {
    try {
      await handleIncomingMessage(message);
    } catch (err) {
      console.error(`[webhook] Error handling message from ${message.from}:`, err);
    }
  }
}
