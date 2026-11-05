# Ticketing Kenya

A Coolify-ready Talanta Sports City match site by Ticketing Kenya, with a private administrator portal, MongoDB storage, background HashPay M-Pesa checkout, QR tickets, and printable PDF passes.

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
| `PUBLIC_BASE_URL` | `https://talantasportcity.site` (public HTTPS URL for QR validation links) |
| `HASHPAY_ACCOUNT_ID` | HashPay public account ID |
| `HASHPAY_API_KEY` | Private HashPay API key used only by the server to send M-Pesa prompts |
| `HASHPAY_WEBHOOK_SECRET` | HashPay webhook signing secret |

The app connects to the dedicated `ticketing_kenya` database by default and uses collections prefixed `tk_` (`tk_venues`, `tk_events`, `tk_event_inventory`, `tk_orders`, `tk_tickets`, `tk_members`). Set a different `MONGODB_DATABASE` if you need a different namespace. MongoDB credentials and payment secrets remain server-side.

The HTTP server and homepage start even when optional environment values are missing. If `MONGODB_URI` is absent or the database is unreachable, `/health` stays available and reports the database state; event, booking, and admin data APIs return a temporary unavailable response. MongoDB connection failures retry every 30 seconds. The private admin sign-in page and credential check stay available while MongoDB reconnects; the dashboard explains when its data tools are waiting for the database. Admin sign-in is enabled when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set. Session cookies follow the actual HTTPS connection reported by Coolify. If `SESSION_SECRET` is absent, the app derives a stable signing key from the MongoDB URI (or the admin credentials when MongoDB is not configured); set a random 32+ character secret in production and keep it stable. Background HashPay STK Push stays disabled until the account ID, private API key and webhook secret are set. Configure these values to enable the corresponding features.

If the browser console shows `net::ERR_CONNECTION_CLOSED` or `Failed to fetch`, open `https://talantasportcity.site/health` and `https://talantasportcity.site/api/events?scope=upcoming` in the same browser. Health should return `database: connected`; the events endpoint should return JSON. A closed connection means the request did not receive an HTTP response, so check Coolify's container/redeploy state and domain proxy/HTTPS routing. The homepage now retries temporary event-list network failures and preserves previously loaded listings; it cannot repair a stopped container or a broken domain route.

Ticket purchases use guest checkout; customers do not need to create an account. Checkout collects an email address, each ticket holder’s name, and an M-Pesa number. Tickets are issued after the payment webhook verifies payment, then shown on the confirmation screen for download. Ticketing Kenya sends the buyer’s email copy manually: administrators can download the paid order PDF from Payments & orders and mark the email as sent. Identity numbers are only requested when the administrator marks an event as 18+; those numbers are encrypted before storage.

Administrator sign-in allows 20 failed attempts per five minutes for each IP and email pair. Member sign-in allows 30 failed attempts for each IP and email pair. The limits are independent, so attempts against one email or the admin panel do not lock other customer accounts. Successful sign-ins do not count toward the limit.

Open `/admin` directly to sign in. There is no public admin link or public event publishing route. Configure the administrator credentials in Coolify. Draft events are private; only events published by the administrator appear on the public site.

The customer profile does not collect or store card numbers. M-Pesa preference numbers are profile contact details; actual payment credentials and prompts remain with HashPay. Phone/email verification, SMS/WhatsApp delivery, push alerts, social sign-in and Apple/Google wallet pass issuance require separate provider integrations and are not represented as verified or delivered until configured. County badges use Commons flag files where a county flag asset is available; these are community reference files and should be confirmed with the relevant county before official use.

In HashPay, configure the HTTPS webhook URL as `https://YOUR_DOMAIN/api/payments/hashpay/webhook` and copy the signing secret into Coolify. Use a real HashPay account and verify the provider’s current dashboard configuration before going live. The browser callback only starts a status check; tickets are issued after the signed server webhook confirms the transaction and amount.

## MongoDB isolation

Use the same MongoDB cluster if desired, but keep this app on its own `ticketing_kenya` database and use a database user scoped to that database. The collection prefix adds another namespace boundary. The application creates its indexes and seeds its venue reference records on startup. It does not create events or sample tickets.

## Run locally

Use Node.js 22 or later. Copy `.env.example` to `.env`, fill in the values, then run `npm install` and `npm start`. Keep `.env` private.

## Venues and seating

The public homepage is a Talanta Sports City stadium microsite. Its match date, venue, ticket tiers, prices, and availability are loaded from the published event record; it does not seed sample events. The administrator manages the match and ticket options in the private event dashboard.

Venue references and proposed sections are not the same as a confirmed seating chart. Talanta’s Lower/Upper/VIP/VVIP, Kasarani’s Lower/Upper/VIP/VVIP, Nyayo’s stands, cinema tiers, and the supplied gate references begin as unverified. In `/admin`, verify the real gate names and configure exact rows/seats per row before marking a map venue-verified. Numbered seat tickets cannot be published without that information. General-admission tickets do not claim a seat. This keeps seat numbers and gate instructions from being invented.

The app distinguishes upcoming from happening-now events using the event start/end times. An attendee name and email are collected for each ticket; the issued pass includes event, venue, date, tier, section, assigned seat, gate, ticket identifier and a QR link to the validation page.

## Operational notes

- M-Pesa payment requires valid HashPay credentials and a working public HTTPS webhook.
- If payment arrives after a seat hold expires, the order is marked for manual payment review rather than issuing a possibly conflicting seat.
- This starter sends tickets to the paid order page and enables PDF download. Transactional email/SMS delivery and Apple/Google wallet passes need separate provider credentials and configuration.
- Use MongoDB Atlas or another durable MongoDB deployment with backups enabled. The application itself does not store card details.

