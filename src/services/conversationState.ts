export enum ConversationStep {
  GREETING = 'GREETING',
  LANGUAGE_SELECT = 'LANGUAGE_SELECT',
  MENU = 'MENU',
  CART = 'CART',
  DELIVERY_TYPE = 'DELIVERY_TYPE',
  LOCATION = 'LOCATION',
  ORDER_SUMMARY = 'ORDER_SUMMARY',
  PAYMENT = 'PAYMENT',
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
  lastUpdated: Date;
}

// Keyed by `${customerPhone}:${phoneNumberId}` so the same customer number
// can have independent sessions across different seller WhatsApp numbers.
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
