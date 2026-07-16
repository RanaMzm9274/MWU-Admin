# MWU CRM Portal

React/Vite CRM portal for managing Madda Walabu University website pages.

## Commands

```bash
npm install
npm run dev
npm run build
npm run fetch:pages
```

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
