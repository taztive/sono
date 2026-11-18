# SONO — before paid booking

The public website is a prototype. Routes, prices, durations, museum tickets and language availability are illustrative. The contact form opens the visitor's email app; it does not reserve a place or process payment. `information.html` is a pre-launch disclosure draft.

## Business and public text

- Confirm the legal operator name, business address, telephone number and person responsible for online sales. Replace all “公開前に要確定 / To be confirmed” fields. [Consumer Affairs Agency requirements](https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php).
- Set each tour's final tax-inclusive price, extra food/transport/admission costs, payment method and timing, and service date. Show the complete offer before payment. [Consumer Affairs Agency requirements](https://www.no-trouble.caa.go.jp/what/mailorder/advertising.php).
- Set concrete cancellation, rescheduling and refund rules, including weather, venue closure, guide cancellation and museum tickets. Show them at final order review. [Consumer Affairs Agency final confirmation guide](https://www.no-trouble.caa.go.jp/pdf/20240315ac01.pdf).
- Confirm the operator and privacy contact details, purpose of use, retention rules and access/correction/deletion procedure. Update the notice when Stripe, a booking database, email automation or analytics are added. [Personal Information Protection Commission guidelines](https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/).
- Ensure the site has a real service description, contact, privacy and refund/cancellation information for Stripe live review. [Stripe website requirements](https://support.stripe.com/embedded-connect/questions/information-required-on-your-business-website-to-process-payments).
- Verify the actual walking-tour and museum-ticket business model with the relevant tourism authority or specialist before sales. Travel-business registration depends on the exact arrangement; do not infer a blanket exemption for museum bundles. [Japan Tourism Agency overview](https://www.mlit.go.jp/kankocho/seisaku_seido/ryokogyoho/ryokogyohogaiyo.html).
- Confirm guide availability and languages, venue opening days, ticket purchase and transfer rules, accessibility, and insurance. Check photo provenance and location labels.

## Booking system — engineer handoff

This requires backend work. No backend was changed for the information-page update.

1. Store available time slots and capacity, with expiring holds, to prevent double booking.
2. Create Stripe Checkout Sessions on a server using authoritative tour, date and price data. Keep secret keys out of the public repository.
3. On a verified Stripe payment webhook, mark the booking paid and confirmed and send an email. Handle duplicate events and expired sessions. [Stripe fulfillment documentation](https://docs.stripe.com/checkout/fulfillment).
4. Present the complete order and cancellation conditions before the final payment action. [Consumer Affairs Agency final confirmation guide](https://www.no-trouble.caa.go.jp/pdf/20240315ac01.pdf).
5. Test concurrent purchases, failed payments, refunds, email delivery, changes and museum unavailability in a separate test environment.
