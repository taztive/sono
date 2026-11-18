# SONO — before paid booking

The public website is a prototype. Routes, prices, durations, museum tickets and language availability are illustrative. The contact form opens the visitor's email app; it does not reserve a place or process payment. `information.html` is a pre-launch disclosure draft.

## Hosting decision (checked 19 November 2026)

- GitHub Pages remains a prototype preview. [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) disallow using it as free hosting for an online business or a site primarily facilitating commercial transactions.
- The currently connected Vercel account is on Hobby. [Vercel's terms](https://vercel.com/legal/terms) limit Hobby to personal or non-commercial use. A SONO sales deployment on Vercel requires Pro or another permitted commercial host; [Vercel pricing](https://vercel.com/pricing) currently starts Pro at $20/month plus applicable taxes and possible usage charges. No plan change has been made.
- The dedicated Supabase project `sono-booking-test` was created in the approved Free organization at $0/month for testing. [Supabase billing guidance](https://supabase.com/docs/guides/platform/billing-on-supabase) allows two active free projects and says free projects can pause after inactivity. Production reservations need a hosting and uptime decision before accepting money.
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions) can create Stripe Checkout Sessions and receive signed webhooks without Vercel Functions. The public site can remain on GitHub Pages during test-only development. Stripe keys belong in [Edge Function secrets](https://supabase.com/docs/guides/functions/secrets), never GitHub or browser code.

## Business and public text

- Confirm the legal operator name, business address, telephone number and person responsible for online sales. Replace all “公開前に要確定 / To be confirmed” fields. [Consumer Affairs Agency requirements](https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php).
- Set each tour's final tax-inclusive price, extra food/transport/admission costs, payment method and timing, and service date. Show the complete offer before payment. [Consumer Affairs Agency requirements](https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php).
- Set concrete cancellation, rescheduling and refund rules, including weather, venue closure, guide cancellation and museum tickets. Show them at final order review. [Consumer Affairs Agency final confirmation guide](https://www.no-trouble.caa.go.jp/pdf/20240315ac01.pdf).
- Confirm the operator and privacy contact details, purpose of use, retention rules and access/correction/deletion procedure. Update the notice when Stripe, a booking database, email automation or analytics are added. [Personal Information Protection Commission guidelines](https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/).
- Ensure the site has a real service description, contact, privacy and refund/cancellation information for Stripe live review. [Stripe website requirements](https://support.stripe.com/embedded-connect/questions/information-required-on-your-business-website-to-process-payments).
- Verify the actual walking-tour and museum-ticket business model with the relevant tourism authority or specialist before sales. Travel-business registration depends on the exact arrangement; do not infer a blanket exemption for museum bundles. [Japan Tourism Agency overview](https://www.mlit.go.jp/kankocho/seisaku_seido/ryokogyoho/ryokogyohogaiyo.html).
- Confirm guide availability and languages, venue opening days, ticket purchase and transfer rules, accessibility, and insurance. Check photo provenance and location labels.

## Booking system — engineer handoff

The test project now has the server-only booking schema in [`supabase/migrations/202611190001_sono_booking_test.sql`](supabase/migrations/202611190001_sono_booking_test.sql). It contains tours, time slots, reservations and Stripe event records. All tables have row-level security; anonymous and logged-in client roles have no table access. There are no tours, dates, customers, payment keys or live checkout endpoints. A transaction-only test passed for duplicate-slot prevention, unpaid checkout rejection, payment confirmation and late expiration; all test rows were rolled back.

The website is still an inquiry-only prototype. To enable automatic booking, the engineer team needs to complete and review the following work:

1. Confirm the tour prices as per-private-group prices, available dates, group sizes, museum ticket terms and booking cutoff; then add real slots and enable tours.
2. Create Stripe Checkout Sessions on a server using authoritative tour, date and price data. Keep secret keys out of the public repository. Release a held slot only when session creation fails before a Checkout Session exists.
3. On a signature-verified Stripe webhook, confirm only paid sessions with matching amount and currency, and send the confirmation email. Handle duplicate events, delayed payment methods, expired sessions and missed webhooks. [Stripe fulfillment documentation](https://docs.stripe.com/checkout/fulfillment).
4. Present the complete order and cancellation conditions before the final payment action. [Consumer Affairs Agency final confirmation guide](https://www.no-trouble.caa.go.jp/pdf/20240315ac01.pdf).
5. Test concurrent purchases, failed payments, refunds, email delivery, changes and museum unavailability in a separate test environment.
