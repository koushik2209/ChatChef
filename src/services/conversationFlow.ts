import prisma from '../models/prisma';
import * as wa from './whatsapp';
import { getMessages } from '../i18n/messages';
import {
  CachedMenuItem,
  CartItem,
  ConversationSession,
  ConversationStep,
  advanceStep,
  clearSession,
  upsertSession,
} from './conversationState';
import { ParsedMessage } from '../types/whatsapp';
import { findOrCreateCustomer, createOrder } from './orderService';

// ─── Entry point ────────────────────────────────────────────────────────────

export async function handleConversationStep(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (!session.sellerId || !session.upiId) {
    console.error('[flow] Session missing seller info — cannot proceed');
    return;
  }

  switch (session.step) {
    case ConversationStep.GREETING:
      return onGreeting(phone, phoneNumberId, session);
    case ConversationStep.LANGUAGE_SELECT:
      return onLanguageSelect(phone, phoneNumberId, session, message);
    case ConversationStep.MENU:
      return onMenu(phone, phoneNumberId, session, message);
    case ConversationStep.CART:
      return onCart(phone, phoneNumberId, session, message);
    case ConversationStep.DELIVERY_TYPE:
      return onDeliveryType(phone, phoneNumberId, session, message);
    case ConversationStep.LOCATION:
      return onLocation(phone, phoneNumberId, session, message);
    case ConversationStep.ORDER_SUMMARY:
      return onOrderSummary(phone, phoneNumberId, session, message);
    case ConversationStep.PAYMENT:
      return onPayment(phone, phoneNumberId, session, message);
  }
}

// ─── Step handlers ───────────────────────────────────────────────────────────

async function onGreeting(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession
): Promise<void> {
  const m = getMessages('en');
  await wa.sendButtons(
    phone,
    phoneNumberId,
    m.greeting(session.sellerName!, session.customerName),
    m.languageButtons
  );
  advanceStep(phone, phoneNumberId, ConversationStep.LANGUAGE_SELECT);
}

async function onLanguageSelect(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'text') return;
  // Button layout: 1. English  2. हिंदी
  const lang = message.text.trim() === '2' ? 'hi' : 'en';
  const menuItems = await fetchMenuItems(session.sellerId!);
  const updated = upsertSession(phone, phoneNumberId, { language: lang, menuItems });
  await sendMenu(phone, phoneNumberId, updated);
  advanceStep(phone, phoneNumberId, ConversationStep.MENU);
}

async function onMenu(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'text') return;
  const choice = parseInt(message.text.trim(), 10);
  if (isNaN(choice) || choice < 1) return;

  // Items are listed 1-based across all sections in display order
  const items = session.menuItems ?? [];
  const selected = items[choice - 1];
  if (!selected) return;

  const cart = addToCart(session.cart, selected);
  const updated = upsertSession(phone, phoneNumberId, { cart });
  await sendCartSummary(phone, phoneNumberId, updated);
  advanceStep(phone, phoneNumberId, ConversationStep.CART);
}

async function onCart(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'text') return;
  const choice = message.text.trim();

  // Button layout: 1. Add More  2. Checkout
  if (choice === '1') {
    await sendMenu(phone, phoneNumberId, session);
    advanceStep(phone, phoneNumberId, ConversationStep.MENU);
    return;
  }

  if (choice === '2') {
    const m = getMessages(session.language);
    await wa.sendButtons(phone, phoneNumberId, m.deliveryBody, m.deliveryButtons, {
      header: m.deliveryHeader,
    });
    advanceStep(phone, phoneNumberId, ConversationStep.DELIVERY_TYPE);
  }
}

async function onDeliveryType(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'text') return;
  const choice = message.text.trim();

  // Button layout: 1. Delivery  2. Pickup
  const isPickup = choice === '2';
  const deliveryType = isPickup ? 'pickup' : 'delivery';
  const updated = upsertSession(phone, phoneNumberId, { deliveryType });

  if (isPickup) {
    await sendOrderSummary(phone, phoneNumberId, updated);
    advanceStep(phone, phoneNumberId, ConversationStep.ORDER_SUMMARY);
  } else {
    const m = getMessages(session.language);
    await wa.sendText(phone, phoneNumberId, m.locationTextPrompt);
    advanceStep(phone, phoneNumberId, ConversationStep.LOCATION);
  }
}

