# Platform Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild ChatChef so one ChatChef WhatsApp number serves all sellers — customers are routed by slug, sellers manage menu via bot.

**Architecture:** A single `messageHandler.ts` routing layer checks every incoming DM: if the sender's phone matches a seller → seller management bot; if the message text matches a seller slug → customer ordering bot for that seller; otherwise → reject. The 8-step customer ordering flow is unchanged; a new `sellerFlow.ts` handles seller menu management.

**Tech Stack:** Node.js + Express 5 + TypeScript, Prisma 5 + PostgreSQL, Meta WhatsApp Cloud API, React 19 + Vite + Tailwind v4

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `slug String @unique` to Seller |
| `prisma/seed.js` | Modify | Add slug + fix seller phone to personal number |
| `src/services/conversationState.ts` | Modify | Add seller management steps + `sellerDraft` to session |
| `src/services/sellerFlow.ts` | **Create** | Seller management bot (add menu items) |
| `src/services/messageHandler.ts` | Modify | Platform routing: seller vs customer vs unknown |
| `src/controllers/authController.ts` | Modify | Add `register` handler with slug generation |
| `src/routes/auth.ts` | Modify | Add `POST /auth/register` (no auth) |
| `src/routes/index.ts` | Modify | Remove temporary `/seed` endpoint |
| `dashboard/src/api/auth.ts` | Modify | Add `register()` API call |
| `dashboard/src/pages/Register.tsx` | **Create** | Public registration form page |
| `dashboard/src/App.tsx` | Modify | Add public `/register` route |
| `dashboard/src/pages/Home.tsx` | Modify | Show seller's shareable WhatsApp link |

---

