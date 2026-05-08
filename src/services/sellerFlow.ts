import prisma from '../models/prisma';
import * as wa from './whatsapp';
import {
  ConversationSession,
  ConversationStep,
  SellerOnboardingDraft,
  advanceStep,
  clearSession,
  getSession,
  upsertSession,
} from './conversationState';
import { ParsedMessage } from '../types/whatsapp';

// ── Entry point ──────────────────────────────────────────────────────────────

export async function handleSellerMessage(
  phone: string,
  phoneNumberId: string,
  message: ParsedMessage
): Promise<void> {
  // Use displayPhoneNumber (ChatChef's number) as the session key discriminator
  // so seller sessions never collide with customer sessions for the same phone.
  const sid = message.displayPhoneNumber;

  let session = getSession(phone, sid);

  if (!session) {
    const seller = await prisma.seller.findFirst({
      where: { whatsapp_number: phone, is_active: true },
      select: { id: true, name: true, upi_id: true },
    });

    session = seller
      ? upsertSession(phone, sid, {
          step: ConversationStep.SELLER_MAIN_MENU,
          sellerId: seller.id,
          sellerName: seller.name,
          upiId: seller.upi_id,
        })
      : upsertSession(phone, sid, { step: ConversationStep.SELLER_ONBOARD_WELCOME });
  }

  if (message.type === 'unsupported') return;

  switch (session.step) {
    case ConversationStep.SELLER_ONBOARD_WELCOME:  return onOnboardWelcome(phone, sid, session, message);
    case ConversationStep.SELLER_ONBOARD_NAME:     return onOnboardName(phone, sid, session, message);
    case ConversationStep.SELLER_ONBOARD_UPI:      return onOnboardUpi(phone, sid, session, message);
    case ConversationStep.SELLER_ONBOARD_PHONE:    return onOnboardPhone(phone, sid, session, message);
    case ConversationStep.SELLER_MAIN_MENU:        return onMainMenu(phone, sid, session, message);
    case ConversationStep.SELLER_ADD_ITEM_NAME:    return onAddItemName(phone, sid, session, message);
    case ConversationStep.SELLER_ADD_ITEM_PRICE:   return onAddItemPrice(phone, sid, session, message);
    case ConversationStep.SELLER_ADD_ITEM_IMAGE:   return onAddItemImage(phone, sid, session, message);
    case ConversationStep.SELLER_AFTER_ADD:        return onAfterAdd(phone, sid, session, message);
    case ConversationStep.SELLER_REMOVE_SELECT:    return onRemoveSelect(phone, sid, session, message);
    case ConversationStep.SELLER_REMOVE_CONFIRM:   return onRemoveConfirm(phone, sid, session, message);
    case ConversationStep.SELLER_AFTER_VIEW:       return onAfterView(phone, sid, session, message);
  }
}

// ── FLOW 1: Onboarding ───────────────────────────────────────────────────────

async function onOnboardWelcome(
  phone: string,
  sid: string,
  _session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  const choice = message.type === 'text' ? message.text.trim() : '';

  if (choice === '1') {
    await wa.sendText(phone, '', "Great! Let's set up your store. 🚀\n\nWhat's your *shop name*?");
    advanceStep(phone, sid, ConversationStep.SELLER_ONBOARD_NAME);
    return;
  }

  if (choice === '2') {
    await wa.sendText(
      phone,
      '',
      '🍽️ *ChatChef* lets you take food orders over WhatsApp — no app needed for your customers.\n\n' +
        'Share your unique link, and customers browse your menu and order instantly.\n\n' +
        'Setup takes under 2 minutes!'
    );
  }

  // First contact or Learn More → show welcome buttons
  await wa.sendButtons(
    phone,
    '',
    'Welcome to *ChatChef*! 🍽️\n\nStart selling food via WhatsApp in minutes.',
    [
      { id: 'onboard_setup', title: '🚀 Setup My Store' },
      { id: 'onboard_learn', title: '❓ Learn More' },
    ]
  );
}

