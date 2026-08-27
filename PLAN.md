# Afsona Restaurant — ko'chirish va Web Admin rejasi

Hujjat loyihani **Abubakr Food** dan **Afsona Restaurant** ga o'tkazish va
Telegram bot ichidagi admin panelni **`/admin` web sahifasi** bilan
almashtirish rejasini belgilaydi.

Qabul qilingan qarorlar (buyurtmachi bilan kelishilgan):

| Savol | Qaror |
|---|---|
| Admin panelga kirish | Email + parol (Firebase Auth). Brauzerda, link orqali. Telegram mini app — faqat mijoz uchun |
| Bot roli | Mijoz uchun qoladi. Admin panel bot'dan olib tashlanadi. Mijozlarga xabar (matn/rasm/video) web paneldan yuboriladi |
| Ranglar | Hozirgi qizil (`#e23744`) qoladi. Faqat nom, logo va matnlar o'zgaradi |
| Yangi funksiyalar | Dashboard + realtime buyurtma, ish vaqti + stop-list, kengaytirilgan promo + segmentli xabarnoma. **Kirmaydi:** rollar/jurnal/eksport/sharh moderatsiyasi, stol bandlash (bron) |

---

## 1. Arxitektura

### Hozir

```
Telegram Mini App (Vercel, statik)  ──►  Firestore (o'qish)
                                    ──►  /api/*  (yozish)
Python bot (shaxsiy kompyuterda)    ──►  Admin panel (inline tugmalar)
                                    ──►  Buyurtma xabarnomalari (onSnapshot)
```

Muammo: bot o'chsa — admin hech narsa qila olmaydi.

### Bo'ladi

```
Mini App   /          (mijoz, Telegram ichida)   ──►  Firestore o'qish + /api/* yozish
Web Admin  /admin     (brauzer, email+parol)     ──►  Firestore o'qish/yozish (admin claim)
                                                 ──►  /api/admin/*  (maxfiy amallar)
Vercel API /api/*                                ──►  Telegram Bot API (xabarnoma, broadcast)
Python bot                                       ──►  faqat /start, menyu, mijoz bilan muloqot
```

Buyurtma kelganda adminga Telegram xabari **Vercel funksiyasidan** yuboriladi —
kompyuter yoqiq turishi shart emas.

### `/admin` qanday qo'shiladi

Vite **ko'p sahifali** rejimga o'tadi: `index.html` (mini app) va `admin.html`
(panel) — ikki alohida bundle. Mijozga admin kodi umuman yuklanmaydi.
`vercel.json` da `/admin` → `/admin.html` rewrite.

Panel ichidagi navigatsiya — loyiha uslubiga mos, qo'shimcha kutubxonasiz
(URL hash + holat), `react-router` qo'shilmaydi.

### Xavfsizlik

- Admin Firebase Auth (email+parol) bilan kiradi.
- `/api/admin/session` ID tokenni tekshiradi, emailni ruxsat ro'yxati bilan
  solishtiradi va **`admin: true` custom claim** o'rnatadi.
- Firestore va Storage qoidalarida: `request.auth.token.admin == true` bo'lsa
  yozishga ruxsat. Mijoz uchun hozirgi qoidalar o'zgarmaydi.
- Birinchi admin `/api/admin/seed` orqali, `ADMIN_SETUP_KEY` env kaliti bilan
  bir marta yaratiladi. Keyingilari panel ichidan qo'shiladi.
- Bot tokeni, service account — faqat serverda (env).

---

## 2. Web admin bo'limlari

### 2.1 Dashboard
Bugungi savdo, buyurtmalar soni, o'rtacha chek, yangi mijozlar; 7/30 kunlik
grafik (SVG, kutubxonasiz); top-10 taom; oxirgi buyurtmalar; do'kon holati
(ochiq/yopiq) tugmasi.

