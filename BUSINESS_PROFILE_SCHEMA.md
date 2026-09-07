# V2 Business Profile Schema

The V2 member account remains the identity and access record. Business information is stored separately in Firestore.

## `users/{uid}`

The member profile stores `businessId`, which currently equals the member UID for a one-business-per-account model.

## `businesses/{businessId}`

### Identity and ownership

- `ownerUid` — Firebase Authentication UID of the account owner; immutable after creation
- `ownerTitle` — owner role/title such as Founder, Director or Owner

The owner's current name and email are read directly from Firebase Authentication so the account identity does not become stale or editable through the business profile.

### Business details

- `name` — business name
- `type` — business type/category
- `email` — business contact email
- `phone` — business contact phone
- `registrationNumber` — company or business registration number
- `taxNumber` — tax or VAT number
- `country` — country of operation
- `city` — city, state or region
- `website` — business website
- `address` — business address
- `logoDataUrl` — optimised business logo stored in the business document, limited to a compact client-generated image

### System fields

- `createdAt` — Firestore timestamp
- `updatedAt` — Firestore timestamp

The structure deliberately keeps business identity separate from personal account identity so future V2 tools can reuse the same business record. The current one-business-per-account model can later evolve to multiple businesses without changing the member identity model.