async function onOnboardName(
  phone: string,
  sid: string,
  _session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'text' || !message.text.trim()) return;
  upsertSession(phone, sid, { sellerOnboardDraft: { shopName: message.text.trim() } });
  await wa.sendText(phone, '', "💳 What's your *UPI ID*?\n\nExample: yourname@upi");
  advanceStep(phone, sid, ConversationStep.SELLER_ONBOARD_UPI);
}

async function onOnboardUpi(
  phone: string,
  sid: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'text' || !message.text.trim()) return;
  upsertSession(phone, sid, {
    sellerOnboardDraft: { ...(session.sellerOnboardDraft ?? {}), upiId: message.text.trim() },
  });
  await wa.sendText(
    phone,
    '',
    '📱 What\'s your *WhatsApp Business number*?\n\n_(include country code, e.g. 919876543210)_'
  );
  advanceStep(phone, sid, ConversationStep.SELLER_ONBOARD_PHONE);
}

async function onOnboardPhone(
  phone: string,
  sid: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'text' || !message.text.trim()) return;

  const waNumber = message.text.trim().replace(/\D/g, '');
  if (waNumber.length < 10) {
    await wa.sendText(phone, '', '⚠️ Please enter a valid number with country code (e.g. 919876543210)');
    return;
  }

  const draft = session.sellerOnboardDraft ?? {};
  if (!draft.shopName || !draft.upiId) {
    await wa.sendText(phone, '', '⚠️ Something went wrong. Please start over.');
    clearSession(phone, sid);
    return;
  }

  const existing = await prisma.seller.findUnique({ where: { whatsapp_number: waNumber } });
  if (existing) {
    await wa.sendText(
      phone,
      '',
      '⚠️ That WhatsApp number is already registered.\n\nLogin at: https://chatchef.app/login'
    );
    clearSession(phone, sid);
    return;
  }

  const slug = await generateUniqueSlug();
  if (!slug) {
    await wa.sendText(phone, '', '⚠️ Registration failed. Please try again.');
    return;
  }

  await prisma.seller.create({
    data: {
      name: draft.shopName,
      whatsapp_number: waNumber,
      upi_id: draft.upiId,
      slug,
      is_active: true,
    },
  });

  await wa.sendText(
    phone,
    '',
    `✅ *Your store is live!*\n\n` +
      `Shop: *${draft.shopName}*\n` +
      `Order slug: *${slug}*\n\n` +
      `Login and manage your menu at:\nhttps://chatchef.app/login 🚀`
  );

  clearSession(phone, sid);
}

// ── FLOW 2: Menu management ──────────────────────────────────────────────────

async function onMainMenu(
  phone: string,
  sid: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  const choice = message.type === 'text' ? message.text.trim() : '';

  if (choice === '1') {
    await wa.sendText(phone, '', '📝 Enter item name:');
    advanceStep(phone, sid, ConversationStep.SELLER_ADD_ITEM_NAME);
    return;
  }

  if (choice === '2') {
    await startRemoveFlow(phone, sid, session);
    return;
  }

  if (choice === '3') {
    await showViewMenu(phone, sid, session);
    return;
  }

  if (choice === '4') {
    await wa.sendText(phone, '', '👋 All done! Message us anytime to manage your menu.');
    clearSession(phone, sid);
    return;
  }

  // First message or unrecognised → show main menu
  await sendMainMenu(phone, sid, session.sellerName ?? 'there');
}

async function sendMainMenu(phone: string, sid: string, sellerName: string): Promise<void> {
  await wa.sendButtons(
    phone,
    '',
    `Welcome back, *${sellerName}*! 👋\n\nWhat would you like to do?`,
    [
      { id: 'seller_add',    title: '➕ Add Item'    },
      { id: 'seller_remove', title: '🗑️ Remove Item' },
      { id: 'seller_view',   title: '👁️ View Menu'   },
      { id: 'seller_back',   title: '🏠 Back'         },
    ]
  );
}

// ── Add Item ─────────────────────────────────────────────────────────────────

async function onAddItemName(
  phone: string,
  sid: string,
  _session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'text' || !message.text.trim()) return;
  upsertSession(phone, sid, { sellerItemDraft: { name: message.text.trim() } });
  await wa.sendText(phone, '', '💰 Enter price (₹):');
  advanceStep(phone, sid, ConversationStep.SELLER_ADD_ITEM_PRICE);
}

