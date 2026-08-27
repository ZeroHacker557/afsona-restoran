# Afsona Restaurant

React, TypeScript va Tailwind CSS asosidagi restoran tizimi:
Telegram mini app (mijoz uchun) va web boshqaruv paneli (restoran uchun).

## Qismlar

| Manzil | Nima |
|---|---|
| `/` | **Mini app** — menyu, savat, buyurtma berish, buyurtmalar tarixi |
| `/admin` | **Boshqaruv paneli** — buyurtmalar, taomlar, promokod, xabarnoma, statistika |
| `/api/*` | Serverless funksiyalar — buyurtma yaratish, Telegram xabarlari, admin amallari |
| `bot/` | Python (aiogram) bot — faqat mijoz bilan muloqot |

## Tuzilma

- `src/pages` — mini app ekranlari: menyu, profil, buyurtmalar, taom tafsiloti
- `src/components` — layout, UI, taom va buyurtma komponentlari
- `src/hooks` — ilovaning UI holati va biznes harakatlari
- `src/admin` — boshqaruv paneli (alohida bundle, mijozga yuklanmaydi)
- `src/i18n` — o'zbekcha va ruscha tarjimalar
- `src/utils/hours.ts` — ish vaqti hisobi (egizagi: `api/_lib/hours.ts`)
- `api/` — Vercel serverless funksiyalari
- `bot/` — Telegram bot

## Buyruqlar

```bash
npm install
npm run dev      # / va /admin.html — ikkalasi ham ochiladi
npm run build
npm run lint
```

## Boshlash

Ishga tushirish, Firebase va admin hisobini sozlash — [DEPLOY.md](./DEPLOY.md).
Rejalashtirilgan ish va qabul qilingan qarorlar — [PLAN.md](./PLAN.md).

Taomlar, kategoriyalar, promokodlar va sozlamalar `/admin` panelida
boshqariladi va Firestore'da saqlanadi.
