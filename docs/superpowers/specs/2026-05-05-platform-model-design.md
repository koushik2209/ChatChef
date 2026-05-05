# ChatChef Platform Model — Design Spec

**Date:** 2026-05-05
**Status:** Approved

## Overview

Rebuild ChatChef from a single-seller-per-number model to a platform model. One ChatChef WhatsApp Business number serves all sellers. Customers are routed to the right seller via a pre-filled link containing a short random slug. Sellers manage their menu by DMing the ChatChef number directly. The existing web dashboard remains for viewing orders, payments, and cooking summary.

---

## Message Routing

When any message arrives at the ChatChef number, `messageHandler.ts` runs this check in order:

1. **Sender is a registered seller** — sender's phone number matches a `Seller.whatsapp_number` in the DB → enter **Seller Management Flow**
2. **Message text matches a seller slug** (e.g. `"pk7x2"`) — slug found in DB → enter **Customer Ordering Flow** for that seller
3. **Neither** — bot replies: *"Please use your seller's link to order."* and stops

Sessions are keyed by `customerPhone:sellerId` (not `phoneNumberId` — there is now only one phone number ID for the whole platform).

---

## Customer Ordering Flow (8 steps — unchanged logic)

Entry point: customer taps `wa.me/CHATCHEF_NUMBER?text=pk7x2`, pre-filled message sends the slug.

1. **GREETING** — bot greets customer, shows language buttons (English / हिंदी)
2. **LANGUAGE_SELECT** — sets language, loads seller's menu from DB, shows as WhatsApp list
3. **MENU** — customer picks item → added to cart, shows cart summary
4. **CART** — `Add More` → back to menu, `Checkout` → next
5. **DELIVERY_TYPE** — Delivery or Pickup
6. **LOCATION** — if delivery: GPS pin or typed address
7. **ORDER_SUMMARY** — itemized recap, `Confirm Order` or `Cancel`
8. **PAYMENT** — UPI QR image sent, `I've Paid` → order created in DB, session cleared

**Only change from today:** seller is looked up by slug at session start, not by `display_phone_number`.

---

## Seller Management Flow (new)

Entry point: seller DMs the ChatChef number from their registered WhatsApp number.

Steps to add a menu item:

1. **SELLER_GREETING** — "Welcome back [name]! You have X items on your menu. Add a new item?" → `[Add Item]` `[Done]`
2. **SELLER_ADD_NAME** — "What's the item name?"
3. **SELLER_ADD_CATEGORY** — "What category? (e.g. Main Course, Snacks, Drinks)"
4. **SELLER_ADD_PRICE** — "What's the price? (₹)"
5. **SELLER_ADD_IMAGE** — "Share an image URL (optional)" → `[Skip]`
6. **SELLER_CONFIRM** — Shows full summary, `[Confirm]` `[Start Over]`
7. **SELLER_DONE** — "Item added! ✅" → `[Add Another]` `[Done]`

If seller taps `Done` at any point, session clears and bot stops.

---

## Database Changes

One new field on `Seller`:

```prisma
model Seller {
  ...
  slug  String  @unique  // short random code, e.g. "pk7x2", auto-generated on registration
}
```

No other schema changes. All existing relations and fields stay as-is.

---

## Seller Registration (new page)

A new public page on the dashboard at `/register` (no auth required).

Form fields:
- Shop name
- Your name
- WhatsApp number (becomes their login + seller identification in bot)
- UPI ID

On submit:
- `POST /api/auth/register` — creates seller in DB with auto-generated 5-char alphanumeric slug
- Returns their shareable link: `wa.me/CHATCHEF_NUMBER?text=<slug>`
- Page shows the link and instructs them to DM the ChatChef number to add their menu

No OTP at registration — OTP is only used at dashboard login.

The shareable link is built from a new env var `CHATCHEF_WA_NUMBER` (e.g. `15551571828`) set in Railway. The frontend reads it from `VITE_CHATCHEF_WA_NUMBER` to display the link on the Home page and Register page.

---

## Web Dashboard Changes

- **Home page** — add seller's shareable WhatsApp link displayed prominently
- **Menu page** — keep as-is (add/delete still works from dashboard as a convenience)
- **All other pages** — no changes
- **New `/register` page** — public, no auth required

---

## Files to Create / Modify

### Backend
| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `slug String @unique` to Seller |
| `prisma/seed.js` | Add slug to seeded seller |
| `src/services/messageHandler.ts` | New routing logic: seller vs customer vs unknown |
| `src/services/conversationState.ts` | Add seller management steps to `ConversationStep` enum |
| `src/services/sellerFlow.ts` | **New file** — seller management bot flow |
| `src/services/conversationFlow.ts` | Change seller lookup to use slug instead of `display_phone_number` |
| `src/controllers/authController.ts` | Add `register` handler |
| `src/routes/auth.ts` | Add `POST /auth/register` route (no auth middleware) |

### Frontend (dashboard)
| File | Change |
|---|---|
| `dashboard/src/pages/Register.tsx` | **New file** — registration form page |
| `dashboard/src/api/auth.ts` | Add `register()` API call |
| `dashboard/src/App.tsx` | Add `/register` public route |
| `dashboard/src/pages/Home.tsx` | Show seller's shareable link |

---

## What Does NOT Change

- All 8 customer ordering steps (logic identical, only entry point changes)
- OTP login flow for dashboard
- JWT auth middleware
- Orders, payments, cooking summary controllers
- All existing dashboard pages except Home
- UPI QR generation
- i18n (English + Hindi)
