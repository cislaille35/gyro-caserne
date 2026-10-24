# 0003 — Technos : tout chez Cloudflare, en TypeScript

- **Contexte** : technos gratuites et bien outillées, utilisables par chaque centre.
- **Options** :
  - SvelteKit + Cloudflare (Workers, D1, R2) ;
  - Supabase : l'offre gratuite met un projet en pause après une semaine sans activité ;
  - Next.js + Vercel + Neon : l'offre gratuite de Vercel est réservée à un usage personnel.
- **Choix** : SvelteKit + Cloudflare Workers, D1 et R2, en monorepo pnpm + Turborepo, tests Vitest.
- **Pourquoi** : gratuit pour chaque centre sans mise en veille, et déjà éprouvé par le MVP.
- **Validé par** : le porteur du projet, le 24/10/2026.
