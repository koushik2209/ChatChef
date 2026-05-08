import axios from 'axios';

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

const GUPSHUP_URL = 'https://api.gupshup.io/wa/api/v1/msg';
const API_KEY = process.env.GUPSHUP_API_KEY!;
const APP_NAME = process.env.GUPSHUP_APP_NAME!;
const SOURCE = process.env.CHATCHEF_NUMBER!;

async function post(to: string, message: object): Promise<void> {
  const body = new URLSearchParams({
    channel: 'whatsapp',
    source: SOURCE,
    destination: to,
    'src.name': APP_NAME,
    message: JSON.stringify(message),
  });

  await axios.post(GUPSHUP_URL, body.toString(), {
    headers: {
      apikey: API_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
}

export async function sendText(to: string, _phoneNumberId: string, text: string): Promise<void> {
  console.log('[wa] sending text to:', to);
  try {
    await post(to, { isHSM: 'false', type: 'text', text });
    console.log('[wa] sent OK');
  } catch (err) {
    console.error('[wa] Gupshup error:', err);
    throw err;
  }
}

export async function sendButtons(
  to: string,
  _phoneNumberId: string,
  body: string,
  buttons: WaButton[],
  opts: MsgOptions = {}
): Promise<void> {
  // Gupshup quick_reply supports up to 3 buttons; fall back to numbered text for more
  if (buttons.length <= 3) {
    const message: Record<string, unknown> = {
      type: 'quick_reply',
      content: {
        type: 'text',
        text: body,
      },
      options: buttons.map((b) => ({ type: 'text', title: b.title, postbackText: b.id })),
    };
    try {
      await post(to, message);
    } catch (err) {
      console.error('[wa] Gupshup sendButtons error:', err);
      throw err;
    }
  } else {
    let text = '';
    if (opts.header) text += `*${opts.header}*\n\n`;
    text += body + '\n\n';
    text += buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n');
    await sendText(to, '', text);
  }
}

export async function sendList(
  to: string,
  _phoneNumberId: string,
  body: string,
  buttonLabel: string,
  sections: ListSection[],
  opts: MsgOptions = {}
): Promise<void> {
  const message = {
    type: 'list',
    title: opts.header ?? '',
    body,
    globalButtons: [{ type: 'text', title: buttonLabel }],
    items: sections.map((sec) => ({
      title: sec.title,
      subtitle: '',
      options: sec.rows.map((row) => ({
        type: 'text',
        title: row.title,
        description: row.description ?? '',
        postbackText: row.id,
      })),
    })),
  };

  try {
    await post(to, message);
  } catch (err) {
    console.error('[wa] Gupshup sendList error:', err);
    throw err;
  }
}

export async function sendImage(
  to: string,
  _phoneNumberId: string,
  imageUrl: string,
  caption?: string
): Promise<void> {
  console.log('[wa] sending image to:', to);
  try {
    await post(to, {
      type: 'image',
      originalUrl: imageUrl,
      previewUrl: imageUrl,
      caption: caption ?? '',
    });
    console.log('[wa] image sent OK');
  } catch (err) {
    console.error('[wa] Gupshup image error:', err);
    throw err;
  }
}
