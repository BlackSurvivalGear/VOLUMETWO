# V2 Business Profile Schema

The V2 member account remains the identity and access record. Business information is stored separately in Firestore.

## `users/{uid}`

The member profile stores `businessId`, which currently equals the member UID for a one-business-per-account model.

## `businesses/{businessId}`

Fields:

- `ownerUid` — Firebase Authentication UID of the owner
- `name` — business name
- `type` — business type/category
- `email` — business contact email
- `phone` — business contact phone
- `website` — business website
- `address` — business address
- `createdAt` — Firestore timestamp
- `updatedAt` — Firestore timestamp

The structure deliberately keeps business identity separate from personal account identity so future V2 tools can reuse the same business record.
