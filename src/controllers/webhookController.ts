import { Request, Response } from 'express';
import { handleIncomingMessage } from '../services/messageHandler';
import { ParsedMessage } from '../types/whatsapp';

// GET /webhook — health check (Twilio doesn't use challenge verification)
export function verifyWebhook(_req: Request, res: Response): void {
  res.sendStatus(200);
}

// POST /webhook — incoming messages from Twilio WhatsApp
export async function receiveWebhook(req: Request, res: Response): Promise<void> {
  // Respond 200 immediately so Twilio doesn't retry
  res.sendStatus(200);

  const rawFrom = req.body.From as string | undefined;
  const text = (req.body.Body as string | undefined) ?? '';
  const profileName = req.body.ProfileName as string | undefined;

  // Twilio sends From as "whatsapp:+919876543210" — strip prefix
  const from = rawFrom?.replace(/^whatsapp:\+/, '');
  if (!from) return;

  const message: ParsedMessage = {
    from,
    phoneNumberId: '',
    displayPhoneNumber: '',
    contactName: profileName,
    type: 'text',
    text,
  };

  try {
    await handleIncomingMessage(message);
  } catch (err) {
    console.error(`[webhook] Error handling message from ${from}:`, err);
  }
}
