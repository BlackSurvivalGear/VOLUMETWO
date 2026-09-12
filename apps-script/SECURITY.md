# Booking endpoint security

The browser never receives Google OAuth credentials. Apps Script executes as the deploying Workspace user and owns Calendar/Mail access.

Server-side controls:
- required booking fields and email format validation;
- exact 30-minute slot validation;
- past-time rejection;
- Calendar availability recheck immediately before event creation;
- `LockService` serialization around booking writes to reduce race-condition/double-booking risk;
- generated booking IDs;
- limited text sanitization before Calendar/email output.

Before public launch, consider adding abuse controls (rate limiting or a CAPTCHA/token service) if automated spam becomes a problem. The endpoint intentionally accepts public booking requests because the public website cannot hold private Google credentials.
