# Ticketing Kenya

A Coolify-ready event discovery and ticketing app with a private administrator portal, MongoDB storage, configurable Kenyan venue layouts, HashPay M-Pesa checkout, QR tickets, and printable PDF passes.

## Coolify deployment

Deploy this directory as a Docker application and expose port `3000`. Set these environment variables in Coolify (do not commit secrets):

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Set to `production` |
| `PORT` | `3000` |
| `ADMIN_EMAIL` | Private admin login email |
| `ADMIN_PASSWORD` | Long, unique admin password |
| `SESSION_SECRET` | Random secret of at least 32 characters |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DATABASE` | `ticketing_kenya` (separate database namespace) |
| `PUBLIC_BASE_URL` | Public HTTPS URL for QR validation links |
| `HASHPAY_ACCOUNT_ID` | HashPay public account ID |
| `HASHPAY_WEBHOOK_SECRET` | HashPay webhook signing secret |

The app connects to the dedicated `ticketing_kenya` database by default and uses collections prefixed `tk_` (`tk_venues`, `tk_events`, `tk_event_inventory`, `tk_orders`, `tk_tickets`, `tk_members`). Set a different `MONGODB_DATABASE` if you need a different namespace. MongoDB credentials and payment secrets remain server-side.

The HTTP server and homepage start even when optional environment values are missing. If `MONGODB_URI` is absent or the database is unreachable, `/health` stays available and reports the database state; event, booking, and admin data APIs return a temporary unavailable response. MongoDB connection failures retry every 30 seconds. If admin credentials or a 32+ character `SESSION_SECRET` are missing, public pages still load but admin sign-in stays disabled. HashPay checkout stays disabled until its account ID and webhook secret are set. Configure these values to enable the corresponding features.

Customers can create an account or sign in from the public header. Account passwords are hashed before storage, and paid orders are linked to the signed-in account. Guest checkout remains available.

Open `/admin` directly to sign in. There is no public admin link or public event publishing route. Configure the administrator credentials in Coolify. Draft events are private; only events published by the administrator appear on the public site.

In HashPay, configure the HTTPS webhook URL as `https://YOUR_DOMAIN/api/payments/hashpay/webhook` and copy the signing secret into Coolify. Use a real HashPay account and verify the provider’s current dashboard configuration before going live. The browser callback only starts a status check; tickets are issued after the signed server webhook confirms the transaction and amount.

## MongoDB isolation

Use the same MongoDB cluster if desired, but keep this app on its own `ticketing_kenya` database and use a database user scoped to that database. The collection prefix adds another namespace boundary. The application creates its indexes and seeds its venue reference records on startup. It does not create events or sample tickets.

## Run locally

Use Node.js 22 or later. Copy `.env.example` to `.env`, fill in the values, then run `npm install` and `npm start`. Keep `.env` private.

## Venues and seating

The starter directory includes Talanta Sports Stadium, Kasarani, Nyayo, selected stadiums in other counties, the user-listed cinema locations, and selected theatres. It is a useful starting directory, not a complete authoritative register of every Kenyan venue. The supplied photographs are used in the sports, cinema and theatre discovery pages.

Venue references and proposed sections are not the same as a confirmed seating chart. Talanta’s Lower/Upper/VIP/VVIP, Kasarani’s Lower/Upper/VIP/VVIP, Nyayo’s stands, cinema tiers, and the supplied gate references begin as unverified. In `/admin`, verify the real gate names and configure exact rows/seats per row before marking a map venue-verified. Numbered seat tickets cannot be published without that information. General-admission tickets do not claim a seat. This keeps seat numbers and gate instructions from being invented.

The app distinguishes upcoming from happening-now events using the event start/end times. An attendee name and email are collected for each ticket; the issued pass includes event, venue, date, tier, section, assigned seat, gate, ticket identifier and a QR link to the validation page.

## Operational notes

- M-Pesa payment requires valid HashPay credentials and a working public HTTPS webhook.
- If payment arrives after a seat hold expires, the order is marked for manual payment review rather than issuing a possibly conflicting seat.
- This starter sends tickets to the paid order page and enables PDF download. Transactional email/SMS delivery and Apple/Google wallet passes need separate provider credentials and configuration.
- Use MongoDB Atlas or another durable MongoDB deployment with backups enabled. The application itself does not store card details.

## Homepage photography credits

The homepage uses locally bundled, real photographs from Wikimedia Commons rather than generated imagery for the Kenyan flag and Big Five feature. The site displays attribution and license links in the photo credits disclosure:

- Kenyan flags — Gustavo Ribeiro Faria, CC BY-SA 4.0: https://commons.wikimedia.org/wiki/File:Kenyan_flag_on_2016-08-02_11.01.27.jpg
- Lion — Swissfrog, CC BY 3.0: https://commons.wikimedia.org/wiki/File:African_Lion_3.jpg
- Elephant — Sam Stearman, CC BY-SA 3.0 / GFDL: https://commons.wikimedia.org/wiki/File:African_Elephant_in_Kenya.jpg
- Leopard — Sumeet Moghe, CC BY-SA 4.0: https://commons.wikimedia.org/wiki/File:Male_leopard_-_Mara.jpg
- Buffalo — Chuckupd, public domain: https://commons.wikimedia.org/wiki/File:African_buffalo_kenya.jpg
- Rhino — Wwelles14, CC BY 3.0: https://commons.wikimedia.org/wiki/File:White_Rhino_Nakuru.jpg
