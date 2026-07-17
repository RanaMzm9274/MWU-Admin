# MWU CRM Portal

React/Vite CRM portal for managing Madda Walabu University website pages.

## Commands

```bash
npm install
npm run dev
npm run admin:api
npm run build
npm run fetch:pages
```

`npm run dev` starts both the local Admin API on port `4000` and Vite on port `5173`. Use `npm run dev:vite` only when the API is already running elsewhere, such as through PM2 on the server.

## Current Scope

- Dashboard styled around the MWU public website palette, imagery, and official `madda-logo.png` brand mark.
- All-pages manager with search, status/type/menu filtering, sorting, bulk publish/review/archive, duplicate, import, and export.
- Pages load from the live API configured by `VITE_API_BASE_URL`, for example `https://api.maddauni.online/api/admin/pages?limit=200`.
- Programs module with main programs page editing, program category management, program CRUD, featured/open-application toggles, and grouped listing preview.
- Page editor with content, builder, SEO, settings, revision history, publishing status, ownership, visibility, menu order, and scheduling metadata.
- Professional page builder with block templates, block selection, image/CTA/layout fields, visibility toggles, duplication, deletion, reordering, and live preview.
- Media library using selected MWU website assets.
- Live website-style preview for the selected page.
- CRM lead and settings screens as frontend-ready modules.

The Pages module loads live data from `GET /admin/pages?limit=200` using `VITE_API_BASE_URL`. It does not connect to MariaDB directly and does not show locally cached page records. Program categories and programs are stored under `mwu-crm-program-categories-v1` and `mwu-crm-programs-v1`.

Local development should point at the live backend API:

```bash
VITE_API_BASE_URL=https://api.maddauni.online/api
```

Header and Footer markup is saved to the authenticated Admin Pages API. During local development, the matching HTML partial is synchronized in `public/assets/partials/`.

The public MWU website exposes a protected bearer-token endpoint for synchronizing the deployed Header and Footer partials. The default endpoint is:

```bash
VITE_SITE_CHROME_PUBLISH_URL=https://maddauni.online/api/site-chrome
```

The application defaults to `https://maddauni.online/api/site-chrome`. Override `VITE_SITE_CHROME_PUBLISH_URL` only when the website deployment uses a different protected publishing URL.

## Admin User Management API

The Users module expects DB-backed endpoints on the configured Admin API base URL:

```bash
POST   /admin/login
GET    /admin/me
GET    /admin/users
POST   /admin/users
PUT    /admin/users/:id
POST   /admin/users/:id/invite
DELETE /admin/users/:id
```

This repo includes a Node/MariaDB implementation in `server/admin-api.js` and the SQL table shape in `server/admin-auth-schema.sql`.

For local backend development:

```bash
cp .env.example .env
npm run admin:api
```

Set `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` before the first API start to create the initial super admin account. Configure SMTP variables to send invite emails; without SMTP, development responses return a temporary password for manual sharing.

Production note: mount these routes in the same backend that serves the existing Admin Pages API, or point `VITE_API_BASE_URL` at a backend that also supports the pages/media/site-chrome routes. The React app uses one bearer token for portal access and page management, so user auth and content APIs must trust the same JWT/session issuer.
