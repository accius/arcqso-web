# ArcQSO website

Marketing site for [arcqso.com](https://arcqso.com) — a modern amateur radio logging application.

## Local

```bash
npm install
npm start
```

Open http://localhost:3000

## GitHub + Railway

1. This repo is ready to deploy.
2. In Railway: **New Project → Deploy from GitHub repo** and select `accius/arcqso-web`.
3. Railway will detect Node, run `npm install`, then `npm start`.
4. Attach custom domain `arcqso.com` in Railway networking.

The site is static files in `public/` served by a small Express server bound to `PORT`.