async function onLocation(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'text' || !message.text.trim()) return;

  const location = { address: message.text.trim() };
  const updated = upsertSession(phone, phoneNumberId, { location });
  await sendOrderSummary(phone, phoneNumberId, updated);
  advanceStep(phone, phoneNumberId, ConversationStep.ORDER_SUMMARY);
}

async function onOrderSummary(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'text') return;
  const choice = message.text.trim();

  // Button layout: 1. Confirm Order  2. Cancel
  if (choice === '1') {
    const total = cartTotal(session.cart);
    const qrUrl = upiQrUrl(session.upiId!, session.sellerName!, total);
    const m = getMessages(session.language);

    await wa.sendImage(
      phone,
      phoneNumberId,
      qrUrl,
      m.paymentCaption(session.sellerName!, session.upiId!, total)
    );
    await wa.sendButtons(phone, phoneNumberId, m.paymentBody, m.paymentButtons);
    advanceStep(phone, phoneNumberId, ConversationStep.PAYMENT);
    return;
  }

  if (choice === '2') {
    const m = getMessages(session.language);
    await wa.sendText(phone, phoneNumberId, m.cancelled);
    clearSession(phone, phoneNumberId);
  }
}

async function onPayment(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'text') return;
  const choice = message.text.trim();
  const m = getMessages(session.language);

  // Button layout: 1. I've Paid  2. Cancel
  if (choice === '2') {
    await wa.sendText(phone, phoneNumberId, m.cancelled);
    clearSession(phone, phoneNumberId);
    return;
  }

  if (choice === '1') {
    const total = cartTotal(session.cart);

    const customer = await findOrCreateCustomer(
      session.sellerId!,
      phone,
      session.customerName
    );

    const order = await createOrder(session.sellerId!, customer.id, session.cart, total);

    await wa.sendText(
      phone,
      phoneNumberId,
      m.orderConfirmed(order.id, session.sellerName!, session.deliveryType ?? 'delivery')
    );

    clearSession(phone, phoneNumberId);
  }
}

// ─── Shared send helpers ─────────────────────────────────────────────────────

async function sendMenu(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession
): Promise<void> {
  const m = getMessages(session.language);
  const items = session.menuItems ?? [];

  // Group by category for display, but keep a flat ordered list for 1-based selection
  const byCategory = new Map<string, CachedMenuItem[]>();
  for (const item of items) {
    const bucket = byCategory.get(item.category) ?? [];
    bucket.push(item);
    byCategory.set(item.category, bucket);
  }

  const sections = Array.from(byCategory.entries()).map(([cat, catItems]) => ({
    title: trunc(cat, 24),
    rows: catItems.slice(0, 10).map((i) => ({
      id: i.id,
      title: trunc(i.name, 24),
      description: `₹${i.price}`,
    })),
  }));

  if (sections.length === 0) {
    await wa.sendText(phone, phoneNumberId, m.noMenuItems);
    return;
  }

  await wa.sendList(phone, phoneNumberId, m.menuBody(session.sellerName!), m.menuButton, sections, {
    header: m.menuHeader,
  });
}

async function sendCartSummary(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession
): Promise<void> {
  const m = getMessages(session.language);
  const total = cartTotal(session.cart);
  await wa.sendButtons(phone, phoneNumberId, m.cartSummary(session.cart, total), m.cartButtons);
}

async function sendOrderSummary(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession
): Promise<void> {
  const m = getMessages(session.language);
  const total = cartTotal(session.cart);
  const locationStr = session.location?.address;

  await wa.sendButtons(
    phone,
    phoneNumberId,
    m.orderSummary(session.cart, total, session.deliveryType ?? 'delivery', locationStr),
    m.orderSummaryButtons,
    { header: m.orderSummaryHeader }
  );
}

// ─── Utilities ───────────────────────────────────────────────────────────────

async function fetchMenuItems(sellerId: string): Promise<CachedMenuItem[]> {
  const rows = await prisma.menuItem.findMany({
    where: { seller_id: sellerId, is_available: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, price: true, category: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, price: Number(r.price), category: r.category }));
}

function addToCart(cart: CartItem[], item: CachedMenuItem): CartItem[] {
  const next = cart.map((c) => ({ ...c }));
  const existing = next.find((c) => c.menuItemId === item.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    next.push({ menuItemId: item.id, name: item.name, price: item.price, quantity: 1 });
  }
  return next;
}

function cartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

function upiQrUrl(upiId: string, sellerName: string, amount: number): string {
  const data = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(sellerName)}&am=${amount}&cu=INR`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(data)}`;
}

function trunc(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}
