# LMS Backend (Stage 1 Setup)

Quick setup for local development:

Prerequisites:
- Node.js (>=16)

Install dependencies:

```bash
npm install
```

Create environment file:

```bash
copy .env.example .env
# then edit .env to set real DB credentials and JWT secret
```

Run in development:

```bash
npm run dev
```

Run in production:

```bash
npm start
```

API health check: GET /api/health
