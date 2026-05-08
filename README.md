# ChatChef

WhatsApp-first food ordering platform for home cooks and tiffin sellers in India. Customers order via WhatsApp — no app needed. Sellers manage their menu and orders from a mobile-first dashboard.

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js · Express 5 · TypeScript |
| Database | PostgreSQL · Prisma 5 |
| WhatsApp | Gupshup WhatsApp API |
| Dashboard | React 19 · Vite · Tailwind CSS v4 |

---

## Local Setup

### Prerequisites

- Node.js 18+
- PostgreSQL (local or [Neon](https://neon.tech) / [Supabase](https://supabase.com))
- A Gupshup account with a WhatsApp app (see [Gupshup Setup](#gupshup-whatsapp-setup) below)
- [ngrok](https://ngrok.com) to expose your local server for webhooks

### 1. Clone and install

```bash
git clone <repo-url>
cd ChatChef

npm install
npm install --prefix dashboard
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Any long random string |
| `GUPSHUP_API_KEY` | From Gupshup app → Settings |
| `GUPSHUP_APP_NAME` | Your Gupshup app name |
| `CHATCHEF_NUMBER` | Your Gupshup WhatsApp number — digits only, no `+` (e.g. `917834811114`) |

For the dashboard, create `dashboard/.env.local`:

```env
VITE_API_URL=http://localhost:3000
VITE_CHATCHEF_WA_NUMBER=91xxxxxxxxxx   # same as CHATCHEF_NUMBER
```

### 3. Set up the database

```bash
npm run db:migrate      # apply migrations
npm run db:generate     # regenerate Prisma client
npm run db:seed         # seed test seller + menu items
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

## Gupshup WhatsApp Setup

### Step 1 — Create an account

Sign up at [app.gupshup.io](https://app.gupshup.io).

### Step 2 — Create a WhatsApp app

1. Click **Create App** → **Access API**.
2. Select **WhatsApp** as the channel.
3. Enter an app name (e.g. `ChatChef`). This becomes `GUPSHUP_APP_NAME`.

### Step 3 — Get your API key

1. Open your app → **Settings** tab.
2. Copy the **API Key** → set as `GUPSHUP_API_KEY` in `.env`.

### Step 4 — Note your WhatsApp source number

1. In your app dashboard, find the **Source Number** (the number your bot sends from).
2. Copy it **without the `+`** → set as `CHATCHEF_NUMBER` in `.env`.

> `CHATCHEF_NUMBER` serves two roles: it is the `source` field on every outgoing Gupshup API call, and incoming messages whose `receiver.phone` matches it are routed to the **seller flows** (onboarding and menu management). Messages arriving on any other number are routed to the **customer ordering flow**.

### Step 5 — Set the inbound webhook URL

1. In your Gupshup app → **Webhooks** or **Configuration** section.
2. Set the **Callback URL** to your server's webhook endpoint:
   ```
   https://your-server.com/api/webhook
   ```
3. For local development, expose port 3000 with ngrok first:
   ```bash
   ngrok http 3000
   ```
   Then set the callback URL to `https://<your-ngrok-id>.ngrok.io/api/webhook`.
4. Gupshup does **not** use a verify token — the `GET /api/webhook` endpoint simply returns 200.

### Step 6 — Add a test number (sandbox)

Gupshup's sandbox lets you test without a live WhatsApp Business approval:

1. In your app → **Test** tab → **Add Test Number**.
2. Enter the WhatsApp number you will test from (with country code, e.g. `919876543210`).
3. Send the displayed opt-in keyword (e.g. `allow`) from that number to your Gupshup sandbox number.
4. The number is now active — send and receive messages in the sandbox.

### Step 7 — Seed a test seller matching your test number

The seed script creates a test seller. Update the `whatsapp_number` in `prisma/seed.js` to match the number you registered in Step 6, then re-run:

```bash
npm run db:seed
```

---

## Bot Flows

### Customer ordering

Customer sends the seller's **slug** (e.g. `abc12`) to the ChatChef number to start a session:

```
Slug → Language choice → Menu → Cart → Delivery / Pickup → Address → Order summary → UPI payment
```

### Seller onboarding (unrecognised number → ChatChef number)

```
Welcome → Shop name → UPI ID → WhatsApp Business number → Store created ✅
```

### Seller menu management (registered seller → ChatChef number)

```
Main menu → [Add Item | Remove Item | View Menu | Exit]
```

---

## API Routes

All routes are prefixed with `/api`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Liveness check |
| POST | `/auth/request-otp` | — | Send OTP to seller phone |
| POST | `/auth/verify-otp` | — | Verify OTP, receive JWT |
| POST | `/auth/register` | — | Register a new seller |
| GET | `/webhook` | — | Gupshup webhook handshake |
| POST | `/webhook` | — | Incoming WhatsApp messages |
| GET | `/menu` | JWT | List seller's menu items |
| POST | `/menu` | JWT | Add a menu item |
| PATCH | `/menu/:id` | JWT | Update a menu item |
| DELETE | `/menu/:id` | JWT | Delete a menu item |
| GET | `/orders` | JWT | List today's orders (filter by status) |
| PATCH | `/orders/:id/status` | JWT | Advance order status |
| GET | `/orders/cooking-summary` | JWT | Aggregated items across active orders |
| GET | `/payments` | JWT | List today's payments |
| PATCH | `/payments/:orderId/mark-paid` | JWT | Mark an order paid |
| GET | `/dashboard/summary` | JWT | Today's stats |
| GET | `/customers` | JWT | Paginated customer list |

---

## Project Structure

```
ChatChef/
├── prisma/
│   ├── schema.prisma             # DB models
│   └── seed.js                   # Test data
├── src/
│   ├── controllers/              # Route handlers + webhook parser
│   ├── middleware/               # JWT auth + error handler
│   ├── routes/                   # Express routers
│   ├── services/
│   │   ├── conversationFlow.ts   # 8-step customer ordering bot
│   │   ├── conversationState.ts  # In-memory session store
│   │   ├── messageHandler.ts     # Webhook → seller / customer router
│   │   ├── sellerFlow.ts         # Seller onboarding + menu management bot
│   │   ├── whatsapp.ts           # Gupshup API client
│   │   └── orderService.ts       # DB order helpers
│   └── i18n/messages.ts          # English + Hindi strings
└── dashboard/src/
    ├── pages/     # Login, Register, Home, Orders, Menu, CookingSummary, Payments
    ├── components/# Layout, BottomNav, StatCard, StatusBadge, Spinner
    ├── hooks/     # useAuth
    └── lib/       # axios instance, React Query client
```

## npm Scripts

| Command | Action |
|---|---|
| `npm run dev` | Start backend with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:seed` | Seed test data |
| `npm run db:studio` | Open Prisma Studio |

---

## Production Notes

Two in-memory stores reset on restart — plan accordingly before going live:

| Store | Location | Production fix |
|---|---|---|
| WhatsApp conversation sessions | `conversationState.ts` Map | Migrate to Redis |
| OTP store | `authService.ts` Map | Migrate to Redis |

OTP delivery is a `console.log` stub in development (`authController.ts:23`). Replace with an SMS gateway before launch.
