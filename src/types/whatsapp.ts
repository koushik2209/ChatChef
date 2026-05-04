// Raw webhook payload shape from Meta WhatsApp Cloud API

export interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppChange {
  value: WhatsAppValue;
  field: string;
}

export interface WhatsAppValue {
  messaging_product: string;
  metadata: WhatsAppMetadata;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppRawMessage[];
  statuses?: WhatsAppStatus[];
}

export interface WhatsAppMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

export interface WhatsAppContact {
  profile: { name: string };
  wa_id: string;
}

export interface WhatsAppRawMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'interactive' | 'image' | 'location' | 'audio' | 'document' | 'button';
  text?: { body: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  button?: { text: string; payload: string };
}

export interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
}

// Normalised message shape used throughout the app

interface BaseMessage {
  from: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  contactName: string | undefined;
}

export type ParsedMessage =
  | (BaseMessage & { type: 'text'; text: string })
  | (BaseMessage & { type: 'button_reply'; buttonId: string; buttonTitle: string })
  | (BaseMessage & { type: 'list_reply'; itemId: string; itemTitle: string })
  | (BaseMessage & { type: 'location'; latitude: number; longitude: number; address: string | undefined })
  | (BaseMessage & { type: 'unsupported' });
