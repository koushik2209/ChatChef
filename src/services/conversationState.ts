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
  // Seller onboarding (unrecognised number → ChatChef number)
  SELLER_ONBOARD_WELCOME = 'SELLER_ONBOARD_WELCOME',
  SELLER_ONBOARD_NAME = 'SELLER_ONBOARD_NAME',
  SELLER_ONBOARD_UPI = 'SELLER_ONBOARD_UPI',
  SELLER_ONBOARD_PHONE = 'SELLER_ONBOARD_PHONE',
  SELLER_ONBOARD_OTP = 'SELLER_ONBOARD_OTP',
  // Seller menu management (recognised seller → ChatChef number)
  SELLER_MAIN_MENU = 'SELLER_MAIN_MENU',
  SELLER_ADD_ITEM_NAME = 'SELLER_ADD_ITEM_NAME',
  SELLER_ADD_ITEM_PRICE = 'SELLER_ADD_ITEM_PRICE',
  SELLER_ADD_ITEM_IMAGE = 'SELLER_ADD_ITEM_IMAGE',
  SELLER_AFTER_ADD = 'SELLER_AFTER_ADD',
  SELLER_REMOVE_SELECT = 'SELLER_REMOVE_SELECT',
  SELLER_REMOVE_CONFIRM = 'SELLER_REMOVE_CONFIRM',
  SELLER_AFTER_VIEW = 'SELLER_AFTER_VIEW',
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

export interface SellerOnboardingDraft {
  shopName?: string;
  upiId?: string;
  waNumber?: string;
  otp?: string;
  otpExpiry?: Date;
  otpAttempts?: number;
}

export interface SellerItemDraft {
  name?: string;
  price?: number;
  imageUrl?: string;
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
  sellerOnboardDraft: SellerOnboardingDraft | undefined;
  sellerItemDraft: SellerItemDraft | undefined;
  pendingRemoveItemId: string | undefined;
  lastUpdated: Date;
}

const sessions = new Map<string, ConversationSession>();

function sessionKey(phone: string, phoneNumberId: string): string {
  return `${phone}:${phoneNumberId}`;
}

export function getSession(phone: string, phoneNumberId: string): ConversationSession | undefined {
  return sessions.get(sessionKey(phone, phoneNumberId));
}

export function upsertSession(
  phone: string,
  phoneNumberId: string,
  updates: Partial<ConversationSession>
): ConversationSession {
  const existing = sessions.get(sessionKey(phone, phoneNumberId));
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
    sellerOnboardDraft: undefined,
    sellerItemDraft: undefined,
    pendingRemoveItemId: undefined,
    ...existing,
    ...updates,
    lastUpdated: new Date(),
  };
  sessions.set(sessionKey(phone, phoneNumberId), session);
  return session;
}

export function advanceStep(phone: string, phoneNumberId: string, step: ConversationStep): void {
  const session = sessions.get(sessionKey(phone, phoneNumberId));
  if (session) {
    session.step = step;
    session.lastUpdated = new Date();
  }
}

export function clearSession(phone: string, phoneNumberId: string): void {
  sessions.delete(sessionKey(phone, phoneNumberId));
}
