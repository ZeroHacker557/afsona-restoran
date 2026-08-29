# Ishga tushirish qo'llanmasi — Afsona Restaurant

Loyiha uch qismdan iborat:

| Qism | Qayerda ishlaydi | Vazifasi |
|---|---|---|
| Mini app (`/`) | Vercel (statik) | Mijoz: menyu, savat, buyurtma |
| Admin panel (`/admin`) | Vercel (statik) | Boshqaruv: buyurtmalar, taomlar, sozlamalar |
| `/api/*` | Vercel (serverless) | Buyurtma yaratish, Telegram xabarlari, admin amallari |
| Bot (`bot/`) | Ixtiyoriy server yoki kompyuter | Faqat mijoz bilan muloqot: `/start`, menyu tugmasi |

> **Muhim:** buyurtma xabarnomalari va mijozga ketadigan xabarlar Vercel
> funksiyalaridan yuboriladi. Ya'ni bot dasturi o'chiq bo'lsa ham
> buyurtmalar qabul qilinadi va adminga Telegram xabari boradi.

---

## 1. Bot tokeni — ✅ sozlangan

Bot: [@afsonarestoran_bot](https://t.me/afsonarestoran_bot). Token
`.env` faylida va Vercel `BOT_TOKEN` o'zgaruvchisida bo'lishi kerak.

> Token — butun himoyaning kaliti: mini app imzosi ham u bilan
> tekshiriladi. Sizib chiqsa, [@BotFather](https://t.me/BotFather) →
> `/mybots` → bot → **API Token** → **Revoke current token** qiling va
> yangisini ikkala joyga qo'ying.

---

## 2. Firebase — ✅ sozlangan

> Quyidagilar **allaqachon bajarilgan** (`afsona-restorani` loyihasi):
> Firestore, Storage, Authentication (Email/Password), qoidalar, admin
> hisobi va boshlang'ich sozlamalar. Bu bo'lim — ma'lumot uchun va
> loyiha boshqa Firebase'ga ko'chirilsa kerak bo'ladi.

### Qanday qilingan (yordamchi skriptlar)

```bash
node scripts/setup-firebase.mjs "admin@email" "parol"   # admin hisobi + sozlamalar
node scripts/deploy-rules.mjs                            # firestore.rules + storage.rules
node scripts/vercel-env.mjs                              # Vercel env qiymatlari
```

Skriptlar loyiha ildizidagi `.env` va service account JSON faylidan
foydalanadi. `setup-firebase.mjs` mavjud ma'lumot ustiga yozmaydi.

---

## 2a. Firebase — qo'lda sozlash tartibi

1. **Firestore Database** yarating (Production mode).
2. **Storage** yoqing — taom rasmlari va cheklar shu yerda saqlanadi.
3. **Authentication** → **Get started** → **Sign-in method** →
   **Email/Password** ni **yoqing**. Admin panel shu bilan ishlaydi.
4. **Project Settings** → **Service accounts** → **Generate new private key**.
   Yuklab olingan JSON:
   - Vercel'ga → `FIREBASE_SERVICE_ACCOUNT` (butun mazmuni, bitta qatorda)
   - Bot uchun → loyiha ildiziga qo'ying (`.gitignore` da, git'ga tushmaydi)
5. **Mijoz konfiguratsiyasi**: Project Settings → General → Your apps → Web app.
   Undagi qiymatlarni [`src/lib/firebase.ts`](./src/lib/firebase.ts) dagi
   `firebaseConfig` ga qo'ying.

### Qoidalar (Rules)

Ikkalasini ham nusxalang va **Publish** bosing:

- [`firestore.rules`](./firestore.rules) → Firestore Database → Rules
- [`storage.rules`](./storage.rules) → Storage → Rules

Yoki CLI bilan:

```bash
firebase deploy --only firestore:rules,storage
```

Qoidalarning mag'zi: mijoz katalogni o'qiydi va faqat o'z ma'lumotini
o'zgartiradi; admin panel esa `admin: true` custom claim bilan yozadi.
Claim'ni faqat server (`/api/admin`) qo'yadi.

---

## 3. Vercel Environment Variables

Loyiha → **Settings** → **Environment Variables**. Hammasini
Production, Preview va Development uchun qo'shing.

Tayyor qiymatlarni chiqarish uchun:

```bash
node scripts/vercel-env.mjs
```

Ro'yxat ([`.env.example`](./.env.example) da izohlari bor):

| O'zgaruvchi | Nima uchun |
|---|---|
| `BOT_TOKEN` | Telegram imzosini tekshirish va xabar yuborish |
| `FIREBASE_SERVICE_ACCOUNT` | Serverdan Firestore'ga yozish |
| `ADMIN_EMAILS` | Panelga kira oladigan egalar (vergul bilan) |
| `ADMIN_SETUP_KEY` | Birinchi admin hisobini yaratish kaliti |
| `MINI_APP_URL` | Xabarlardagi «Ilovani ochish» tugmasi |
| `ADMIN_PANEL_URL` | Buyurtma xabaridagi «Panelda ochish» tugmasi |
| `ADMIN_CHAT_IDS` | Buyurtma xabari keladigan Telegram ID'lar (zaxira) |
| `BOT_API_SECRET` | Bot ↔ API maxfiy kaliti — kuryer tugmalari shusiz ishlamaydi |

Qo'shgandan keyin **qayta deploy qiling** — Vercel env'ni faqat yangi
build'ga qo'llaydi.

---

## 4. Adminlar — ✅ birinchi hisob yaratilgan

Panelga kirish: `https://afsona-restoran.vercel.app/admin`

Keyingi adminlar panelning **Adminlar** bo'limidan qo'shiladi.

**Parol unutilsa:** login sahifasidagi «Birinchi sozlash / parolni tiklash»
tugmasini bosing va `ADMIN_SETUP_KEY` (`.env` faylida) bilan yangi parol
qo'ying. Bu yo'l `ADMIN_SETUP_KEY` Vercel'da sozlangan bo'lsagina ishlaydi.

---

## 5. Panelni sozlash (birinchi kirishdan keyin)

**Sozlamalar** bo'limida:

- **Ish vaqti** — kunlar bo'yicha soatlar. Yopiq paytda mijoz savatga
  taom qo'sha oladi, lekin «Buyurtma berish» bosilganda qachon
  ochilishimiz yozilgan oyna chiqadi.
- **Yetkazib berish** — narx, bepul yetkazish chegarasi, minimal summa
- **Karta** — raqam va egasining ismi (karta orqali to'lov uchun)
- **Restoran va aloqa** — telefon, Telegram, email, manzil.
  Ilovadagi «Yordam» sahifasi shu yerdan o'qiydi.

**Adminlar** bo'limida — Telegram ID'lar ro'yxati. Sizniki (`7203124812`)
allaqachon qo'shilgan; boshqa ID'ni [@userinfobot](https://t.me/userinfobot)
aytadi. Yangi buyurtma kelganda shu chatlarga xabar tushadi.

Keyin **Kategoriyalar** → **Taomlar** ni to'ldiring.

---

## 5a. Kuryerlar

Panelning **Kuryerlar** bo'limida:

1. **Kuryer qo'shish** — Telegram ID, ism, telefon. ID'ni kuryerning o'zi
   [@userinfobot](https://t.me/userinfobot) dan oladi.
2. Kuryer botni bir marta ochib `/start` bosishi kerak — aks holda
   Telegram unga xabar yubora olmaydi.
3. **Xodimlar guruhi** (ixtiyoriy): botni guruhga qo'shing va guruhda
   administrator `/guruh` deb yozsin. Guruh o'zi biriktiriladi.

Buyurtma tushganda kuryerlarga (va guruhga) xabar boradi, lekin
**tugma darhol chiqmaydi**:

| Holat | Kuryer nima ko'radi |
|---|---|
| **Yangi** | «⏳ Admin tasdiqlashini kutmoqda» — olish tugmasi yo'q |
| **Qabul qilindi** | `[📦 Oldim]` — admin panelda tasdiqlagach o'zi paydo bo'ladi |
| **Yetkazilmoqda** | `[📍 Lokatsiyani olish]` `[✅ Yetkazildi]` |
| **Yetkazildi** | Tugmalar yo'q, «🎉 Yetkazildi» |

Ya'ni tartib: **admin qabul qiladi → kuryer oladi → yetkazadi.**
«Oldim» ni birinchi bosgan kuryer buyurtmani oladi; shundan keyin
mijozning ismi va telefoni ochiladi va mijozga xabar ketadi.

Guruhda kuryer bo'lmagan odam tugmani bossa — «bu tugma faqat kuryer
uchun» deb chiqadi va hech narsa o'zgarmaydi.

> ⚠️ Bu tugmalar **bot ishlab turganda** ishlaydi. Bot o'chiq bo'lsa,
> buyurtma baribir keladi va panelda ko'rinadi — faqat kuryer tugmasi
> javob bermaydi. Shuning uchun botni doimiy serverga ko'chirish tavsiya
> etiladi.

---

## 6. Botni ishga tushirish

Bot faqat mijoz bilan muloqot uchun kerak (`/start`, menyu tugmasi).

```bash
cd bot
pip install -r requirements.txt
python bot.py
```

`.env` fayli loyiha ildizida allaqachon to'ldirilgan (git'ga tushmaydi).
Bot doimiy ishlashi uchun uni VPS yoki Railway'ga qo'ying — lekin
o'chib qolsa ham buyurtmalar yo'qolmaydi.

BotFather'da mini app tugmasini ham qo'ying:
`/mybots` → bot → **Bot Settings** → **Menu Button** → mini app URL.

---

## 7. Tekshirish ro'yxati

- [ ] `/admin` ochiladi, email+parol bilan kiriladi
- [ ] Kategoriya va taom qo'shildi, mini appda darhol ko'rindi
- [ ] Taomni «Stop-list» ga qo'yganda ilovada «Tugagan» bo'lib chiqadi
- [ ] Ish vaqti tashqarisida buyurtma berishga urinilganda ish vaqti oynasi chiqadi
- [ ] Buyurtma berilganda adminga Telegram xabari keldi (bot o'chiq bo'lsa ham)
- [ ] Panelda status o'zgartirilganda mijozga Telegram xabari bordi
- [ ] Karta bilan to'lovda chek ilovadan yuborildi va panelda ko'rindi
- [ ] Promokod qo'llanganda chegirma to'g'ri hisoblandi
- [ ] Xabarnoma (broadcast) yuborildi

### Xatolarni qayerdan ko'rish

- **Mini app / panel:** brauzer konsoli (F12)
- **API:** Vercel → loyiha → **Logs** (`[auth]`, `[orders]`, `[admin:...]` teglari)
- **Bot:** terminal oynasidagi log

---

## Eslatmalar

- Panelga kirish huquqi ikki qavatli: Firebase Auth paroli **va**
  `settings/admins` hujjatidagi email ro'yxati. Adminni panelidan
  o'chirsangiz, uning tokeni darhol bekor qilinadi.
- `ADMIN_SETUP_KEY` — panelga kirishning zaxira yo'li. Uni maxfiy saqlang.
- Xabarnoma katta ro'yxatga paketlab yuboriladi; sahifani yopmang.