## Homepage photography credits

The homepage uses locally bundled, real photographs from Wikimedia Commons rather than generated imagery for the Kenyan flag and wildlife feature. Full attribution and license links for those photographs are listed below for compliance; they are not displayed in the customer dashboard.

County flag reference images: [Flags of counties of Kenya](https://commons.wikimedia.org/wiki/Category:Flags_of_counties_of_Kenya). The available set is incomplete and some flags/designs may not be officially adopted; county badges fall back to a neutral county abbreviation when an image is unavailable.

The homepage also includes the [Coat of arms of Kenya (Official).svg](https://commons.wikimedia.org/wiki/File:Coat_of_arms_of_Kenya_(Official).svg), credited to Ashiriz and distributed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The flower is an original animated SVG illustration using Kenyan colors; it is decorative and is not presented as a designated national flower.

- Kenyan flags — Gustavo Ribeiro Faria, CC BY-SA 4.0: https://commons.wikimedia.org/wiki/File:Kenyan_flag_on_2016-08-02_11.01.27.jpg
- Lion — Swissfrog, CC BY 3.0: https://commons.wikimedia.org/wiki/File:African_Lion_3.jpg
- Elephant — Sam Stearman, CC BY-SA 3.0 / GFDL: https://commons.wikimedia.org/wiki/File:African_Elephant_in_Kenya.jpg
- Leopard — Sumeet Moghe, CC BY-SA 4.0: https://commons.wikimedia.org/wiki/File:Male_leopard_-_Mara.jpg
- Buffalo — Chuckupd, public domain: https://commons.wikimedia.org/wiki/File:African_buffalo_kenya.jpg
- Rhino — Wwelles14, CC BY 3.0: https://commons.wikimedia.org/wiki/File:White_Rhino_Nakuru.jpg

© 2026/27 Ticketing Kenya.


### Stadium homepage

The public page follows the supplied Talanta Sports City reference: match hero, stadium overview, AFCON 2027 information, ticket options, directions, FAQs, and footer. An unpublished match is not shown as available for sale.


## Talanta reference assets

The match page uses locally hosted assets from Talanta Sports City to avoid remote image/font loading: dusk stadium hero and hospitality photography, stadium interior photography, team crests, and the Talanta logo. The page typography uses Anton for condensed display headings and Barlow/Barlow Condensed for body and interface text. The WOFF2 font files and SIL Open Font License notices are in `images/talanta-reference`. The user confirmed written permission for commercial use of the Talanta Sports City photos and logos.

The mobile layout follows the supplied reference screens: compact header with menu, full-width dusk match hero, large condensed event title and buy button, stadium overview with image first, hospitality cards, directions/map, FAQs, and responsive footer. Checkout remains guest-only; verified tickets appear on screen and a Ticketing Kenya administrator emails them manually.


## Talanta ticket selection

Selecting Buy Ticket opens a responsive three-level stadium seating plan and the event’s published ticket types. Numbered seats shown afterward come from the event inventory API; the plan itself does not invent live seat availability. Checkout is M-Pesa only. After the server sends a prompt, the buyer sees a payment-waiting screen with the total, masked phone number, resend countdown and cancel control. It remains in the verification flow until payment is confirmed or cancelled.

The seating diagram includes the section labels shown in the supplied Talanta map: Level 1 sections 101–128; Level 2 sections 201–220 and 301–350; Level 3 sections 401–435; plus Media, Platinum and Gold F01–F05 labels. Map levels and numbered sections are clickable. This is a section-map reference, not verified seat-by-seat inventory: row counts, actual gate assignments and live occupied seats must come from the venue/event configuration. The official event guidance says the attendee's assigned gate is printed on their ticket, so the application does not invent a gate from the map.


## HTTPS and custom domain

Set `PUBLIC_BASE_URL=https://talantasportcity.site` in Coolify so ticket QR codes and links use the secure custom domain. Attach `talantasportcity.site` to the Coolify application, enable HTTPS/Let’s Encrypt for that domain, and keep the app exposed on container port `3000`. The domain currently redirects HTTP to HTTPS. Open the site as `https://talantasportcity.site`; if a browser still shows an old warning, close the old tab and open the HTTPS address directly.

## Google Search Console and event indexing

`PUBLIC_BASE_URL` must match the verified public HTTPS domain (`https://talantasportcity.site`). The homepage and each published event have a canonical URL. Published events are served at `/events/<event-id>` with event-specific server-rendered event details, title, description, canonical metadata and Schema.org `Event` JSON-LD. Draft and unpublished events are excluded from the public event pages and sitemap. `/sitemap.xml` lists the homepage and published events; `/robots.txt` points crawlers to that sitemap and excludes private admin/API paths.

To connect the property, verify the **domain** in [Google Search Console](https://search.google.com/search-console/) using the DNS TXT record Google provides. DNS verification is preferable because it covers the domain and subdomains. After verification, submit `https://talantasportcity.site/sitemap.xml` in Search Console. Inspect the homepage and at least one published `/events/<event-id>` URL with URL Inspection, and fix any reported crawl, canonical, or structured-data issues. `GOOGLE_SITE_VERIFICATION` is optional and is only needed if using Search Console's HTML-tag ownership method; set it to the token value Google provides (not the entire meta tag).

Search Console can report indexing status and structured-data eligibility; it cannot guarantee a ranking, event rich result, or that Google will label a site as the only official seller. Keep the written exclusive-seller authorization and ensure the organizer's official site links to this domain, which helps establish the relationship. Do not publish event information that is not confirmed by the organizer.
