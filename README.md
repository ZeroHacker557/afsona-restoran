# Abubakr Food

React, TypeScript va Tailwind CSS asosidagi restoran uchun Telegram Mini App —
menyu, savat, buyurtma berish va yetkazib berish tizimi.

## Tuzilma

- `src/pages` — asosiy ekranlar: menyu, profil, buyurtmalar va taom tafsiloti.
- `src/components` — qayta ishlatiluvchi layout, UI, taom va buyurtma komponentlari.
- `src/hooks` — ilovaning UI holati va biznes harakatlari.
- `src/types` — markazlashtirilgan TypeScript domen turlari.
- `src/i18n` — o'zbekcha va ruscha tarjimalar.
- `bot/` — Python (aiogram) Telegram bot: admin panel, menyu boshqaruvi va to'lov tizimi.
- `api/` — Vercel serverless funksiyalari (buyurtma, sharh, autentifikatsiya).

## Buyruqlar

```bash
npm install
npm run dev
npm run build
npm run lint
```

Taomlar va kategoriyalar bot orqali (admin panel) qo'shiladi va Firestore'da saqlanadi.