async function onAddItemPrice(
  phone: string,
  sid: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'text') return;
  const price = parseFloat(message.text.trim());
  if (isNaN(price) || price <= 0) {
    await wa.sendText(phone, '', '⚠️ Please enter a valid price (numbers only, e.g. 150)');
    return;
  }
  upsertSession(phone, sid, { sellerItemDraft: { ...(session.sellerItemDraft ?? {}), price } });
  await wa.sendText(phone, '', '🖼️ Paste image URL (or type *skip*):');
  advanceStep(phone, sid, ConversationStep.SELLER_ADD_ITEM_IMAGE);
}

async function onAddItemImage(
  phone: string,
  sid: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'text') return;

  const input = message.text.trim();
  const draft = session.sellerItemDraft ?? {};
  const imageUrl = input.toLowerCase() === 'skip' || !input ? null : input;

  await prisma.menuItem.create({
    data: {
      seller_id: session.sellerId!,
      name: draft.name!,
      price: draft.price!,
      category: 'General',
      image_url: imageUrl,
      is_available: true,
    },
  });

  upsertSession(phone, sid, { sellerItemDraft: undefined });
  advanceStep(phone, sid, ConversationStep.SELLER_AFTER_ADD);

  await wa.sendButtons(
    phone,
    '',
    `✅ *${draft.name}* added at ₹${draft.price}!`,
    [
      { id: 'add_another', title: '➕ Add Another' },
      { id: 'main_menu',   title: '🏠 Main Menu'   },
    ]
  );
}

async function onAfterAdd(
  phone: string,
  sid: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  const choice = message.type === 'text' ? message.text.trim() : '';

  if (choice === '1') {
    await wa.sendText(phone, '', '📝 Enter item name:');
    advanceStep(phone, sid, ConversationStep.SELLER_ADD_ITEM_NAME);
    return;
  }

  if (choice === '2') {
    advanceStep(phone, sid, ConversationStep.SELLER_MAIN_MENU);
    await sendMainMenu(phone, sid, session.sellerName ?? 'there');
    return;
  }

  // Unrecognised — re-prompt
  await wa.sendButtons(
    phone,
    '',
    'What would you like to do next?',
    [
      { id: 'add_another', title: '➕ Add Another' },
      { id: 'main_menu',   title: '🏠 Main Menu'   },
    ]
  );
}

// ── Remove Item ───────────────────────────────────────────────────────────────

async function startRemoveFlow(
  phone: string,
  sid: string,
  session: ConversationSession
): Promise<void> {
  const items = await prisma.menuItem.findMany({
    where: { seller_id: session.sellerId! },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, price: true, category: true },
  });

  if (items.length === 0) {
    await wa.sendText(phone, '', '😔 You have no menu items yet.\n\nReply with anything to return to the main menu.');
    // Stay in SELLER_MAIN_MENU — next message will re-show the menu
    return;
  }

  const cached = items.map((i) => ({
    id: i.id,
    name: i.name,
    price: Number(i.price),
    category: i.category,
  }));

  upsertSession(phone, sid, { menuItems: cached });
  advanceStep(phone, sid, ConversationStep.SELLER_REMOVE_SELECT);

  await wa.sendList(
    phone,
    '',
    'Which item would you like to remove?',
    'Select Item',
    [
      {
        title: 'Your Items',
        rows: items.map((item) => ({
          id: item.id,
          title: item.name,
          description: `₹${Number(item.price)}`,
        })),
      },
    ],
    { header: '🗑️ Remove Item' }
  );
}

async function onRemoveSelect(
  phone: string,
  sid: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'text') return;

  const items = session.menuItems ?? [];
  const choice = parseInt(message.text.trim(), 10);

  if (isNaN(choice) || choice < 1 || choice > items.length) {
    await wa.sendText(phone, '', `⚠️ Please enter a number between 1 and ${items.length}`);
    return;
  }

  const selected = items[choice - 1];
  upsertSession(phone, sid, { pendingRemoveItemId: selected.id });
  advanceStep(phone, sid, ConversationStep.SELLER_REMOVE_CONFIRM);

  await wa.sendButtons(
    phone,
    '',
    `Remove *${selected.name}* (₹${selected.price})?`,
    [
      { id: 'confirm_remove', title: '✅ Confirm Remove' },
      { id: 'cancel_remove',  title: '❌ Cancel'         },
    ],
    { header: '🗑️ Confirm Removal' }
  );
}