### 2.2 Buyurtmalar  *(bot: 🛒 Buyurtmalar)*
- Realtime ro'yxat + **Kanban** ustunlar: Yangi → Qabul qilindi → Yetkazilmoqda → Yetkazildi / Bekor
- Yangi buyurtma kelganda **ovozli signal** va brauzer bildirishnomasi
- Filtr (status, sana, to'lov turi), qidiruv (raqam, ism, telefon)
- Tafsilot: taomlar, summa, chegirma, promokod, yetkazish, mijoz, telefon (bir klik qo'ng'iroq), manzil + xaritada ochish, izoh, to'lov holati va chek rasmi
- Statusni o'zgartirish → mijozga Telegram xabari avtomatik ketadi
- To'lovni tasdiqlash / rad etish, buyurtmani o'chirish
- Chop etish (oshxona cheki)

### 2.3 Taomlar  *(bot: 📦 Taomlar, ➕ Taom qo'shish)*
- Grid ko'rinish, qidiruv, kategoriya bo'yicha filtr
- Qo'shish/tahrirlash: nom, narx, eski narx, chegirma yorlig'i, tavsif,
  qoldiq (stock), kategoriya, **bir nechta rasm** (drag&drop yuklash, tartib,
  asosiy rasmni tanlash, o'chirish)
- **Stop-list**: bir klik bilan "mavjud emas" — ilovada kulrang bo'lib qoladi,
  savatga qo'shib bo'lmaydi
- Ommaviy amallar: tanlab o'chirish, narxni foizda o'zgartirish

### 2.4 Kategoriyalar  *(bot: 📂 Kategoriyalar)*
Qo'shish, nomini o'zgartirish (ichidagi taomlar avtomatik yangilanadi),
o'chirish (bo'sh bo'lmasa ogohlantiradi), ikon tanlash, tartibni surish.

### 2.5 Promokodlar  *(bot: 🎟 Promokodlar)* — kengaytirilgan
Kod, chegirma %, **amal muddati**, **minimal buyurtma summasi**,
**ishlatish limiti**, **faqat birinchi buyurtma uchun**, faol/nofaol tugmasi,
nechta marta ishlatilgani.

### 2.6 Xabarnoma  *(bot: 📢 Xabarnoma)* — kengaytirilgan
Matn / rasm / video, tugma qo'shish (mini app havolasi), segment tanlash:
hamma · faol (7 kun) · uzoq kirmagan · buyurtma qilganlar · hech qachon
buyurtma qilmaganlar. Yuborishdan oldin ko'rib chiqish, jonli progress
(paketlab yuboriladi — Vercel vaqt chegarasiga tushmaydi), natija hisoboti.

### 2.7 Sozlamalar
- **Ish vaqti**: har kun uchun ochilish/yopilish soati, dam olish kuni,
  "vaqtincha yopiq" tugmasi
- Yetkazib berish narxi, bepul yetkazish chegarasi, minimal buyurtma summasi
- Karta raqami va egasi
- Aloqa ma'lumotlari (telefon, Telegram, email) — ilovadagi "Yordam" sahifasi
  shu yerdan o'qiydi
- Restoran nomi va manzili

### 2.8 Statistika  *(bot: 📊 Statistika, 📈 Sotuv hisoboti, 👀 Analitika)*
Sotuv hisoboti (7/30/90 kun): tushum, buyurtmalar, o'rtacha chek, statuslar
kesimi; analitika: ko'rishlar, mahsulot ko'rishlari; top taomlar.

### 2.9 Mijozlar
Ro'yxat, qidiruv, buyurtmalar soni va umumiy summasi, oxirgi faollik,
bittasiga alohida xabar yuborish. (Segmentli broadcast uchun ham kerak.)

### 2.10 Adminlar  *(bot: 👥 Adminlar)*
Email bilan admin qo'shish/o'chirish, parolni o'zgartirish, buyurtma
xabarnomasi keladigan Telegram ID'lar ro'yxati.

---

## 3. Mini app o'zgarishlari

1. **Ish vaqti tekshiruvi** — savatga qo'shish ishlayveradi, lekin
   "Buyurtma berish" bosilganda restoran yopiq bo'lsa oyna chiqadi:
   *"Restoran hozir yopiq. Ish vaqti: 09:00–23:00. Soat 09:00 dan keyin urinib
   ko'ring."* Server tomonda ham tekshiriladi (`/api/orders` rad etadi).
2. **Stop-list** — `available: false` taom kartada "Tugagan" deb ko'rsatiladi.
3. **Brend** — nom, sarlavha, logo, aloqa ma'lumotlari.
4. **Chek yuklash** — karta bilan to'lovda chekni bot orqali emas, ilova ichida
   yuklash (Storage'ga). Bot 24/7 kerak bo'lmaydi.

---

## 4. Bot o'zgarishlari

- `bot/admin.py`, `bot/admins.py` — olib tashlanadi
- Qoladi: `/start`, menyu tugmasi, mijoz bilan aloqa, buyurtma holati xabarlari
- Token, mini app URL, karta ma'lumotlari — `config.py` dan `.env` ga
- Adminga buyurtma xabarnomasi endi Vercel API'dan ketadi

---

## 5. Bosqichlar

| # | Bosqich | Holat |
|---|---|---|
| 0 | Brend almashtirish (nom, sarlavha, matnlar) | ✅ bajarildi |
| 1 | Infratuzilma: `admin.html`, ko'p sahifali build, `vercel.json` | ✅ bajarildi |
| 2 | Autentifikatsiya: Firebase Auth, admin claim, qoidalar, seed | ✅ bajarildi |
| 3 | Dashboard + realtime buyurtmalar (Kanban, ovoz, chek) | ✅ bajarildi |
| 4 | Taomlar, kategoriyalar, rasm yuklash, stop-list | ✅ bajarildi |
| 5 | Promokod, xabarnoma, sozlamalar, statistika, mijozlar, adminlar | ✅ bajarildi |
| 6 | Mini app: ish vaqti, stop-list, ilova ichida chek yuborish | ✅ bajarildi |
| 7 | Bot tozalash — faqat mijoz funksiyalari qoldi | ✅ bajarildi |
| 8 | Firebase, bot token, telefon/email qiymatlarini o'rnatish | ⏳ ma'lumot kutilmoqda |

### 8-bosqichda nima kerak bo'ladi

1. **Firebase web config** — Console → Project Settings → General → Web app
   (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`)
2. **Service account JSON** — Console → Service accounts → Generate new private key
3. **Bot tokeni va bot username** — @BotFather
4. **Vercel domeni** — mini app va panel manzillari uchun
5. **Aloqa**: telefon raqami, Telegram username, email, manzil
6. **Karta**: raqam va egasining ismi
7. **Admin**: email, parol va o'zingizning Telegram ID'ingiz

Bularni bergach: `src/lib/firebase.ts`, `.env`, Vercel env o'zgaruvchilari va
`src/config/brand.ts` to'ldiriladi (batafsil — [DEPLOY.md](./DEPLOY.md)).

---

## 6. Qo'shimcha: qanday ishlaydi

**Buyurtma yo'li.** Mijoz mini appda savatni to'ldiradi → `/api/orders`
narxni Firestore'dagi haqiqiy qiymatlardan qayta hisoblaydi, ish vaqtini va
qoldiqni tekshiradi, buyurtmani yaratadi va **o'sha yerning o'zidan**
adminlarga Telegram xabarini yuboradi. Panel `onSnapshot` orqali buyurtmani
bir zumda ko'radi, ovozli signal beradi.

**Status yo'li.** Panelda status o'zgartiriladi → `/api/admin` Firestore'ni
yangilaydi va mijozga Telegram xabari + ilova ichidagi bildirishnoma
yuboradi.

**Nega ba'zi amallar to'g'ridan-to'g'ri Firestore'ga yoziladi?** Taom,
kategoriya, promokod va sozlamalar — panel ularni bevosita yozadi
(qoidalar `admin: true` claim'ni tekshiradi). Bu kod hajmini kamaytiradi va
o'zgarish mijozlarda darhol ko'rinadi. Server sirini talab qiladigan
amallar (Telegram xabari, admin huquqi) esa faqat `/api/admin` orqali.
