# Afsona bot

Mijozlar bilan muloqot qiladigan Telegram bot: `/start`, menyu tugmasi,
«Buyurtmalarim», aloqa. Kuryer tugmalari va kanal biriktirish ham shu
yerdan o'tadi — lekin **qarorlarni bot qabul qilmaydi**, u faqat
`/api/admin` ga uzatadi. Butun mantiq serverda.

## Ishga tushirish

```bash
pip install -r requirements.txt
python bot.py
```

## Kerakli muhit o'zgaruvchilari

| O'zgaruvchi | Nima uchun |
|---|---|
| `BOT_TOKEN` | Telegram bot tokeni |
| `MINI_APP_URL` | Ilova havolasi — tugmalar shunga oladi |
| `ADMIN_PANEL_URL` | API manzili shundan olinadi |
| `BOT_API_SECRET` | Bot ↔ API maxfiy kaliti |
| `FIREBASE_SERVICE_ACCOUNT` | Service account JSON, bitta qatorda |

Kompyuterda ishlaganda bular loyiha ildizidagi `.env` dan o'qiladi va
Firebase kaliti `*-firebase-adminsdk-*.json` fayldan topiladi.

Hostingda (Railway va h.k.) `.env` ham, kalit fayli ham bo'lmaydi —
ular git'ga tushmaydi. Shuning uchun u yerda hammasi muhit
o'zgaruvchilari orqali beriladi, jumladan `FIREBASE_SERVICE_ACCOUNT`.

## Muhim

Bot **polling** rejimida ishlaydi — doim yoqiq turadigan jarayon kerak.
Serverless platformalar (Vercel va h.k.) to'g'ri kelmaydi.
