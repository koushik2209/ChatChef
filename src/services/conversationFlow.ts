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
  const m = getMessages('en'); // greeting always in English before language is chosen
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
  const lang = message.type === 'button_reply' && message.buttonId === 'lang_hi' ? 'hi' : 'en';
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
  if (message.type !== 'list_reply') return;

  const selected = session.menuItems?.find((i) => i.id === message.itemId);
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
  if (message.type !== 'button_reply') return;

  if (message.buttonId === 'cart_add_more') {
    await sendMenu(phone, phoneNumberId, session);
    advanceStep(phone, phoneNumberId, ConversationStep.MENU);
    return;
  }

  if (message.buttonId === 'cart_checkout') {
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
  if (message.type !== 'button_reply') return;

  const isPickup = message.buttonId === 'delivery_pickup';
  const deliveryType = isPickup ? 'pickup' : 'delivery';
  const updated = upsertSession(phone, phoneNumberId, { deliveryType });

  if (isPickup) {
    await sendOrderSummary(phone, phoneNumberId, updated);
    advanceStep(phone, phoneNumberId, ConversationStep.ORDER_SUMMARY);
  } else {
    const m = getMessages(session.language);
    await wa.sendButtons(phone, phoneNumberId, m.locationBody, m.locationButtons, {
      header: m.locationHeader,
    });
    advanceStep(phone, phoneNumberId, ConversationStep.LOCATION);
  }
}

async function onLocation(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  const m = getMessages(session.language);

  // Customer chose how to share address — send the appropriate prompt and wait
  if (message.type === 'button_reply') {
    if (message.buttonId === 'loc_gps') {
      upsertSession(phone, phoneNumberId, { locationMode: 'gps' });
      await wa.sendText(phone, phoneNumberId, m.locationGpsPrompt);
    } else if (message.buttonId === 'loc_text') {
      upsertSession(phone, phoneNumberId, { locationMode: 'text' });
      await wa.sendText(phone, phoneNumberId, m.locationTextPrompt);
    }
    return; // Stay in LOCATION — wait for actual location/text
  }

  // GPS location shared
  if (message.type === 'location') {
    const location = {
      latitude: message.latitude,
      longitude: message.longitude,
      address: message.address,
    };
    const updated = upsertSession(phone, phoneNumberId, { location });
    await sendOrderSummary(phone, phoneNumberId, updated);
    advanceStep(phone, phoneNumberId, ConversationStep.ORDER_SUMMARY);
    return;
  }

  // Address typed as text (only accept if location prompt was already sent)
  if (message.type === 'text' && session.locationMode) {
    const location = { address: message.text };
    const updated = upsertSession(phone, phoneNumberId, { location });
    await sendOrderSummary(phone, phoneNumberId, updated);
    advanceStep(phone, phoneNumberId, ConversationStep.ORDER_SUMMARY);
  }
}

async function onOrderSummary(
  phone: string,
  phoneNumberId: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'button_reply') return;

  if (message.buttonId === 'summary_confirm') {
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

  if (message.buttonId === 'summary_cancel') {
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
  if (message.type !== 'button_reply') return;

  const m = getMessages(session.language);

  if (message.buttonId === 'payment_cancel') {
    await wa.sendText(phone, phoneNumberId, m.cancelled);
    clearSession(phone, phoneNumberId);
    return;
  }

  if (message.buttonId === 'payment_done') {
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

  // Group by category, max 10 rows per section (WhatsApp list limit)
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
  const locationStr =
    session.location?.address ??
    (session.location?.latitude != null
      ? `${session.location.latitude}, ${session.location.longitude}`
      : undefined);

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
  const next = cart.map((c) => ({ ...c })); // shallow clone each item
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
