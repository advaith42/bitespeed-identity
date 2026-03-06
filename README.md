# Bitespeed Identity Reconciliation

## Live Endpoint
https://YOUR-APP-NAME.onrender.com

## API

### POST /identify

**Request:**
```json
{
  "email": "user@example.com",
  "phoneNumber": "1234567890"
}
```

**Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["primary@example.com", "secondary@example.com"],
    "phoneNumbers": ["1234567890"],
    "secondaryContactIds": [2, 3]
  }
}
```

## Tech Stack
- Node.js + TypeScript
- Express.js
- PostgreSQL (Neon)
- Prisma ORM
- Hosted on Render