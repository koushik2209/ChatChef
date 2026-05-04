import { CartItem } from '../services/conversationState';
import { WaButton } from '../services/whatsapp';

type Lang = 'en' | 'hi';

interface Messages {
  greeting(sellerName: string, customerName?: string): string;
  languageButtons: WaButton[];
  menuHeader: string;
  menuBody(sellerName: string): string;
  menuButton: string;
  cartSummary(items: CartItem[], total: number): string;
  cartButtons: WaButton[];
  deliveryHeader: string;
  deliveryBody: string;
  deliveryButtons: WaButton[];
  locationHeader: string;
  locationBody: string;
  locationButtons: WaButton[];
  locationGpsPrompt: string;
  locationTextPrompt: string;
  orderSummaryHeader: string;
  orderSummary(items: CartItem[], total: number, deliveryType: string, location?: string): string;
  orderSummaryButtons: WaButton[];
  paymentCaption(sellerName: string, upiId: string, total: number): string;
  paymentBody: string;
  paymentButtons: WaButton[];
  orderConfirmed(orderId: string, sellerName: string, deliveryType: string): string;
  cancelled: string;
  noMenuItems: string;
  error: string;
}

function cartLines(items: CartItem[]): string {
  return items.map((i) => `• ${i.name} x${i.quantity}  —  ₹${i.price * i.quantity}`).join('\n');
}

const en: Messages = {
  greeting: (sellerName, customerName) =>
    `👋 Hello${customerName ? ` ${customerName}` : ''}!\n\nWelcome to *${sellerName}*.\n\nChoose your language:`,

  languageButtons: [
    { id: 'lang_en', title: 'English' },
    { id: 'lang_hi', title: 'हिंदी' },
  ],

  menuHeader: '📋 Our Menu',
  menuBody: (sellerName) =>
    `Here's what *${sellerName}* is serving today.\n\nTap *View Menu* to browse and pick items.`,
  menuButton: 'View Menu',

  cartSummary: (items, total) =>
    `🛒 *Your Cart*\n\n${cartLines(items)}\n${'─'.repeat(22)}\n💰 *Total: ₹${total}*`,

  cartButtons: [
    { id: 'cart_add_more', title: 'Add More' },
    { id: 'cart_checkout', title: 'Checkout' },
  ],

  deliveryHeader: 'How to receive?',
  deliveryBody: 'Would you like your order delivered or will you pick it up?',
  deliveryButtons: [
    { id: 'delivery_home', title: 'Delivery' },
    { id: 'delivery_pickup', title: 'Pickup' },
  ],

  locationHeader: '📍 Delivery Address',
  locationBody: 'How would you like to share your delivery address?',
  locationButtons: [
    { id: 'loc_gps', title: 'Share GPS' },
    { id: 'loc_text', title: 'Type Address' },
  ],

  locationGpsPrompt:
    '📍 Please tap the 📎 *attachment* icon and select *Location* to share your current GPS location.',

  locationTextPrompt: '✍️ Please type your full delivery address:',

  orderSummaryHeader: '📋 Order Summary',
  orderSummary: (items, total, deliveryType, location) => {
    const delivery =
      deliveryType === 'pickup'
        ? '🏪 *Pickup* from our location'
        : `🏠 *Deliver to:* ${location ?? 'your address'}`;
    return `🛒 *Items:*\n${cartLines(items)}\n${'─'.repeat(22)}\n💰 *Total: ₹${total}*\n\n${delivery}\n\nReady to confirm?`;
  },

  orderSummaryButtons: [
    { id: 'summary_confirm', title: 'Confirm Order' },
    { id: 'summary_cancel', title: 'Cancel' },
  ],

  paymentCaption: (sellerName, upiId, total) =>
    `💳 *Pay ₹${total} via UPI*\n\nScan this QR code or pay to:\n*${upiId}*\n\n🍽️ ${sellerName}`,

  paymentBody: "After paying, tap *I've Paid* below and your order will be confirmed.",

  paymentButtons: [
    { id: 'payment_done', title: "I've Paid" },
    { id: 'payment_cancel', title: 'Cancel' },
  ],

  orderConfirmed: (orderId, sellerName, deliveryType) =>
    `🎉 *Order Confirmed!*\n\nOrder ID: *#${orderId.slice(-6).toUpperCase()}*\n\n${
      deliveryType === 'pickup'
        ? '🏪 Please collect from our location.'
        : '🏠 We will deliver to your address.'
    }\n\n⏱ Estimated time: 30–45 minutes\n\nThank you for ordering from *${sellerName}*! 🙏`,

  cancelled:
    'Your order has been cancelled. Type anything to start a new order.',

  noMenuItems: '😔 No items available right now. Please check back later.',

  error: 'Sorry, something went wrong. Please try again.',
};

