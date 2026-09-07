# Volume Two authentication flow

## Account-first access

A user must have a Volume Two account before they can access the member dashboard.

- **Create Account** creates a new Firebase Authentication account.
- Email/password accounts are created with email + password + confirmation.
- Google creation uses Google's account chooser and only proceeds when Firebase reports the Google identity as a new user.
- If the selected Google identity already has a V2 account, the session is signed out and the user is told to use **Sign In** instead.
- **Sign In** is for existing accounts only and accepts either email/password or Google.
- Successful authentication routes to `dashboard.html`.
- Unauthenticated access to `dashboard.html` or `business-tools.html` redirects to `auth.html`.

## Public entry points

The public home page exposes both **Sign In** and **Create V2 Account**. The latter opens the Create Account view directly.
