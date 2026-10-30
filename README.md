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

The HTTP server and homepage start even when optional environment values are missing. If `MONGODB_URI` is absent or the database is unreachable, `/health` stays available and reports the database state; event, booking, and admin data APIs return a temporary unavailable response. MongoDB connection failures retry every 30 seconds. Admin sign-in is enabled when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set. If `SESSION_SECRET` is absent, the app derives a stable signing key from the MongoDB URI (or the admin credentials when MongoDB is not configured); set a random 32+ character secret in production and keep it stable. HashPay checkout stays disabled until its account ID and webhook secret are set. Configure these values to enable the corresponding features.

Customers can create an account with their full names, county, Gmail address and a password of at least 6 characters. Registration signs them in immediately. Member sessions end after one hour without an authenticated request. An identity card number is requested only when an administrator marks an event as 18+; for those events, a number is required for each attendee and encrypted before being stored with the order. Passwords are hashed; keep `SESSION_SECRET` stable so encrypted identity details remain readable to authorized application flows. Signed-in account holders can manage profile preferences, review their wallet ledger, view/transfer eligible tickets, manage sessions, request account deletion, export their data and message support. The private admin panel includes member records, wallet adjustments and support conversations. Support replies are stored and refresh in the profile while it is open.

Administrator sign-in allows 20 failed attempts per five minutes for each IP and email pair. Member sign-in allows 30 failed attempts for each IP and email pair. The limits are independent, so attempts against one email or the admin panel do not lock other customer accounts. Successful sign-ins do not count toward the limit.

Open `/admin` directly to sign in. There is no public admin link or public event publishing route. Configure the administrator credentials in Coolify. Draft events are private; only events published by the administrator appear on the public site.

The customer profile does not collect or store card numbers. M-Pesa preference numbers are profile contact details; actual payment credentials and prompts remain with HashPay. Phone/email verification, SMS/WhatsApp delivery, push alerts, social sign-in and Apple/Google wallet pass issuance require separate provider integrations and are not represented as verified or delivered until configured. County badges use Commons flag files where a county flag asset is available; these are community reference files and should be confirmed with the relevant county before official use.

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

County flag reference images: [Flags of counties of Kenya](https://commons.wikimedia.org/wiki/Category:Flags_of_counties_of_Kenya). The available set is incomplete and some flags/designs may not be officially adopted; county badges fall back to a neutral county abbreviation when an image is unavailable.

The homepage also includes the [Coat of arms of Kenya (Official).svg](https://commons.wikimedia.org/wiki/File:Coat_of_arms_of_Kenya_(Official).svg), credited to Ashiriz and distributed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The flower is an original animated SVG illustration using Kenyan colors; it is decorative and is not presented as a designated national flower.

- Kenyan flags — Gustavo Ribeiro Faria, CC BY-SA 4.0: https://commons.wikimedia.org/wiki/File:Kenyan_flag_on_2016-08-02_11.01.27.jpg
- Lion — Swissfrog, CC BY 3.0: https://commons.wikimedia.org/wiki/File:African_Lion_3.jpg
- Elephant — Sam Stearman, CC BY-SA 3.0 / GFDL: https://commons.wikimedia.org/wiki/File:African_Elephant_in_Kenya.jpg
- Leopard — Sumeet Moghe, CC BY-SA 4.0: https://commons.wikimedia.org/wiki/File:Male_leopard_-_Mara.jpg
- Buffalo — Chuckupd, public domain: https://commons.wikimedia.org/wiki/File:African_buffalo_kenya.jpg
- Rhino — Wwelles14, CC BY 3.0: https://commons.wikimedia.org/wiki/File:White_Rhino_Nakuru.jpg

© 2026/27 Ticketing Kenya.