const hi: Messages = {
  greeting: (sellerName, customerName) =>
    `👋 नमस्ते${customerName ? ` ${customerName}` : ''}!\n\n*${sellerName}* में आपका स्वागत है।\n\nभाषा चुनें:`,

  languageButtons: [
    { id: 'lang_en', title: 'English' },
    { id: 'lang_hi', title: 'हिंदी' },
  ],

  menuHeader: '📋 हमारा मेनू',
  menuBody: (sellerName) =>
    `*${sellerName}* का आज का मेनू देखने के लिए *मेनू देखें* दबाएं।`,
  menuButton: 'मेनू देखें',

  cartSummary: (items, total) =>
    `🛒 *आपकी कार्ट*\n\n${cartLines(items)}\n${'─'.repeat(22)}\n💰 *कुल: ₹${total}*`,

  cartButtons: [
    { id: 'cart_add_more', title: 'और जोड़ें' },
    { id: 'cart_checkout', title: 'चेकआउट' },
  ],

  deliveryHeader: 'ऑर्डर कैसे लें?',
  deliveryBody: 'आप अपना ऑर्डर डिलीवरी से लेना चाहेंगे या खुद पिकअप करेंगे?',
  deliveryButtons: [
    { id: 'delivery_home', title: 'डिलीवरी' },
    { id: 'delivery_pickup', title: 'पिकअप' },
  ],

  locationHeader: '📍 डिलीवरी पता',
  locationBody: 'आप अपना पता कैसे शेयर करना चाहेंगे?',
  locationButtons: [
    { id: 'loc_gps', title: 'GPS शेयर करें' },
    { id: 'loc_text', title: 'पता टाइप करें' },
  ],

  locationGpsPrompt:
    '📍 कृपया 📎 *अटैचमेंट* बटन दबाएं और *Location* चुनकर अपना GPS स्थान शेयर करें।',

  locationTextPrompt: '✍️ कृपया अपना पूरा डिलीवरी पता टाइप करें:',

  orderSummaryHeader: '📋 ऑर्डर सारांश',
  orderSummary: (items, total, deliveryType, location) => {
    const delivery =
      deliveryType === 'pickup'
        ? '🏪 *पिकअप* — हमारे पास से'
        : `🏠 *डिलीवरी:* ${location ?? 'आपके पते पर'}`;
    return `🛒 *आइटम:*\n${cartLines(items)}\n${'─'.repeat(22)}\n💰 *कुल: ₹${total}*\n\n${delivery}\n\nऑर्डर कन्फर्म करें?`;
  },

  orderSummaryButtons: [
    { id: 'summary_confirm', title: 'कन्फर्म करें' },
    { id: 'summary_cancel', title: 'रद्द करें' },
  ],

  paymentCaption: (sellerName, upiId, total) =>
    `💳 *₹${total} UPI से भुगतान करें*\n\nQR स्कैन करें या UPI ID:\n*${upiId}*\n\n🍽️ ${sellerName}`,

  paymentBody: 'भुगतान के बाद *भुगतान हो गया* दबाएं।',

  paymentButtons: [
    { id: 'payment_done', title: 'भुगतान हो गया' },
    { id: 'payment_cancel', title: 'रद्द करें' },
  ],

  orderConfirmed: (orderId, sellerName, deliveryType) =>
    `🎉 *ऑर्डर कन्फर्म!*\n\nऑर्डर ID: *#${orderId.slice(-6).toUpperCase()}*\n\n${
      deliveryType === 'pickup'
        ? '🏪 कृपया हमारे पास से ऑर्डर लें।'
        : '🏠 आपका ऑर्डर डिलीवर किया जाएगा।'
    }\n\n⏱ अनुमानित समय: 30–45 मिनट\n\n*${sellerName}* से ऑर्डर करने के लिए धन्यवाद! 🙏`,

  cancelled: 'ऑर्डर रद्द हो गया। नया ऑर्डर करने के लिए कुछ भी टाइप करें।',

  noMenuItems: '😔 अभी कोई आइटम उपलब्ध नहीं है। बाद में देखें।',

  error: 'माफ करें, कुछ गलत हुआ। कृपया पुनः प्रयास करें।',
};

export function getMessages(lang: Lang): Messages {
  return lang === 'hi' ? hi : en;
}
