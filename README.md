# ChatChef

WhatsApp-first food ordering SaaS for home cooks and tiffin sellers in India. Customers order via WhatsApp buttons — no app download needed. Sellers manage everything from a mobile dashboard.

## Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js · Express 5 · TypeScript |
| Database | PostgreSQL · Prisma 5 |
| WhatsApp | Meta WhatsApp Cloud API |
| Dashboard | React 19 · Vite · Tailwind CSS v4 |

---

## Local Setup

### Prerequisites

- Node.js 18+
- PostgreSQL (local or [Neon](https://neon.tech) / [Supabase](https://supabase.com))
- [ngrok](https://ngrok.com) (for receiving WhatsApp webhooks locally)

### 1. Clone and install

```bash
git clone <repo-url>
cd ChatChef

# Backend
npm install

# Dashboard
npm install --prefix dashboard
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Where to get it |
|----------|----------------|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `JWT_SECRET` | Any long random string |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Developer Console → WhatsApp → API Setup |
| `WHATSAPP_ACCESS_TOKEN` | Meta Developer Console → System User permanent token |
| `WHATSAPP_VERIFY_TOKEN` | Any random string you choose (must match webhook config) |

### 3. Set up the database

```bash
npm run db:migrate      # Run migrations
npm run db:generate     # Generate Prisma client
npm run db:seed         # Seed test seller + menu
```

### 4. Start the servers

```bash
# Terminal 1 — backend (port 3000)
npm run dev

# Terminal 2 — dashboard (port 5173)
npm run dev --prefix dashboard
```

Dashboard: http://localhost:5173

---

## Connecting WhatsApp Cloud API

### Step 1 — Create a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**
2. Choose **Business** type
3. Add the **WhatsApp** product

### Step 2 — Get your credentials

In **WhatsApp → API Setup**:

- Copy **Phone Number ID** → `WHATSAPP_PHONE_NUMBER_ID` in `.env`
- Generate a **temporary access token** (or create a System User for a permanent one) → `WHATSAPP_ACCESS_TOKEN`

### Step 3 — Expose your local server with ngrok

```bash
ngrok http 3000
```

Copy the `https://xxxx.ngrok-free.app` URL.

### Step 4 — Register the webhook

In **WhatsApp → Configuration → Webhook**:

- **Callback URL**: `https://xxxx.ngrok-free.app/api/webhook`
- **Verify Token**: same value as `WHATSAPP_VERIFY_TOKEN` in `.env`
- Subscribe to the **messages** field

### Step 5 — Update the seller's WhatsApp number

The seeded test seller has `whatsapp_number = '919999999999'`. Update this to your actual WhatsApp Business phone number (digits only, with country code, no `+`):

```bash
npm run db:studio
```

Or directly in SQL:

```sql
UPDATE "Seller" SET whatsapp_number = '91XXXXXXXXXX' WHERE name = 'Priya Home Kitchen';
```

### Step 6 — Test

Send a WhatsApp message to your number. You should see the greeting and language selection buttons.

---

## Dashboard Login

The dashboard uses phone + OTP auth. In development, the OTP is printed to the backend console (`npm run dev` terminal). Use the seeded seller's WhatsApp number to log in after updating it in the DB.

---

## Project Structure

```
ChatChef/
├── prisma/
│   ├── schema.prisma       # DB models
│   ├── seed.ts             # Test data
│   └── migrations/
├── src/
│   ├── controllers/        # Route handlers
│   ├── middleware/         # Auth + error handling
│   ├── routes/             # Express routers
│   ├── services/
│   │   ├── conversationFlow.ts   # 8-step WhatsApp bot
│   │   ├── conversationState.ts  # In-memory session store
│   │   ├── messageHandler.ts     # Webhook → flow router
│   │   ├── whatsapp.ts           # WhatsApp Cloud API client
│   │   └── orderService.ts       # DB order creation
│   ├── i18n/
│   │   └── messages.ts     # English + Hindi strings
│   └── index.ts            # Server entry point
└── dashboard/
    └── src/
        ├── pages/          # Login, Home, Orders, Menu, CookingSummary, Payments
        ├── components/     # Layout, BottomNav, StatCard, StatusBadge, Spinner
        ├── hooks/          # useAuth
        └── lib/            # axios, queryClient
```

## npm Scripts

| Command | Action |
|---------|--------|
| `npm run dev` | Start backend with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:seed` | Seed test data |
| `npm run db:studio` | Open Prisma Studio |