## Task 1: Add `slug` to Seller schema and seed

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.js`

- [ ] **Step 1: Add slug field to schema**

Edit `prisma/schema.prisma` — add `slug` after `upi_id` in the Seller model:

```prisma
model Seller {
  id               String     @id @default(cuid())
  name             String
  whatsapp_number  String     @unique
  upi_id           String
  slug             String     @unique
  is_active        Boolean    @default(true)
  created_at       DateTime   @default(now())
  updated_at       DateTime   @updatedAt

  menu_items       MenuItem[]
  customers        Customer[]
  orders           Order[]
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-seller-slug
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 3: Update seed.js**

Replace the entire `prisma/seed.js` with:

```js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const seller = await prisma.seller.upsert({
    where: { whatsapp_number: '919999999999' },
    update: {},
    create: {
      name: 'Priya Home Kitchen',
      whatsapp_number: '919999999999',
      upi_id: 'priya@upi',
      slug: 'test1',
      is_active: true,
    },
  });

  console.log(`Seller: ${seller.name} (slug: ${seller.slug})`);

  const menuItems = [
    { name: 'Butter Chicken',  price: 180, original_price: 220, category: 'Main Course', image_url: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400' },
    { name: 'Dal Tadka',        price: 120, original_price: null, category: 'Main Course', image_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400' },
    { name: 'Jeera Rice',       price:  80, original_price: null, category: 'Rice',        image_url: 'https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=400' },
    { name: 'Samosa (2 pcs)',   price:  40, original_price:  50, category: 'Snacks',      image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400' },
    { name: 'Mango Lassi',      price:  60, original_price: null, category: 'Drinks',     image_url: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400' },
  ];

  await prisma.menuItem.deleteMany({ where: { seller_id: seller.id } });
  await prisma.menuItem.createMany({
    data: menuItems.map((item) => ({ ...item, seller_id: seller.id, is_available: true })),
  });

  console.log(`Seeded ${menuItems.length} menu items.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

Note: `whatsapp_number` is now the seller's **personal** phone (used to identify them when they DM the bot), not the bot's number. The bot's number comes from `WHATSAPP_PHONE_NUMBER_ID` env var.

- [ ] **Step 4: Run seed to verify**

```bash
node prisma/seed.js
```

Expected output:
```
Seller: Priya Home Kitchen (slug: test1)
Seeded 5 menu items.
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/seed.js
git commit -m "feat: add slug field to Seller model"
```

---

## Task 2: Add seller management steps to conversationState.ts

**Files:**
- Modify: `src/services/conversationState.ts`

- [ ] **Step 1: Add seller steps to ConversationStep enum and SellerItemDraft interface**

Replace the entire file:

```ts
export enum ConversationStep {
  // Customer ordering steps
  GREETING = 'GREETING',
  LANGUAGE_SELECT = 'LANGUAGE_SELECT',
  MENU = 'MENU',
  CART = 'CART',
  DELIVERY_TYPE = 'DELIVERY_TYPE',
  LOCATION = 'LOCATION',
  ORDER_SUMMARY = 'ORDER_SUMMARY',
  PAYMENT = 'PAYMENT',
  // Seller management steps
  SELLER_GREETING = 'SELLER_GREETING',
  SELLER_ADD_NAME = 'SELLER_ADD_NAME',
  SELLER_ADD_CATEGORY = 'SELLER_ADD_CATEGORY',
  SELLER_ADD_PRICE = 'SELLER_ADD_PRICE',
  SELLER_ADD_IMAGE = 'SELLER_ADD_IMAGE',
  SELLER_CONFIRM = 'SELLER_CONFIRM',
}

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CachedMenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
}

export interface SellerItemDraft {
  name?: string;
  category?: string;
  price?: number;
  image_url?: string;
}

export interface ConversationSession {
  step: ConversationStep;
  phoneNumberId: string;
  displayPhoneNumber: string;
  sellerId: string | undefined;
  sellerName: string | undefined;
  upiId: string | undefined;
  language: 'en' | 'hi';
  customerName: string | undefined;
  cart: CartItem[];
  menuItems: CachedMenuItem[] | undefined;
  deliveryType: 'delivery' | 'pickup' | undefined;
  location: { latitude?: number; longitude?: number; address?: string } | undefined;
  locationMode: 'gps' | 'text' | undefined;
  sellerDraft: SellerItemDraft | undefined;
  lastUpdated: Date;
}

const sessions = new Map<string, ConversationSession>();

function sessionKey(customerPhone: string, phoneNumberId: string): string {
  return `${customerPhone}:${phoneNumberId}`;
}

export function getSession(
  customerPhone: string,
  phoneNumberId: string
): ConversationSession | undefined {
  return sessions.get(sessionKey(customerPhone, phoneNumberId));
}

export function upsertSession(
  customerPhone: string,
  phoneNumberId: string,
  updates: Partial<ConversationSession>
): ConversationSession {
  const existing = sessions.get(sessionKey(customerPhone, phoneNumberId));
  const session: ConversationSession = {
    step: ConversationStep.GREETING,
    phoneNumberId,
    displayPhoneNumber: '',
    sellerId: undefined,
    sellerName: undefined,
    upiId: undefined,
    language: 'en',
    customerName: undefined,
    cart: [],
    menuItems: undefined,
    deliveryType: undefined,
    location: undefined,
    locationMode: undefined,
    sellerDraft: undefined,
    ...existing,
    ...updates,
    lastUpdated: new Date(),
  };
  sessions.set(sessionKey(customerPhone, phoneNumberId), session);
  return session;
}

export function advanceStep(
  customerPhone: string,
  phoneNumberId: string,
  step: ConversationStep
): void {
  const session = sessions.get(sessionKey(customerPhone, phoneNumberId));
  if (session) {
    session.step = step;
    session.lastUpdated = new Date();
  }
}

export function clearSession(customerPhone: string, phoneNumberId: string): void {
  sessions.delete(sessionKey(customerPhone, phoneNumberId));
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/conversationState.ts
git commit -m "feat: add seller management steps to conversation state"
```

---

## Task 3: Create sellerFlow.ts

**Files:**
- Create: `src/services/sellerFlow.ts`

- [ ] **Step 1: Create the file**

```ts
import prisma from '../models/prisma';
import * as wa from './whatsapp';
import {
  ConversationSession,
  ConversationStep,
  SellerItemDraft,
  advanceStep,
  clearSession,
  upsertSession,
} from './conversationState';
import { ParsedMessage } from '../types/whatsapp';

export async function handleSellerStep(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  switch (session.step) {
    case ConversationStep.SELLER_GREETING:
      return onSellerGreeting(phone, phoneNumberId, session, message);
    case ConversationStep.SELLER_ADD_NAME:
      return onSellerAddName(phone, phoneNumberId, session, message);
    case ConversationStep.SELLER_ADD_CATEGORY:
      return onSellerAddCategory(phone, phoneNumberId, session, message);
    case ConversationStep.SELLER_ADD_PRICE:
      return onSellerAddPrice(phone, phoneNumberId, session, message);
    case ConversationStep.SELLER_ADD_IMAGE:
      return onSellerAddImage(phone, phoneNumberId, session, message);
    case ConversationStep.SELLER_CONFIRM:
      return onSellerConfirm(phone, phoneNumberId, session, message);
  }
}

// SELLER_GREETING handles both the initial greeting (any message type)
// and the "Add Item" / "Done" button replies that come back after greeting.
async function onSellerGreeting(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type === 'button_reply') {
    if (message.buttonId === 'seller_done') {
      await wa.sendText(phone, phoneNumberId, '👍 All done! Your menu is up to date.');
      clearSession(phone, phoneNumberId);
      return;
    }
    if (message.buttonId === 'seller_add_item') {
      await wa.sendText(phone, phoneNumberId, "What's the item name?");
      advanceStep(phone, phoneNumberId, ConversationStep.SELLER_ADD_NAME);
      return;
    }
  }

  // Any non-button message (first DM or unknown input) → send the greeting
  const count = await prisma.menuItem.count({ where: { seller_id: session.sellerId! } });
  await wa.sendButtons(
    phone,
    phoneNumberId,
    `👋 Welcome back, *${session.sellerName}*!\n\nYou have *${count}* item${count !== 1 ? 's' : ''} on your menu.\n\nWould you like to add a new item?`,
    [
      { id: 'seller_add_item', title: 'Add Item' },
      { id: 'seller_done', title: 'Done' },
    ]
  );
}

async function onSellerAddName(
  phone: string,
  phoneNumberId: string,
  _session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'text' || !message.text.trim()) return;
  upsertSession(phone, phoneNumberId, { sellerDraft: { name: message.text.trim() } });
  await wa.sendText(
    phone,
    phoneNumberId,
    '📁 What category does this item belong to?\n\nExamples: Main Course, Snacks, Drinks, Rice, Desserts'
  );
  advanceStep(phone, phoneNumberId, ConversationStep.SELLER_ADD_CATEGORY);
}

async function onSellerAddCategory(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'text' || !message.text.trim()) return;
  upsertSession(phone, phoneNumberId, {
    sellerDraft: { ...session.sellerDraft, category: message.text.trim() },
  });
  await wa.sendText(phone, phoneNumberId, '💰 What is the price? (numbers only, in ₹)\n\nExample: 150');
  advanceStep(phone, phoneNumberId, ConversationStep.SELLER_ADD_PRICE);
}

async function onSellerAddPrice(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'text') return;
  const price = parseFloat(message.text.trim());
  if (isNaN(price) || price <= 0) {
    await wa.sendText(phone, phoneNumberId, '⚠️ Please enter a valid price (numbers only, e.g. 150)');
    return;
  }
  upsertSession(phone, phoneNumberId, { sellerDraft: { ...session.sellerDraft, price } });
  await wa.sendButtons(
    phone,
    phoneNumberId,
    '🖼️ Do you have an image URL for this item?\n\nPaste the URL or tap Skip.',
    [{ id: 'seller_skip_image', title: 'Skip' }]
  );
  advanceStep(phone, phoneNumberId, ConversationStep.SELLER_ADD_IMAGE);
}

async function onSellerAddImage(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  let draft: SellerItemDraft = { ...session.sellerDraft };

  if (message.type === 'button_reply' && message.buttonId === 'seller_skip_image') {
    // no image — proceed with draft as-is
  } else if (message.type === 'text' && message.text.trim()) {
    draft = { ...draft, image_url: message.text.trim() };
  } else {
    return;
  }

  const updated = upsertSession(phone, phoneNumberId, { sellerDraft: draft });
  await sendConfirmSummary(phone, phoneNumberId, updated.sellerDraft!);
  advanceStep(phone, phoneNumberId, ConversationStep.SELLER_CONFIRM);
}

async function onSellerConfirm(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'button_reply') return;

  if (message.buttonId === 'seller_start_over') {
    upsertSession(phone, phoneNumberId, { sellerDraft: undefined });
    await wa.sendText(phone, phoneNumberId, "No problem! Let's start over.\n\nWhat's the item name?");
    advanceStep(phone, phoneNumberId, ConversationStep.SELLER_ADD_NAME);
    return;
  }

  if (message.buttonId === 'seller_confirm_item') {
    const draft = session.sellerDraft!;
    await prisma.menuItem.create({
      data: {
        seller_id: session.sellerId!,
        name: draft.name!,
        category: draft.category!,
        price: draft.price!,
        image_url: draft.image_url ?? null,
        is_available: true,
      },
    });

    upsertSession(phone, phoneNumberId, { sellerDraft: undefined });
    advanceStep(phone, phoneNumberId, ConversationStep.SELLER_GREETING);
    await wa.sendButtons(
      phone,
      phoneNumberId,
      `✅ *${draft.name}* added to your menu!\n\nWould you like to add another item?`,
      [
        { id: 'seller_add_item', title: 'Add Another' },
        { id: 'seller_done', title: 'Done' },
      ]
    );
  }
}

async function sendConfirmSummary(
  phone: string,
  phoneNumberId: string,
  draft: SellerItemDraft
): Promise<void> {
  const summary = `📋 *Item Summary*\n\n*Name:* ${draft.name}\n*Category:* ${draft.category}\n*Price:* ₹${draft.price}${draft.image_url ? '\n*Image:* ✓' : ''}`;
  await wa.sendButtons(phone, phoneNumberId, summary, [
    { id: 'seller_confirm_item', title: 'Confirm' },
    { id: 'seller_start_over', title: 'Start Over' },
  ]);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/sellerFlow.ts
git commit -m "feat: add seller management bot flow"
```

---

## Task 4: Refactor messageHandler.ts for platform routing

**Files:**
- Modify: `src/services/messageHandler.ts`

- [ ] **Step 1: Replace messageHandler.ts**

```ts
import {
  WhatsAppWebhookPayload,
  WhatsAppRawMessage,
  WhatsAppContact,
  ParsedMessage,
} from '../types/whatsapp';
import { getSession, upsertSession, ConversationStep } from './conversationState';
import { handleConversationStep } from './conversationFlow';
import { handleSellerStep } from './sellerFlow';
import * as wa from './whatsapp';
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/messageHandler.ts
git commit -m "feat: platform routing — seller vs customer vs unknown in messageHandler"
```

---

## Task 5: Remove temporary /api/seed endpoint

**Files:**
- Modify: `src/routes/index.ts`

- [ ] **Step 1: Remove the seed endpoint**

Replace `src/routes/index.ts` with:

```ts
import { Router } from 'express';
import webhookRouter from './webhook';
import authRouter from './auth';
import ordersRouter from './orders';
import menuRouter from './menu';
import customersRouter from './customers';
import paymentsRouter from './payments';
import dashboardRouter from './dashboard';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'ChatChef API is running' });
});

router.use('/webhook', webhookRouter);
router.use('/auth', authRouter);
router.use('/orders', ordersRouter);
router.use('/menu', menuRouter);
router.use('/customers', customersRouter);
router.use('/payments', paymentsRouter);
router.use('/dashboard', dashboardRouter);

export default router;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/index.ts
git commit -m "chore: remove temporary /api/seed endpoint"
```

---

## Task 6: Add seller registration endpoint

**Files:**
- Modify: `src/controllers/authController.ts`
- Modify: `src/routes/auth.ts`

- [ ] **Step 1: Add register handler to authController.ts**

Replace the entire `src/controllers/authController.ts`:

```ts
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../models/prisma';
import { generateOtp, verifyOtp } from '../services/authService';

// ── OTP login ────────────────────────────────────────────────────────────────

export async function requestOtp(req: Request, res: Response): Promise<void> {
  const { phone } = req.body as { phone?: string };

  if (!phone) {
    res.status(400).json({ success: false, message: 'phone is required' });
    return;
  }

  const seller = await prisma.seller.findUnique({ where: { whatsapp_number: phone } });
  if (!seller) {
    res.json({ success: true, message: 'OTP sent if number is registered' });
    return;
  }

  const otp = generateOtp(phone);
  console.log(`[auth] OTP for ${phone}: ${otp}`);

  res.json({ success: true, message: 'OTP sent if number is registered' });
}

export async function verifyOtpHandler(req: Request, res: Response): Promise<void> {
  const { phone, otp } = req.body as { phone?: string; otp?: string };

  if (!phone || !otp) {
    res.status(400).json({ success: false, message: 'phone and otp are required' });
    return;
  }

  if (!verifyOtp(phone, otp)) {
    res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    return;
  }

  const seller = await prisma.seller.findUnique({ where: { whatsapp_number: phone } });
  if (!seller || !seller.is_active) {
    res.status(401).json({ success: false, message: 'Seller not found or inactive' });
    return;
  }

  const token = jwt.sign(
    { sellerId: seller.id, phone: seller.whatsapp_number },
    process.env.JWT_SECRET ?? 'changeme',
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    data: {
      token,
      seller: {
        id: seller.id,
        name: seller.name,
        whatsapp_number: seller.whatsapp_number,
        upi_id: seller.upi_id,
        slug: seller.slug,
      },
    },
  });
}

// ── Registration ─────────────────────────────────────────────────────────────

function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function generateUniqueSlug(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const slug = generateSlug();
    const existing = await prisma.seller.findUnique({ where: { slug } });
    if (!existing) return slug;
  }
  throw new Error('Could not generate unique slug after 10 attempts');
}

export async function register(req: Request, res: Response): Promise<void> {
  const { name, whatsapp_number, upi_id } = req.body as {
    name?: string;
    whatsapp_number?: string;
    upi_id?: string;
  };

  if (!name || !whatsapp_number || !upi_id) {
    res.status(400).json({ success: false, message: 'name, whatsapp_number, and upi_id are required' });
    return;
  }

  const existing = await prisma.seller.findUnique({ where: { whatsapp_number } });
  if (existing) {
    res.status(409).json({ success: false, message: 'This WhatsApp number is already registered' });
    return;
  }

  const slug = await generateUniqueSlug();

  const seller = await prisma.seller.create({
    data: { name, whatsapp_number, upi_id, slug, is_active: true },
  });

  res.status(201).json({
    success: true,
    data: {
      id: seller.id,
      name: seller.name,
      whatsapp_number: seller.whatsapp_number,
      upi_id: seller.upi_id,
      slug: seller.slug,
    },
  });
}
```

- [ ] **Step 2: Add register route to auth.ts**

Replace `src/routes/auth.ts`:

```ts
import { Router } from 'express';
import { requestOtp, verifyOtpHandler, register } from '../controllers/authController';

const router = Router();

router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtpHandler);
router.post('/register', register);

export default router;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Smoke-test the endpoint locally**

Start the dev server (`npm run dev`), then in a separate terminal:

```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Shop","whatsapp_number":"911234567890","upi_id":"test@upi"}' | cat
```

Expected response:
```json
{"success":true,"data":{"id":"...","name":"Test Shop","whatsapp_number":"911234567890","upi_id":"test@upi","slug":"xxxxx"}}
```

- [ ] **Step 5: Commit**

```bash
git add src/controllers/authController.ts src/routes/auth.ts
git commit -m "feat: add POST /api/auth/register with auto-generated slug"
```

---

## Task 7: Add slug to Seller type + register API call in frontend

**Files:**
- Modify: `dashboard/src/types/index.ts`
- Modify: `dashboard/src/api/auth.ts`

- [ ] **Step 1: Add slug to Seller type**

In `dashboard/src/types/index.ts`, update the `Seller` interface:

```ts
export interface Seller {
  id: string;
  name: string;
  whatsapp_number: string;
  upi_id: string;
  slug: string;
}
```

- [ ] **Step 2: Add register API call**

Replace `dashboard/src/api/auth.ts`:

```ts
import { api } from '../lib/axios';
import type { Seller } from '../types';

export async function requestOtp(phone: string): Promise<void> {
  await api.post('/auth/request-otp', { phone });
}

export async function verifyOtp(phone: string, otp: string): Promise<{ token: string; seller: Seller }> {
  const res = await api.post('/auth/verify-otp', { phone, otp });
  return res.data.data;
}

export interface RegisterInput {
  name: string;
  whatsapp_number: string;
  upi_id: string;
}

export async function registerSeller(data: RegisterInput): Promise<{ slug: string; name: string }> {
  const res = await api.post('/auth/register', data);
  return res.data.data;
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/types/index.ts dashboard/src/api/auth.ts
git commit -m "feat: add slug to Seller type and registerSeller API call"
```

---

## Task 8: Create Register page

**Files:**
- Create: `dashboard/src/pages/Register.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ChefHat, Copy, Check } from 'lucide-react';
import { registerSeller } from '../api/auth';
import Spinner from '../components/Spinner';

const WA_NUMBER = import.meta.env.VITE_CHATCHEF_WA_NUMBER ?? '';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', whatsapp_number: '', upi_id: '' });
  const [slug, setSlug] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof typeof form, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  const mutation = useMutation({
    mutationFn: () => registerSeller(form),
    onSuccess: (data) => { setSlug(data.slug); setError(''); },
    onError: (err: any) => setError(err.response?.data?.message ?? 'Registration failed. Try again.'),
  });

  const link = `https://wa.me/${WA_NUMBER}?text=${slug}`;

  function copyLink() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const valid = form.name && form.whatsapp_number && form.upi_id;

  if (slug) {
    return (
      <div className="min-h-dvh bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#25D366]/10 mb-4">
              <ChefHat size={32} color="#25D366" />
            </div>
            <h1 className="text-2xl font-bold text-white">You're registered! 🎉</h1>
            <p className="text-[#888] text-sm mt-1">Share this link with your customers</p>
          </div>

          <div className="bg-[#111111] border border-[#262626] rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-xs text-[#888] mb-2">Your order link</p>
              <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#333] rounded-xl px-3 py-2.5">
                <span className="text-[#25D366] text-sm flex-1 truncate">{link}</span>
                <button onClick={copyLink} className="text-[#888] hover:text-white shrink-0">
                  {copied ? <Check size={16} color="#25D366" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-3">
              <p className="text-xs text-[#888] mb-1">Next step</p>
              <p className="text-sm text-white">DM <span className="text-[#25D366] font-medium">+{WA_NUMBER}</span> from your WhatsApp to add your menu items.</p>
            </div>

            <button
              onClick={() => navigate('/login')}
              className="w-full bg-[#25D366] hover:bg-[#1ea855] text-white font-semibold rounded-xl py-3 text-sm transition-colors"
            >
              Go to Dashboard Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#25D366]/10 mb-4">
            <ChefHat size={32} color="#25D366" />
          </div>
          <h1 className="text-2xl font-bold text-white">Join ChatChef</h1>
          <p className="text-[#888] text-sm mt-1">Start selling food via WhatsApp</p>
        </div>

        <div className="bg-[#111111] border border-[#262626] rounded-2xl p-6 space-y-4">
          {[
            { label: 'Shop / Your Name', key: 'name' as const, placeholder: 'Priya Home Kitchen', type: 'text' },
            { label: 'WhatsApp Number', key: 'whatsapp_number' as const, placeholder: '919876543210', type: 'tel' },
            { label: 'UPI ID', key: 'upi_id' as const, placeholder: 'yourname@upi', type: 'text' },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key}>
              <label className="block text-xs text-[#888] font-medium mb-1.5">{label}</label>
              <input
                type={type}
                placeholder={placeholder}
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-3 py-3 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#25D366] transition-colors"
              />
            </div>
          ))}

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            onClick={() => mutation.mutate()}
            disabled={!valid || mutation.isPending}
            className="w-full bg-[#25D366] hover:bg-[#1ea855] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {mutation.isPending ? <Spinner size={16} /> : null}
            Register
          </button>

          <button
            onClick={() => navigate('/login')}
            className="w-full text-[#888] text-sm py-1 hover:text-white transition-colors"
          >
            Already registered? Login →
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/pages/Register.tsx
git commit -m "feat: add seller registration page"
```

---

## Task 9: Wire up /register route and update Home page

**Files:**
- Modify: `dashboard/src/App.tsx`
- Modify: `dashboard/src/pages/Home.tsx`

- [ ] **Step 1: Add /register to App.tsx**

Replace `dashboard/src/App.tsx`:

```tsx
import { type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { queryClient } from './lib/queryClient';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Orders from './pages/Orders';
import Menu from './pages/Menu';
import CookingSummary from './pages/CookingSummary';
import Payments from './pages/Payments';

function Guard({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/"         element={<Guard><Home /></Guard>} />
        <Route path="/orders"   element={<Guard><Orders /></Guard>} />
        <Route path="/menu"     element={<Guard><Menu /></Guard>} />
        <Route path="/cooking"  element={<Guard><CookingSummary /></Guard>} />
        <Route path="/payments" element={<Guard><Payments /></Guard>} />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Show shareable link on Home page**

Replace `dashboard/src/pages/Home.tsx`:

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, ShoppingBag, Clock, LogOut, RefreshCw, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchSummary } from '../api/dashboard';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import Spinner from '../components/Spinner';

const WA_NUMBER = import.meta.env.VITE_CHATCHEF_WA_NUMBER ?? '';

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function Home() {
  const { seller, logout } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchSummary,
    refetchInterval: 60_000,
  });

  const today = data?.today;
  const link = seller?.slug ? `https://wa.me/${WA_NUMBER}?text=${seller.slug}` : '';

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Layout
      title="ChatChef"
      action={
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="text-[#888] hover:text-white transition-colors p-1">
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { logout(); navigate('/login', { replace: true }); }}
            className="text-[#888] hover:text-white transition-colors p-1"
          >
            <LogOut size={16} />
          </button>
        </div>
      }
    >
      <div className="p-4 space-y-6">
        {/* Greeting */}
        <div>
          <p className="text-[#888] text-sm">Good day,</p>
          <h2 className="text-xl font-bold text-white">{seller?.name ?? 'Chef'} 👋</h2>
        </div>

        {/* Shareable link */}
        {link && (
          <div className="bg-[#111111] border border-[#25D366]/30 rounded-2xl p-4">
            <p className="text-xs text-[#25D366] font-medium mb-2">Your customer order link</p>
            <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#333] rounded-xl px-3 py-2.5">
              <span className="text-sm text-white flex-1 truncate">{link}</span>
              <button onClick={copyLink} className="text-[#888] hover:text-white shrink-0">
                {copied ? <Check size={15} color="#25D366" /> : <Copy size={15} />}
              </button>
            </div>
          </div>
        )}

        {/* Stat cards */}
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner size={32} /></div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Today's Orders"
              value={today?.total_orders ?? 0}
              sub={`${today?.active_orders ?? 0} active`}
              icon={<ShoppingBag size={16} color="#25D366" />}
              accent
            />
            <StatCard
              label="Revenue"
              value={fmt(today?.revenue ?? 0)}
              sub="from paid orders"
              icon={<TrendingUp size={16} color="#25D366" />}
              accent
            />
            <div className="col-span-2">
              <StatCard
                label="Pending Payments"
                value={today?.pending_payments_count ?? 0}
                sub={today?.pending_payments_amount ? `${fmt(today.pending_payments_amount)} outstanding` : 'All clear'}
                icon={<Clock size={16} color={today?.pending_payments_count ? '#f59e0b' : '#25D366'} />}
              />
            </div>
          </div>
        )}

        {/* Order breakdown */}
        {today && (
          <div className="bg-[#111111] border border-[#262626] rounded-2xl p-4">
            <h3 className="text-xs text-[#888] uppercase tracking-wider font-medium mb-3">Order Breakdown</h3>
            <div className="space-y-2">
              {Object.entries(today.orders_by_status)
                .filter(([, count]) => count > 0)
                .map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <span className="text-[#aaa] capitalize">{status.toLowerCase()}</span>
                    <span className="font-semibold text-white">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="bg-[#111111] border border-[#262626] rounded-2xl p-4">
          <h3 className="text-xs text-[#888] uppercase tracking-wider font-medium mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'View Orders',  path: '/orders'   },
              { label: 'Cooking List', path: '/cooking'  },
              { label: 'Manage Menu',  path: '/menu'     },
              { label: 'Payments',     path: '/payments' },
            ].map(({ label, path }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="bg-[#1a1a1a] hover:bg-[#222] border border-[#333] rounded-xl py-2.5 text-sm text-white transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
```

- [ ] **Step 3: Add VITE_CHATCHEF_WA_NUMBER to dashboard .env.production**

Edit `dashboard/.env.production` — add:

```
VITE_CHATCHEF_WA_NUMBER=15551571828
```

Replace `15551571828` with your actual ChatChef WhatsApp number.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd dashboard && npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/App.tsx dashboard/src/pages/Home.tsx dashboard/.env.production
git commit -m "feat: add /register route and shareable link on Home page"
```

---

## Task 10: Push and redeploy

- [ ] **Step 1: Push all commits**

```bash
git push
```

- [ ] **Step 2: Trigger Railway migration on the live DB**

Since Railway's start command runs `npx prisma db push`, the new `slug` column will be added automatically on next deploy. Watch the Railway deploy logs to confirm.

- [ ] **Step 3: Re-seed the live DB with the updated seed (includes slug)**

In Railway → ChatChef service → Shell:

```bash
node prisma/seed.js
```

Expected:
```
Seller: Priya Home Kitchen (slug: test1)
Seeded 5 menu items.
```

- [ ] **Step 4: Set CHATCHEF_WA_NUMBER env var in Railway**

In Railway → ChatChef service → Variables, add:

```
CHATCHEF_WA_NUMBER=15551571828
```

(The backend doesn't use this directly — it's only needed if you want to return it from the API in future. The frontend reads `VITE_CHATCHEF_WA_NUMBER` from `.env.production` at build time.)

- [ ] **Step 5: Verify live endpoints**

```bash
# Health check
curl https://chatchef-production.up.railway.app/api/health

# Register a test seller
curl -s -X POST https://chatchef-production.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Shop","whatsapp_number":"910000000001","upi_id":"test@upi"}' | cat
```

Expected: `{"success":true,"data":{...,"slug":"xxxxx"}}`
