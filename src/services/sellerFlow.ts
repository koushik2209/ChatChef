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
