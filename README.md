# SONO / Tokyo Walks — public test site

This is a responsive concept website in Japanese, English and French for SONO's possible Tokyo walking and culture tours. Routes, durations, museum arrangements and prices are illustrative. It does not accept bookings or live payments. The website's languages do not guarantee that a guide can lead a tour in each language; guiding language is confirmed after an enquiry.

The contact form creates a draft email addressed to `withsono.contact@gmail.com` in the visitor's mail app. The static site does not collect or store form submissions. A copy button is available if the visitor has no mail app configured.

The SONO C1–a logo and symbol are exported as SVGs from the project's Figma identity file. `magazine.html` is a three-language editorial landing page. `magazine-yanesen.html` is a sample essay; the other story ideas are marked as in preparation. The magazine content is editorial prototype copy, not reported interviews or a final publication.

## GitHub Pages

Publish the repository's `main` branch from `/ (root)` in **Settings → Pages**. The `.nojekyll` file is included for direct static publishing. No build step or backend is required.

The public `information.html` contains pre-launch privacy, booking/cancellation, commercial-disclosure and photo-credit sections in Japanese, English and French. Missing legal operator and sales terms are marked as to be confirmed. Complete these before live sales; see [LAUNCH_REQUIREMENTS.md](LAUNCH_REQUIREMENTS.md) for source links and the engineer handoff. The website has no live booking or payment flow.

## SONO Studio

The repository also contains an authenticated local editing studio for experience plans, magazine layouts, video storyboards/V-cons, and a posting queue. See [STUDIO.md](STUDIO.md) for startup, security, and deployment instructions. Start with `npm start` (Node.js 24+) or double-click `start-studio.command` on Mac.

The studio backend does not run on GitHub Pages. SNS accounts are not connected; scheduled posts remain unsent. Analytics is intentionally marked Coming soon.