async function onRemoveConfirm(
  phone: string,
  sid: string,
  session: ConversationSession,
  message: ParsedMessage
): Promise<void> {
  if (message.type !== 'text') return;
  const choice = message.text.trim();

  if (choice === '1') {
    const itemId = session.pendingRemoveItemId;
    if (!itemId) {
      await wa.sendText(phone, '', '⚠️ Something went wrong. Returning to main menu.');
      advanceStep(phone, sid, ConversationStep.SELLER_MAIN_MENU);
      await sendMainMenu(phone, sid, session.sellerName ?? 'there');
      return;
    }
    await prisma.menuItem.delete({ where: { id: itemId } });
    upsertSession(phone, sid, { pendingRemoveItemId: undefined, menuItems: undefined });
    advanceStep(phone, sid, ConversationStep.SELLER_MAIN_MENU);
    await wa.sendText(phone, '', '✅ Item removed.');
    await sendMainMenu(phone, sid, session.sellerName ?? 'there');
    return;
  }

  if (choice === '2') {
    upsertSession(phone, sid, { pendingRemoveItemId: undefined, menuItems: undefined });
    advanceStep(phone, sid, ConversationStep.SELLER_MAIN_MENU);
    await wa.sendText(phone, '', '❌ Removal cancelled.');
    await sendMainMenu(phone, sid, session.sellerName ?? 'there');
    return;
  }

  // Unrecognised — re-prompt
  const item = session.menuItems?.find((i) => i.id === session.pendingRemoveItemId);
  await wa.sendButtons(
    phone,
    '',
    `Remove *${item?.name ?? 'this item'}* (₹${item?.price ?? '?'})?`,
    [
      { id: 'confirm_remove', title: '✅ Confirm Remove' },
      { id: 'cancel_remove',  title: '❌ Cancel'         },
    ],
    { header: '🗑️ Confirm Removal' }
  );
}

// ── View Menu ─────────────────────────────────────────────────────────────────

async function showViewMenu(
  phone: string,
  sid: string,
  session: ConversationSession
): Promise<void> {
  const items = await prisma.menuItem.findMany({
    where: { seller_id: session.sellerId! },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: { name: true, price: true, category: true, is_available: true },
  });

  if (items.length === 0) {
    await wa.sendText(phone, '', '😔 Your menu is empty. Use *1. ➕ Add Item* to get started.');
    await sendMainMenu(phone, sid, session.sellerName ?? 'there');
    return;
  }

  const byCategory = new Map<string, typeof items>();
  for (const item of items) {
    const bucket = byCategory.get(item.category) ?? [];
    bucket.push(item);
    byCategory.set(item.category, bucket);
  }

  let text = '📋 *Your Menu*\n';
  for (const [cat, catItems] of byCategory.entries()) {
    text += `\n*${cat}*\n`;
    for (const item of catItems) {
      const flag = item.is_available ? '' : ' _(off)_';
      text += `• ${item.name} — ₹${Number(item.price)}${flag}\n`;
    }
  }

  advanceStep(phone, sid, ConversationStep.SELLER_AFTER_VIEW);

  await wa.sendButtons(phone, '', text.trim(), [{ id: 'main_menu', title: '🏠 Main Menu' }]);
}

async function onAfterView(
  phone: string,
  sid: string,
  session: ConversationSession,
  _message: ParsedMessage
): Promise<void> {
  advanceStep(phone, sid, ConversationStep.SELLER_MAIN_MENU);
  await sendMainMenu(phone, sid, session.sellerName ?? 'there');
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function generateUniqueSlug(): Promise<string | null> {
  for (let i = 0; i < 10; i++) {
    const slug = generateSlug();
    const existing = await prisma.seller.findUnique({ where: { slug } });
    if (!existing) return slug;
  }
  return null;
}
