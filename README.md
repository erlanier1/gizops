# GizOps
**Operations built for food truck operators**

Internal operations platform for Zig's Kitchen — managing permits, bookings, and documents for the food truck and catering business.

## Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS
- Supabase (database, auth, file storage)
- Resend (email alerts)
- shadcn/ui

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Copy `.env.local.example` and fill in your Supabase and Resend credentials.

## Sections

- **Dashboard** — overview of bookings, permits, and documents
- **Permits** — track permit status and expiry alerts
- **Bookings** — manage food truck and catering events
- **Documents** — store and review operational files
