import axios, { AxiosError } from 'axios';

export interface WaButton {
  id: string;
  title: string;
}

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

interface MsgOptions {
  header?: string;
  footer?: string;
}

function apiUrl(phoneNumberId: string): string {
  const v = process.env.WHATSAPP_API_VERSION ?? 'v19.0';
  return `https://graph.facebook.com/${v}/${phoneNumberId}/messages`;
}

async function send(phoneNumberId: string, payload: object): Promise<void> {
  const body = { messaging_product: 'whatsapp', recipient_type: 'individual', ...payload };
  console.log('[wa] sending to:', (body as any).to, '| type:', (body as any).type);
  try {
    await axios.post(apiUrl(phoneNumberId), body, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('[wa] sent OK');
  } catch (err) {
    const e = err as AxiosError;
    console.error('[wa] API error:', JSON.stringify(e.response?.data ?? e.message));
    throw err;
  }
}

export async function sendText(to: string, phoneNumberId: string, text: string): Promise<void> {
  await send(phoneNumberId, {
    to,
    type: 'text',
    text: { body: text, preview_url: false },
  });
}

export async function sendButtons(
  to: string,
  phoneNumberId: string,
  body: string,
  buttons: WaButton[],
  opts: MsgOptions = {}
): Promise<void> {
  await send(phoneNumberId, {
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      ...(opts.header ? { header: { type: 'text', text: opts.header } } : {}),
      body: { text: body },
      ...(opts.footer ? { footer: { text: opts.footer } } : {}),
      action: {
        buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
      },
    },
  });
}

export async function sendList(
  to: string,
  phoneNumberId: string,
  body: string,
  buttonLabel: string,
  sections: ListSection[],
  opts: MsgOptions = {}
): Promise<void> {
  await send(phoneNumberId, {
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      ...(opts.header ? { header: { type: 'text', text: opts.header } } : {}),
      body: { text: body },
      ...(opts.footer ? { footer: { text: opts.footer } } : {}),
      action: { button: buttonLabel, sections },
    },
  });
}

export async function sendImage(
  to: string,
  phoneNumberId: string,
  imageUrl: string,
  caption?: string
): Promise<void> {
  await send(phoneNumberId, {
    to,
    type: 'image',
    image: { link: imageUrl, ...(caption ? { caption } : {}) },
  });
}
