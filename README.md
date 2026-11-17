# SONO / Tokyo Walks — public test site

This is a bilingual, responsive concept website for SONO's possible Tokyo walking and culture tours. Routes, durations, museum arrangements and prices are illustrative. It does not accept bookings or live payments.

The contact form creates a draft email addressed to `withsono.contact@gmail.com` in the visitor's mail app. The static site does not collect or store form submissions. A copy button is available if the visitor has no mail app configured.

## GitHub Pages

Publish the repository's `main` branch from `/ (root)` in **Settings → Pages**. The `.nojekyll` file is included for direct static publishing. No build step or backend is required.

Before using the URL for Stripe's live account review, replace concept routes and prices with actual offers; add the legally required commercial disclosure, cancellation/refund terms and privacy notice; verify the business and payout account in Stripe; and test the complete enquiry-to-payment flow.
