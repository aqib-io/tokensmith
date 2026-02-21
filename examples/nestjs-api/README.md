# tokensmith — NestJS API Example

A minimal NestJS authentication API that issues and refreshes JWTs. Used as the backend for the [react-app](../react-app) example.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/login` | None | Username + password → token pair |
| `POST` | `/auth/refresh` | None | Refresh token → new token pair |
| `GET` | `/auth/profile` | Bearer | Returns user decoded from JWT |

## Quick start

```bash
npm install
npm run start:dev   # http://localhost:3000
```

## Demo users

| Username | Password | Role |
|----------|----------|------|
| alice | password123 | admin |
| bob | password456 | user |

> **Note:** Users and the JWT secret are hardcoded for demo purposes only.
> In production, use a real database and load secrets from environment variables.

## Token config

| Setting | Value | Why |
|---------|-------|-----|
| Access token expiry | `30s` | Short so auto-refresh is visible in the demo |
| Refresh token expiry | `7d` | Standard long-lived refresh window |

## Environment variables

Copy `.env.example` and adjust as needed:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the API listens on |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
