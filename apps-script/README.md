# Volume Two Discovery Booking Web App

This Apps Script web app provides Calendar availability, paid PayPal checkout and discovery-call booking.

## Script properties

Configure these in **Project Settings → Script properties**. Never commit their values:

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_ENVIRONMENT` — `sandbox` while testing, `live` only after live credentials are installed.

The discovery price is controlled server-side in `Code.gs` as **£95.00 GBP**. The browser cannot choose or override the amount.

## Deployment

1. Copy `Code.gs` and `appsscript.json` into the existing Apps Script project.
2. Authorize the Calendar, Mail and external-request scopes.
3. Deploy a **new version** of the existing Web App, executing as the owner and retaining the existing public `/exec` URL.
4. Complete a Sandbox payment before testing booking.

## Security model

A successful PayPal capture is stored server-side against the PayPal order ID and applicant email. `book` rejects requests without a completed matching payment and rejects reuse after a booking has consumed that payment. Calendar availability is rechecked under `LockService` immediately before event creation.

Before production, rotate any exposed Sandbox secret and install separate PayPal Live credentials.
