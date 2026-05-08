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

function stripPlus(num: string): string {
  return num.startsWith('+') ? num.slice(1) : num;
}

async function post(to: string, message: object): Promise<void> {
  const source = stripPlus(SOURCE);
  const destination = stripPlus(to);
  const messageJson = JSON.stringify(message);

  console.log('[wa] POST params:', { source, destination, 'src.name': APP_NAME, message: messageJson });

  const body = new URLSearchParams({
    channel: 'whatsapp',
    source,
    destination,
    'src.name': APP_NAME,
    message: messageJson,
  });

  const resp = await axios.post(GUPSHUP_URL, body.toString(), {
    headers: {
      apikey: API_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  console.log('[wa] Gupshup response:', resp.status, JSON.stringify(resp.data));
}

export async function sendText(to: string, _phoneNumberId: string, text: string): Promise<void> {
  console.log('[wa] sending text to:', to);
  try {
    await post(to, { type: 'text', text });
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
  let text = '';
  if (opts.header) text += `*${opts.header}*\n\n`;
  text += body + '\n\n';
  text += buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n');
  await sendText(to, '', text);
}

export async function sendList(
  to: string,
  _phoneNumberId: string,
  body: string,
  _buttonLabel: string,
  sections: ListSection[],
  opts: MsgOptions = {}
): Promise<void> {
  let text = '';
  if (opts.header) text += `*${opts.header}*\n\n`;
  text += body + '\n\n';
  let i = 1;
  for (const sec of sections) {
    if (sections.length > 1) text += `*${sec.title}*\n`;
    for (const row of sec.rows) {
      text += `${i}. ${row.title}`;
      if (row.description) text += ` — ${row.description}`;
      text += '\n';
      i++;
    }
  }
  await sendText(to, '', text.trim());
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
