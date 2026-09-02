# Afsona — loyihaning to'liq tahlili

> **Sana:** 2026-09-01
> **Qamrov:** `api/` (9 endpoint + 8 kutubxona), `src/` (mini app), `src/admin/`
> (panel), `bot/`, Firestore va Storage qoidalari, sozlash fayllari.
> Jami ~21 000 satr kod o'qib chiqildi.
>
> **Holat:** hech narsa o'zgartirilmadi. Bu — ro'yxat va reja.
> Siz tasdiqlaganingizdan keyin bajarishni boshlayman.


---

## ✅ 1-TO'LQIN BAJARILDI — 2026-09-01

| | Ish | Holat |
|---|---|---|
| A-1 | Bekor qilinganda ombor qoldig'ini qaytarish | ✅ |
| A-2 | Mijoz bekor qilsa — kuryer va mijoz xabarlari | ✅ |
| A-3 | `settings` ruxsatlarini yopish | ✅ chiqarildi |
| A-4 | `seed` amalini himoyalash | ✅ |
| A-6 | Hero rasmni siqish (1.9 MB → 214 KB) | ✅ |
| B-1 | Taom o'chirilganda rasmlarni tozalash | ✅ |
| — | **Qo'shimcha:** bekor qilish faqat naqd to'lovda | ✅ |
| — | **Qo'shimcha:** `channelPosts` qoidasi (yo'q edi) | ✅ chiqarildi |

**Ish paytida topilgan yangi nuqson:** `channelPosts` kolleksiyasi uchun
Firestore qoidasi umuman yozilmagan ekan — u oxirgi
`allow read, write: if false` ga tushib qolardi. Natijada **Kanal
sahifasidagi «Yuborilgan e'lonlar» tarixi hech qachon yuklanmagan**:
ro'yxat jimgina bo'sh turardi va eski postlarni «Aksiya tugadi» qilish
yoki o'chirish imkoni yo'q edi. Qoida qo'shildi, tarix ishladi.

### Bekor qilish qoidasi (buyurtmachi qarori)

Mijoz endi faqat **naqd** to'lovdagi buyurtmani o'zi bekor qila oladi.
Karta bilan to'langan buyurtmada pul allaqachon o'tkazilgan bo'lishi
mumkin — uni qaytarish odam qarorini talab qiladi, shuning uchun bunday
buyurtma faqat operator orqali bekor qilinadi.

Ilovada karta buyurtmasida «Bekor qilish» tugmasi **umuman
ko'rsatilmaydi** (mijoz bosib, xato olishini kutmasin), server ham
o'sha qoidani mustaqil tekshiradi.

> **Chekka holat, e'tiboringizga:** mijoz «Karta» ni tanlab, hali chek
> yubormagan bo'lsa ham bekor qila olmaydi — u operatorga murojaat
> qilishi kerak. Agar «to'lov qilinmagan bo'lsa bekor qila olsin»
> desangiz, bir qatorlik o'zgarish bilan yumshataman.

### O'zgargan fayllar

- `api/_lib/stock.ts` — **yangi**, ombor qoldig'i uchun umumiy modul
- `api/admin.ts` — status va qoldiq bitta tranzaksiyada; `seed` himoyasi
- `api/order-cancel.ts` — naqd qoidasi, umumiy modul, xabarlar
- `firestore.rules` — `settings` ruxsatlari, `channelPosts` qoidasi
- `src/admin/lib/db.ts` — `orphanImages`, rasm tozalash
- `src/admin/pages/ProductsPage.tsx` — o'chirishda rasmlarni uzatish
- `src/pages/HomePage.tsx` + `src/images/hero-food.webp` — yengil rasm
- `src/pages/OrdersPage.tsx` — karta buyurtmasida tugma yashirin

### Tekshirilgani

- Ombor qaror jadvali 7 holatda (ikki marta hisoblash yo'q)
- Qoidalar **jonli Firestore'da**: kirgan mijoz `payment`/`delivery` ni
  o'qiydi, `admins`/`couriers`/`channel` ni **o'qiy olmaydi**
- `seed`: noto'g'ri kalit 3 martadan keyin bloklanadi; to'g'ri kalit
  bilan ham «admin allaqachon mavjud» deb rad etadi
- Yetim rasm aniqlash 5 holatda (umumiy rasm o'chib ketmaydi)
- Panelning barcha sahifalari va mini app qayta tekshirildi
- `tsc`, `eslint`, `vite build` — toza

### Keyingi qadam

2-to'lqin (`A-5` limit, `A-7` promokod, `B-5` bildirishnomalar,
`B-11` Telegram navbati) — sizning tasdig'ingizni kutadi.


---

## ✅ 2-TO'LQIN BAJARILDI — 2026-09-01

| | Ish | Holat |
|---|---|---|
| A-5 | Buyurtmalarga chegara + sahifalash | ✅ |
| A-7 | Promokod `usedBy` → ostki kolleksiya | ✅ |
| B-5 | Bildirishnomalarni cheklash va tozalash | ✅ |
| B-11 | Telegram navbati va `429` qayta urinishi | ✅ |
| — | **Yo'l-yo'lakay:** C-3 (promokod qoidalari birlashtirildi) | ✅ |

### A-5 — buyurtmalar chegarasi

Jonli obuna endi **oxirgi 400 ta** buyurtma bilan cheklangan
(`orderBy('createdAt','desc') + limit`). Ilgari chegara umuman yo'q edi.

Statistika va bosh sahifa uzoq davrni ko'rsatadi, shuning uchun ular
chegaralangan ro'yxatga tayanmaydi: yangi `useOrdersRange` hook tanlangan
davrni **bir marta** o'qiydi va jonli ro'yxat bilan birlashtiradi. Bir xil
buyurtma ikkalasida bo'lsa — jonli qiymat ustun turadi, ya'ni status
o'zgarishi darhol ko'rinadi.

Buyurtmalar sahifasida «Eskiroq buyurtmalarni yuklash» tugmasi — u faqat
ro'yxat chegaraga to'lganda chiqadi.

Obunalar ham ajratildi: chegara oshganda faqat buyurtmalar qayta
o'qiladi, taomlar/mijozlar/sozlamalar tegilmaydi.

### A-7 — promokod foydalanishi

`usedBy` massivi o'rniga `promocodes/{id}/uses/{userId}` hujjatlari.
Massiv har buyurtmada butunlay qayta yozilar va cheksiz o'sib,
Firestore'ning 1 MB hujjat chegarasiga borib urilardi.

**Eski massiv ham tekshiriladi** — allaqachon ishlatilgan promokodlardagi
mijozlar koddan ikkinchi marta foydalana olmaydi.

Yo'l-yo'lakay C-3 ham hal bo'ldi: qoidalar `api/_lib/promo.ts` da bitta
joyda. Ilgari ular `/api/promo` va `/api/orders` da so'zma-so'z
takrorlangan edi va biri o'zgarsa ikkinchisi eskirardi.

### B-5 — bildirishnomalar

Har mijozda **100 tadan** ko'p bildirishnoma saqlanmaydi: yangi yozuv
qo'shilganda (o'rtacha har 20-marta) eng eskilari o'chiriladi. Ilova
ekranga eng yangi 50 tasini chiqaradi.

> **Eslatma:** to'g'ri yo'l `where('userId') + orderBy('date') + limit`
> bo'lardi, lekin unga Firestore'da composite indeks kerak. Indeks
> yaratishga urinib ko'rdim — service account'da ruxsat yo'q
> (`PERMISSION_DENIED`). Shuning uchun soni cheklandi, saralash esa
> mijoz tomonida qoldi. Natija bir xil, xarajat esa hozirgi hajmda
> sezilmaydi.
>
> `firestore.indexes.json` va `scripts/deploy-indexes.mjs` tayyor turibdi.
> Google Cloud konsolida service account'ga **Cloud Datastore Index
> Admin** rolini bersangiz, `node scripts/deploy-indexes.mjs` ishlaydi va
> keyin so'rovlarni chinakam serverda tartiblash mumkin bo'ladi.

### B-11 — Telegram navbati

Barcha Telegram chaqiruvlari bitta navbatdan o'tadi: orasida 40 ms
tanaffus, `429` kelganda esa Telegram aytgan `retry_after` ni kutib
2 martagacha qayta urinish. Ilgari na navbat, na qayta urinish bor edi —
chegaraga urilgan xabar jimgina yo'qolardi.

Chegara: navbat bitta funksiya nusxasi ichida ishlaydi. Portlash aynan
shu yerda bo'ladi (xabarnoma paketi, kuryerlarga tarqatish), shuning
uchun foydasi katta — lekin bu global cheklov emas.

### Yangi fayllar

- `api/_lib/promo.ts` — promokod qoidalari, bitta joyda
- `src/admin/lib/use-orders-range.ts` — davr bo'yicha + jonli birlashma
- `firestore.indexes.json`, `scripts/deploy-indexes.mjs` — ruxsat kutmoqda

### Tekshirilgani

- `limit(5)` va `limit(3)` aynan eng yangi 5 va 3 tasini qaytardi
- `loadOrdersSince`: 3 kun → 7 ta, 1 kun → 3 ta buyurtma
- Promokod qoidalari 9 holatda; eski massiv mosligi 4 holatda
- Jonli `/api/promo`: foydalanmagan → 200, `uses` hujjati bilan → rad,
  eski `usedBy` bilan → rad, tozalangach → yana 200 (sinov ma'lumoti
  o'chirildi)
- Bildirishnoma kesish 5 hajmda (49/100/101/150/300)
- Telegram: `429` → `retry_after` kutib 3-urinishda muvaffaqiyat;
  5 ta parallel xabar 44–46 ms oraliq bilan ketma-ket ketdi
- Panel va mini app qayta tekshirildi, `tsc`/`eslint`/`build` toza

### Keyingi qadam

3-to'lqin (`D-1` bot kalitini chiqarish, `D-2` o'lcham/rang tozalash,
`C-1` `hours.ts` birlashtirish) — tasdig'ingizni kutadi.


---

## ✅ 3-TO'LQIN BAJARILDI — 2026-09-01

| | Ish | Holat |
|---|---|---|
| D-1 | Bot'dan Firebase kalitini butunlay chiqarish | ✅ |
| D-2 | O'lcham/rang qoldig'ini o'chirish | ✅ |
| C-1 | `hours.ts` ni birlashtirish | ✅ |
| D-3 | Ishlatilmagan tarjima kalitlari | ✅ 22 ta |
| D-5 | `countProductsInCategory` | ✅ |
| D-6 | `.tsbuildinfo` fayllarini indeksdan chiqarish | ✅ |
| C-8 | `console.log` lar | ✅ |
| C-7 | TelegramGate i18n | ⚠️ tahlilim noto'g'ri edi — pastga qarang |

### D-1 — bot endi Firebase'ni bilmaydi 🔐

`bot/firebase_db.py` (**818 satr, 42 funksiya**) butunlay o'chirildi —
bot ulardan atigi uchtasini ishlatardi.

O'sha uchtasi uchun API'ga uchta amal qo'shildi (`BOT_API_SECRET` bilan
himoyalangan): `bot.info` (restoran aloqasi + ish vaqti), `bot.user`
(telefon saqlanganmi), `bot.phone` (raqamni saqlash). Restoran ma'lumoti
2 daqiqaga keshlanadi.

Natijada:
- `firebase-admin` bog'liqligi bot'dan olib tashlandi
- `bot/config.py` dagi service account mantiqi o'chirildi
- **Firebase kaliti endi bot serverida kerak emas**

> **Railway'da qilishingiz kerak:** `FIREBASE_SERVICE_ACCOUNT` (va bo'lsa
> `FIREBASE_KEY_FILE`, `FIREBASE_STORAGE_BUCKET`) o'zgaruvchilarini
> **o'chirib tashlang**. Bot ularsiz ishlaydi. Shundan keyin bot serveri
> buzilsa ham, u orqali bazaga kirib bo'lmaydi.
>
> Botga kerak bo'lgan o'zgaruvchilar: `BOT_TOKEN`, `BOT_USERNAME`,
> `MINI_APP_URL`, `ADMIN_PANEL_URL`, `BOT_API_SECRET`, `ADMIN_CHAT_IDS`.

### D-2 — o'lcham va rang olib tashlandi

Mini appda to'liq UI bor edi (taom sahifasida tanlash, katalogda filtr),
lekin admin panelda ularni kiritish imkoni yo'q edi — ya'ni mijoz ularni
**hech qachon ko'rmasdi**. Kiyim do'koni shablonidan qolgan.

Savat kaliti soddalashdi: `${id}_${o'lcham}_${rang}` → `${id}`.
Eski saqlangan savatlar ishlayveradi — tekshirdim: eski formatdagi
`209219_nosize_nocolor` savati 2 ta bo'lib to'g'ri ko'rindi.

Buyurtma yozuvidan ham `size`/`color` maydonlari olib tashlandi.

### C-1 — ish vaqti bitta manbada

`shared/hours.ts` yaratildi, `src/utils/hours.ts` va `api/_lib/hours.ts`
endi undan qayta eksport qiladi. Ilgari ~190 satr kod ikki faylda
nusxalangan va qo'lda sinxronlanardi.

### C-7 — tahlilimdagi xato

Hisobotda «TelegramGate i18n ishlatmaydi» deb yozgandim. Tekshirsam,
u `main.tsx` da **I18nProvider'dan tashqarida** render qilinadi — ya'ni
`t()` u yerda ishlashi mumkin emas. Ikki tilda qattiq yozilgani ataylab
va to'g'ri: bu ekran birinchi marta kirgan odamga chiqadi, uning til
tanlovi hali ma'lum emas.

Shuning uchun teskarisini qildim: ishlatib bo'lmaydigan `gate.*`
kalitlari o'chirildi, komponentdagi izoh esa sababni aniq yozadi.

### ⚠️ Yangi topilma: `node_modules` git'da

`.gitignore` da `node_modules/` bor, lekin u **ilgari commit qilingan** —
shuning uchun git uni hamon kuzatib turibdi:

```
node_modules'dagi kuzatilayotgan fayllar : 9 864
Butun repodagi fayllar                   : 10 031
.git hajmi                               : 46 MB
```

Ya'ni repoyingizning **98%** — bog'liqliklar. Har `npm install` katta
diff beradi, klonlash sekin.

Tuzatish bir buyruq:

```
git rm -r --cached node_modules
```

Fayllar diskda qoladi, faqat kuzatuvdan chiqadi. Lekin keyingi commit
~9 864 ta o'chirishni ko'rsatadi — bu **sizning qaroringiz** bo'lgani
uchun o'zim bajarmadim. Aytsangiz, qilib beraman.

D-6 doirasidagi ikkita `.tsbuildinfo` faylini esa indeksdan chiqardim.

### Tekshirilgani

- Uchala bot amali jonli API'da: `bot.info`, `bot.user`, `bot.phone`
  (yozish sinovi tozalandi); maxfiy kalitsiz → `403`
- Bot fayllarida `firebase` so'zi umuman qolmadi, Python sintaksisi toza
- Katalog filtrida o'lcham/rang yo'q, narx va «mavjud taomlar» joyida
- Savat: yangi kalit `{"209219":{"quantity":1}}`; eski format ham ishlaydi
- `bot.info` ish vaqtini `shared/hours.ts` orqali to'g'ri qaytaradi
- Tarjima kalitlari: uz 230 / ru 230, tartib aynan mos
- `tsc`, `eslint`, `vite build` — toza

### Qolgan ishlar

4-to'lqin: `C-6` testlar, `B-3` xabarnoma optimallashtirish,
`B-4` sharh tranzaksiyasi. Va mayda qolganlar: B-2, B-6, B-7, B-8, B-9,
B-10, C-2, C-4, C-5.


---

## ✅ 4-TO'LQIN BAJARILDI — 2026-09-01

| | Ish | Holat |
|---|---|---|
| C-6 | Toza mantiqqa testlar | ✅ **77 ta test** |
| B-3 | Xabarnoma segmentlarini optimallash | ✅ |
| B-4 | Sharh tranzaksiyasini yengillatish | ✅ |

### C-6 — testlar

Node'ning **o'z** test vositasi ishlatildi (`node --test`) — yangi
bog'liqlik qo'shilmadi, u TypeScript'ni to'g'ridan-to'g'ri o'qiydi.

```
npm test
# yoki bevosita:
node --import ./tests/register.mjs --test "tests/*.test.ts"
```

| Fayl | Nima tekshiriladi | Testlar |
|---|---|---|
| `hours.test.ts` | Ish vaqti: vaqt mintaqasi, tungacha cho'zilgan smena, dam olish kuni | 15 |
| `promo.test.ts` | Promokodning har bir sharti, eski `usedBy` mosligi | 18 |
| `stock.test.ts` | Ombor hisobi va qoldiq qaytarish qarori | 13 |
| `courier.test.ts` | Kuryer tugmalari va **maxfiylik** (telefon qachon ko'rinadi) | 16 |
| `search.test.ts` | Qidiruv tartibi va pul formatlash | 15 |

Eng qimmatlisi — `courier.test.ts`: u «admin tasdiqlamaguncha Oldim
tugmasi chiqmasin» va «telefon buyurtma olingunicha yashirin» degan
qoidalarni qo'riqlaydi. Bular buzilsa mijoz ma'lumoti guruhga sizib
chiqadi.

> `api/` fayllari bir-birini `.js` kengaytmasi bilan import qiladi
> (Vercel talabi), Node esa `.ts` ni topa olmasdi. `tests/ts-resolver.mjs`
> shuni moslashtiradi — faqat testlarda, ishlab chiqarish kodiga
> tegmaydi.

### B-3 — xabarnoma segmentlari

Ilgari «qabul qiluvchilarni hisoblash» tugmasi butun `users`
kolleksiyasini to'liq hujjatlari bilan o'qir, «xarid qilganlar»
segmentida esa ustiga **butun `orders` kolleksiyasini** ham o'qirdi.
1000 mijoz va 10 000 buyurtmada bu bitta bosish uchun 11 000 o'qish edi.

Endi:
- **buyurtmalar umuman o'qilmaydi** — mijozda `hasOrders` bayrog'i bor
  (buyurtma yaratilganda qo'yiladi);
- faollik sanasi Firestore so'rovida filtrlanadi;
- hujjatdan faqat ikkita maydon olinadi (`select`) — ism, rasm va
  manzillar tashilmaydi.

Mavjud 5 mijozga bayroq `scripts/backfill-has-orders.mjs` bilan
qo'yildi. Barcha segmentlar jonli tekshirildi:
`buyers (5) + nonbuyers (0) = all (5)`.

### B-4 — sharh tranzaksiyasi

Ikkita cheksiz o'qish bor edi:

1. **«Sotib olganmi?»** — mijozning BARCHA yetkazilgan buyurtmalari
   o'qilardi. Endi `users/{id}/purchased/{taomId}` — bitta hujjat.
   Yozuvni buyurtma «Yetkazildi» bo'lganda API qo'yadi.

2. **Reyting** — mahsulotning BARCHA sharhlari o'qilardi. Endi
   `ratingSum` saqlanadi va yangi baho unga qo'shiladi.

Mavjud ma'lumot `scripts/backfill-reviews.mjs` bilan to'ldirildi:
16 ta yetkazilgan buyurtmadan 6 ta xarid yozuvi, 1 ta sharhdan reyting
yig'indisi.

Jonli sinov (keyin hammasi asl holiga qaytarildi):
- xarid yozuvisiz → `403` «avval sotib olishingiz kerak»
- xarid bilan, baho 4 → `200`, reyting 4.0 ga yangilandi
- takroriy sharh → `403` «allaqachon qoldirgansiz»

### Yangi fayllar

- `tests/` — 5 ta test fayli + `.js`→`.ts` moslashtiruvchi
- `scripts/backfill-has-orders.mjs`, `scripts/backfill-reviews.mjs`
- `package.json` ga `npm test` qo'shildi

### Tekshirilgani

- 77 ta testning hammasi o'tdi
- Xabarnomaning 5 segmenti jonli API'da, raqamlar o'zaro mos
- Sharh yo'lining uchala holati jonli API'da; sinov ma'lumoti to'liq
  tozalandi (taom reytingi aynan asl qiymatiga qaytarildi)
- Firestore qoidasiga `users/{id}/purchased` qo'shildi va chiqarildi
- `tsc`, `eslint`, `vite build` — toza

---

## Qisqacha xulosa

Loyiha **yaxshi qurilgan**. Eng muhim narsalar to'g'ri qilingan: narx serverda
hisoblanadi, Telegram imzosi tekshiriladi, buyurtma va sharh tranzaksiya bilan
yoziladi, maxfiy kalitlar git'ga tushmagan, i18n to'liq. Bular ko'p loyihada
yo'q.

Lekin **32 ta muammo** topildi. Ulardan:

| Daraja | Soni | Ma'nosi |
|---|---|---|
| 🔴 Jiddiy | 7 | Pul yoki ma'lumot yo'qoladi, yoki maxfiylik buziladi |
| 🟠 O'rta | 11 | Hozir sezilmaydi, 3–6 oydan keyin og'riq beradi |
| 🟡 Kichik | 8 | Sifat, tartib, kelajakdagi xatoning oldini olish |
| ⚪ Olib tashlash | 6 | Ishlatilmaydigan kod — ~1 100 satr |

**Eng muhim uchtasi**, agar boshqa hech narsa qilinmasa ham:

1. **Admin bekor qilganda ombor qoldig'i qaytarilmaydi** — taomlar sekin-asta
   "tugagan" holatga o'tib, sotuvdan chiqib ketadi.
2. **Panel barcha buyurtmalarni cheksiz yuklaydi** — bir yildan keyin panel
   ochilishi bir necha o'n sekund va Firestore hisobi qimmatlashadi.
3. **Bosh sahifadagi rasm 1.9 MB** — mijozning birinchi taassuroti shu.

---

# 🔴 A bo'limi — Jiddiy

## A-1. Bekor qilinganda ombor qoldig'i qaytarilmaydi

**Fayl:** [api/admin.ts:453](api/admin.ts) (`handleOrderStatus`)

Mijoz o'zi bekor qilsa — qoldiq qaytariladi ([api/order-cancel.ts:72](api/order-cancel.ts)).
**Admin panel orqali bekor qilinsa — qaytarilmaydi.**

Buyurtma yaratilganda qoldiq kamayadi ([api/orders.ts:302](api/orders.ts)):

```
stockUpdates.forEach(({ ref, stock }) => tx.update(ref, { stock }))
```

Admin «Bekor qilingan» yoki «Rad etildi» bosganda faqat status yoziladi.

**Nima bo'ladi:** har bekor qilingan buyurtma qoldiqni yeb ketadi. «Manti»
qoldig'i 68 ta edi — 20 ta bekor qilingandan keyin 48 ta ko'rinadi, aslida
68 ta. Nol ga yetganda taom o'zi stop-listga tushadi va **sotilmay qoladi**.
Restoran buni tushunmaydi.

**Yechim:** `handleOrderStatus` ichida bekor qilishni tranzaksiyaga o'rab,
`order-cancel.ts` dagi qoldiq qaytarish mantig'ini ishlatish. Ikkalasi uchun
bitta umumiy funksiya (`restoreStock`) yozish.
**Vaqt:** ~2 soat.

---

## A-2. Mijoz bekor qilsa — kuryer guruhida eski xabar qoladi

**Fayl:** [api/order-cancel.ts:74](api/order-cancel.ts)

Mijoz buyurtmani bekor qiladi → Firestore'da status o'zgaradi → admin panel
buni jonli ko'radi. Lekin:

- kuryer guruhidagi xabar **yangilanmaydi** — «📦 Oldim» tugmasi turaveradi;
- mijozga «bekor qilindi» tasdig'i **ketmaydi** (`notifyCustomerStatus`
  chaqirilmaydi).

Kuryer tugmani bosganda tranzaksiya uni to'xtatadi («Buyurtma bekor
qilingan») — ya'ni **xavfsiz**, lekin kuryer behuda vaqt sarflaydi va
guruhda noto'g'ri ma'lumot turadi.

**Yechim:** `order-cancel.ts` oxirida `syncCourierMessages` va
`notifyCustomerStatus` chaqirish.
**Vaqt:** ~1 soat.

---

## A-3. `settings/admins` va `settings/couriers` har qanday mijozga ochiq

**Fayl:** [firestore.rules:103](firestore.rules)

```
allow read: if docId == 'hours' || docId == 'brand' || signedIn();
```

`signedIn()` — ilovaga kirgan **istalgan mijoz**. `settings` kolleksiyasida
esa:

| Hujjat | Ichida nima bor |
|---|---|
| `admins` | **panel email'lari** va admin Telegram ID'lari |
| `couriers` | kuryer ismlari, **telefon raqamlari**, Telegram ID'lari, **xodimlar guruhi ID'si** |
| `channel` | kanal biriktiruvi |
| `payment`, `delivery` | karta raqami, yetkazish narxi — bular mijozga kerak |

Ya'ni har qanday mijoz brauzer konsolidan xodimlaringizning shaxsiy
ma'lumotlarini va admin email'ini o'qiy oladi. Email — parolning yarmi.

**Yechim:** ruxsatni hujjat bo'yicha aniq ajratish:

```
allow read: if docId in ['hours', 'brand']
            || (signedIn() && docId in ['payment', 'delivery'])
            || isAdmin();
```

**Vaqt:** ~30 daqiqa (qoida + `deploy-rules.mjs` bilan chiqarish).

---

## A-4. `seed` amali mavjud admin parolini almashtira oladi

**Fayl:** [api/admin.ts:173](api/admin.ts)

`action: 'seed'` `requireAdmin` dan **oldin** ishlaydi — uni faqat
`ADMIN_SETUP_KEY` himoya qiladi. Ichida esa
[`upsertAuthUser`](api/admin.ts:185) chaqiriladi, u **mavjud
foydalanuvchining parolini yangilaydi**.

Ya'ni bu kalitni bilgan odam:
1. sizning email'ingizga yangi parol qo'yadi,
2. o'zini admin ro'yxatiga qo'shadi,
3. panelga to'liq kiradi.

Ustiga — **urinishlar soni cheklanmagan**, ya'ni kalitni tanlab ko'rish
mumkin.

**Yechim:**
- birinchi admin yaratilgandan keyin `seed` ni umuman rad etish
  («admin allaqachon bor — panel orqali qo'shing»);
- yoki mavjud foydalanuvchi parolini almashtirmaslik (faqat yangi yaratish);
- urinishlarni cheklash (bir IP'dan daqiqada 3 marta).

**Vaqt:** ~1 soat.

---

## A-5. Panel barcha buyurtmalarni cheksiz yuklaydi

**Fayl:** [src/admin/lib/db.ts:129](src/admin/lib/db.ts)

```
return onSnapshot(collection(db, path), ...)
```

Butun loyihada **birorta `limit()` yoki `orderBy()` yo'q** — na panelda,
na mini appda. Panel har ochilganda `orders`, `users`, `products`,
`categories`, `promocodes` kolleksiyalari **to'liq** yuklanadi.

Hisoblab ko'ramiz: kuniga 30 buyurtma → yilida ~11 000 hujjat. Har biri
~1.5 KB → panel har ochilganda **~16 MB**. Firestore hujjat o'qishiga pul
oladi: 11 000 o'qish × kuniga 20 marta ochish × 2 admin = **kuniga 440 000
o'qish**. Bepul chegara — kuniga 50 000.

**Nima bo'ladi:** 6 oydan keyin panel sekinlashadi, 1 yildan keyin Firestore
hisobi keladi.

**Yechim:**
- `watchOrders` → `query(collection, orderBy('createdAt','desc'), limit(300))`
- Statistika sahifasi uchun alohida, sana oralig'i bo'yicha so'rov
- «Eskiroq buyurtmalar» tugmasi (sahifalash)

**Vaqt:** ~4 soat (Statistika sahifasini ham moslash kerak).

---

## A-6. Bosh sahifadagi rasm — 1.9 MB

**Fayl:** [src/pages/HomePage.tsx:6](src/pages/HomePage.tsx) →
`src/images/hero-food.png` (1 899 KB)

Bu rasm **birinchi ekranda** turadi va lazy yuklanmaydi. Mijozning
telefonida 3G bo'lsa — 15–25 sekund.

Taqqoslash uchun: butun JavaScript (Firebase SDK bilan) 237 KB (gzip).
Ya'ni **bitta rasm butun ilovadan 8 barobar og'ir**.

**Yechim:** WebP formatiga o'tkazish + o'lchamini ekranga moslash.
1.9 MB → taxminan **120–180 KB** (10 barobar yengil), ko'z bilan farqi
sezilmaydi.

**Vaqt:** ~30 daqiqa.

---

## A-7. Promokod `usedBy` massivi cheksiz o'sadi

**Fayl:** [api/orders.ts:297](api/orders.ts)

```
usedBy: [...usedBy, userId],
```

Har foydalanish massivga bitta ID qo'shadi. Firestore hujjat chegarasi —
**1 MB**. Bitta ID ~8 bayt → ~100 000 foydalanishda hujjat yoriladi.

Undan oldinroq muammo boshlanadi: **har buyurtmada** butun massiv o'qiladi
va qayta yoziladi. 5 000 elementli massiv har buyurtmada ikki marta
tashiladi.

**Yechim:** `promocodes/{code}/uses/{userId}` — alohida hujjatlar (ostki
kolleksiya). Tekshiruv bitta hujjat o'qish bilan bo'ladi, o'sish cheklanmaydi.
**Vaqt:** ~2 soat.

---

# 🟠 B bo'limi — O'rta

## B-1. Taom o'chirilganda rasmlari Storage'da qoladi

**Fayl:** [src/admin/lib/db.ts:221](src/admin/lib/db.ts)

`deleteProduct` / `deleteProducts` faqat Firestore hujjatini o'chiradi.
`removeUploaded` funksiyasi bor, lekin faqat **tahrirlash oynasida rasmni
olib tashlaganda** ishlatiladi ([ProductsPage.tsx:388](src/admin/pages/ProductsPage.tsx)).

Natija: o'chirilgan har taomning rasmlari Storage'da abadiy qoladi va oyma-oy
pul yeydi. Menyu bir necha marta yangilansa — yuzlab yetim fayl.

**Yechim:** o'chirishdan oldin `product.images` bo'yicha `removeUploaded`.
**Vaqt:** ~1 soat.

---

## B-2. Buyurtma o'chirilganda hech narsa tozalanmaydi

**Fayl:** [api/admin.ts:563](api/admin.ts)

```
await (await adminDb()).collection('orders').doc(orderId).delete()
```

Bir qator. Tozalanmaydi:
- ombor qoldig'i (A-1 bilan bir xil muammo),
- kuryer guruhidagi xabarlar → «Buyurtma topilmadi» deydigan yetim tugmalar,
- mijozga hech qanday xabar bermaydi.

**Yechim:** o'chirishdan oldin kuryer xabarlarini o'chirish, qoldiqni
qaytarish. Yoki umuman «o'chirish» o'rniga «arxivlash» qilish — buyurtma
tarixi buxgalteriya uchun kerak.
**Vaqt:** ~1,5 soat.

---

## B-3. Xabarnoma barcha foydalanuvchi va buyurtmalarni o'qiydi

**Fayl:** [api/admin.ts:324](api/admin.ts)

```
const usersSnap = await db.collection('users').get()
// + segment 'buyers' bo'lsa: barcha orders ham
```

1 000 mijozda — 1 000 o'qish har «qabul qiluvchilarni hisoblash» bosilganda.
Buyurtmalar bo'yicha segment tanlansa — ustiga barcha buyurtmalar.

Ustiga, Telegram'ga yuborish **ketma-ket va kutishsiz** ketadi
([api/admin.ts:404](api/admin.ts)) — bot uchun chegara ~30 xabar/sekund,
`429` javobini qayta urinish yo'q. Katta xabarnomada bir qismi yo'qoladi.

**Yechim:** segmentni tayyor bayroq bilan hisoblash (`users.hasOrders`),
yuborishga 40 ms oraliq va `retry_after` ni qayta urinish.
**Vaqt:** ~3 soat.

---

## B-4. Sharh yozishda butun tarix o'qiladi

**Fayl:** [api/reviews.ts:66](api/reviews.ts)

Tranzaksiya ichida:
- foydalanuvchining **barcha** «Yetkazildi» buyurtmalari,
- mahsulotning **barcha** sharhlari.

Sodiq mijozda 200 buyurtma, ommabop taomda 500 sharh bo'lsa — bitta sharh
yozish uchun 700 hujjat o'qiladi. Firestore tranzaksiyasida hujjat
chegarasi ham bor.

**Yechim:** buyurtmani `limit(1)` bilan mahsulot bo'yicha izlash
(`products.product.id` uchun massiv maydon qo'shish), reytingni butun
ro'yxatni o'qimasdan yig'indi bilan yangilash (`ratingSum`, `ratingCount`).
**Vaqt:** ~2 soat.

---

## B-5. Bildirishnomalar hech qachon tozalanmaydi

`notifications` kolleksiyasiga har status o'zgarishida yozuv qo'shiladi va
**hech qachon o'chirilmaydi**. Bir yil ilovadan foydalangan mijozda 300+
bildirishnoma to'planadi va **har ilova ochilganda hammasi yuklanadi**
([src/lib/firebase.ts:314](src/lib/firebase.ts)).

**Yechim:** oxirgi 50 tasini ko'rsatish (`limit`), 90 kundan eskisini
o'chirish.
**Vaqt:** ~1,5 soat.

---

## B-6. Kategoriya o'chirilsa taomlar yetim qoladi

**Fayl:** [src/admin/pages/CategoriesPage.tsx:37](src/admin/pages/CategoriesPage.tsx)

Ogohlantirish bor («kategoriyasiz qoladi»), lekin taomlar bilan hech narsa
qilinmaydi. Ular katalogda faqat «Barchasi» ostida qoladi va topilmay
qoladi.

**Yechim:** o'chirishdan oldin «Taomlarni qaysi kategoriyaga o'tkazamiz?»
degan tanlov.
**Vaqt:** ~1,5 soat.

---

## B-7. Kuryer tugmasi Telegram chegarasidan uzoq kutadi

**Fayl:** [bot/bot.py:333](bot/bot.py)

```
timeout=aiohttp.ClientTimeout(total=25)
```

Telegram `callback_query` javobini **~15 sekund** kutadi. Vercel «sovuq
start» qilsa (uzoq tinchlikdan keyin birinchi so'rov), 25 sekundlik kutish
Telegram chegarasidan oshadi va kuryer «query is too old» xatosini ko'radi —
tugma bosilgan-bosilmagani noma'lum qoladi.

**Yechim:** timeout'ni 10 sekundga tushirish; tugma bosilishi bilan darhol
`callback.answer()` qilib, natijani keyin xabarni tahrirlash orqali
ko'rsatish.
**Vaqt:** ~1,5 soat.

---

## B-8. Bot har so'rovda yangi HTTP sessiya ochadi

**Fayl:** [bot/bot.py:328](bot/bot.py)

```
async with aiohttp.ClientSession() as session:
```

Har tugma bosilishida yangi TCP + TLS qo'l berish. Bu 100–300 ms qo'shimcha
kechikish — yuqoridagi 15 sekundlik poygada muhim.

**Yechim:** bitta sessiyani bot ishga tushganda ochib, qayta ishlatish.
**Vaqt:** ~30 daqiqa.

---

## B-9. Chek havolasi tekshiruvi to'liq emas

**Fayl:** [api/receipt.ts:39](api/receipt.ts)

```
if (!/^https:\/\/firebasestorage\.googleapis\.com\//.test(url))
```

Faqat **domen** tekshiriladi. Mijoz o'z buyurtmasiga istalgan taom rasmini
yoki (havolasini bilsa) boshqa odamning chekini biriktira oladi.

**Yechim:** havola ichida `receipts%2F<uid>%2F` borligini ham tekshirish.
**Vaqt:** ~20 daqiqa.

---

## B-10. `usedBy` va `firstOrderOnly` bekor qilingan buyurtmani hisoblaydi

**Fayl:** [api/orders.ts:183](api/orders.ts)

«Faqat birinchi buyurtma uchun» promokod tekshiruvi **bekor qilingan**
buyurtmani ham hisoblaydi. Mijozning birinchi buyurtmasi bekor qilingan
bo'lsa, u promokoddan foydalana olmaydi.

**Yechim:** so'rovga `status not-in ['Bekor qilingan','Rad etildi']` qo'shish.
**Vaqt:** ~30 daqiqa.

---

## B-11. Telegram xabarlarida navbat va qayta urinish yo'q

Butun loyihada `sendMessage` chaqiruvlari **ketma-ket, kutishsiz** ketadi va
`429 Too Many Requests` javobi qayta urinilmaydi
([api/_lib/telegram.ts](api/_lib/telegram.ts)). Guruhga chegara ~20
xabar/daqiqa.

Kuniga 30 buyurtmada muammo yo'q. Kuniga 100 buyurtmada — xabarlarning bir
qismi jimgina yo'qoladi va buni hech kim bilmaydi (`console.error` faqat
Vercel jurnaliga tushadi).

**Yechim:** kichik navbat + `retry_after` ni hurmat qilish + yuborilmagan
xabar haqida adminga signal.
**Vaqt:** ~3 soat.

---

# 🟡 C bo'limi — Kichik, lekin qilinsa yaxshi

## C-1. `hours.ts` ikki nusxada, qo'lda sinxronlanadi

`api/_lib/hours.ts` (194 satr) va `src/utils/hours.ts` (193 satr) —
**7 ta izoh satridan boshqa hammasi bir xil**. Fayllarning o'zida shunday
yozilgan: *«Birini o'zgartirsangiz, ikkinchisini ham yangilang»*.

Bu — kelajakdagi xatoning tayyor manbayi: server «yopiq», mijoz «ochiq»
deb ko'rsatadigan holat.

**Yechim:** `shared/hours.ts` ga chiqarib, ikkalasidan import qilish.
**Vaqt:** ~1 soat.

---

## C-2. `money()` uch nusxada

- [src/admin/lib/format.ts:3](src/admin/lib/format.ts)
- [api/_lib/order-notify.ts:140](api/_lib/order-notify.ts) — **bir xil**
- [src/data.ts:21](src/data.ts) — i18n bilan, boshqacha

**Yechim:** birinchi ikkitasini birlashtirish.
**Vaqt:** ~30 daqiqa.

---

## C-3. Promokod tekshiruvi ikki joyda takrorlangan

[api/promo.ts:44–66](api/promo.ts) va [api/orders.ts:243–271](api/orders.ts)
— ~40 satr bir xil mantiq (muddat, chegara, `usedBy`, minimal summa).
Biri o'zgarsa ikkinchisi eskiradi.

**Yechim:** `api/_lib/promo.ts` — bitta `validatePromo()`.
**Vaqt:** ~1 soat.

---

## C-4. Mini appda `window.confirm`

**Fayl:** [src/pages/OrdersPage.tsx:86](src/pages/OrdersPage.tsx)

```
if (!window.confirm(t('orders.cancelConfirm'))) return
```

Telegram mini app ichida brauzerning tizim oynasi begona ko'rinadi va
ba'zi WebView'larda **umuman ochilmaydi** — u holda bekor qilish
ishlamaydi.

Telegram'ning o'z `showConfirm` metodi loyihada **allaqachon tiplangan**
([src/utils/telegram.ts:71](src/utils/telegram.ts)), faqat ishlatilmagan.

**Yechim:** `showConfirm` uchun o'ram yozib, shu yerda ishlatish.
**Vaqt:** ~30 daqiqa.

---

## C-5. `package.json` da `"latest"` versiyalar

```
"react": "latest", "react-dom": "latest", "vite": "latest",
"lucide-react": "latest", "@vitejs/plugin-react": "latest",
"@tailwindcss/vite": "latest"
```

`package-lock.json` hozircha himoya qilyapti. Lekin istalgan `npm install`
hammasini yangi **major** versiyaga ko'tarib, hech qanday kod
o'zgarishisiz production build'ni sindirishi mumkin.

**Yechim:** hozirgi ishlaydigan versiyalarni qat'iy yozish (`^19.2.0` kabi).
**Vaqt:** ~20 daqiqa.

---

## C-6. Test umuman yo'q

Loyihada birorta test fayli yo'q. Pul bilan ishlaydigan tizim uchun bu
xavf: narx hisobi, ish vaqti, promokod, status o'tishlari — hammasi qo'lda
tekshiriladi.

**Yechim:** faqat toza mantiqqa 20–30 ta test:
`getOpenState`, narx/chegirma hisobi, promokod tekshiruvi, kuryer status
o'tishlari, `courierButtons` jadvali.
**Vaqt:** ~4 soat. Bu kelajakda har o'zgarishda vaqt tejaydi.

---

## C-7. `TelegramGate` i18n ishlatmaydi

**Fayl:** [src/components/ui/TelegramGate.tsx:30](src/components/ui/TelegramGate.tsx)

Ikki til matni **kodga qattiq yozilgan**, holbuki `gate.title`, `gate.text`,
`gate.button` kalitlari ikkala tilda ham tayyor turibdi.

**Vaqt:** ~15 daqiqa.

---

## C-8. `console.log` production'da qoladi

[src/lib/firebase.ts](src/lib/firebase.ts) da 4 ta — har snapshot'da
konsolga yozadi. Mijoz ko'rmaydi, lekin ishlab chiqarishda keraksiz.

**Vaqt:** ~10 daqiqa.

---

# ⚪ D bo'limi — Olib tashlash mumkin

## D-1. `bot/firebase_db.py` — 818 satr, 3 tasi ishlatiladi 🔥

Faylda **42 ta funksiya** bor. `bot.py` esa faqat uchtasini ishlatadi:
`db.db`, `db.get_user`, `db.set_user_phone`.

Qolgani — bot ichidagi eski admin panelning qoldig'i: mahsulot qo'shish,
kategoriya boshqarish, hisobotlar, statistika, promokodlar, adminlar.
Hammasi endi web panelda.

**Bu shunchaki tartib masalasi emas.** Aynan shu fayl bot'dan
`firebase-admin` kutubxonasini va **service account kalitini** talab
qiladi — ya'ni Firebase'ning to'liq kaliti Railway serverida turibdi.

Uchta ishlatilayotgan joy (`settings/brand`, `settings/hours`, foydalanuvchi
telefoni) API orqali ham olinadi — bot API bilan allaqachon gaplashadi.

**Natija:**
- ~818 satr kod o'chadi,
- `firebase-admin` bog'liqligi yo'qoladi (bot yengillashadi),
- **Firebase kaliti Railway'dan butunlay chiqib ketadi** — xavfsizlik jihatidan
  eng katta yaxshilanish.

**Vaqt:** ~3 soat.

---

## D-2. O'lcham va rang — restoran uchun keraksiz

Mini appda to'liq ishlaydigan UI bor:
- taom sahifasida o'lcham va rang tanlash
  ([ProductDetailPage.tsx:219](src/pages/ProductDetailPage.tsx)),
- katalogda «O'lcham» va «Rang» filtrlari
  ([CatalogPage.tsx:69](src/pages/CatalogPage.tsx)).

Lekin **admin panelda ularni kiritish imkoni yo'q** — ya'ni ular hech
qachon to'ldirilmaydi va mijoz **hech qachon ko'rmaydi**. Bu kiyim
do'koni shablonidan qolgan.

Ustiga, ular ma'lumot tuzilmasini og'irlashtiradi: har buyurtma bandida
doim bo'sh `size` va `color`, savat kaliti esa `${id}_${size}_${color}`.

**Muhim:** `ROADMAP` ning 1-bandi — «Modifikatorlar va qo'shimchalar»
(porsiya: kichik/o'rta/katta). Bu **boshqa narsa** va uni to'g'ri qurish
kerak. Hozirgi o'lik kodni tozalash o'sha ishni osonlashtiradi.

**Vaqt:** ~2 soat.

---

## D-3. 18 ta ishlatilmagan tarjima kaliti

`common.currency`, `common.loading`, `common.retry`, `common.required`,
`catalog.filterSummary`, `catalog.sortAsc`, `catalog.sortDesc`,
`catalog.activeFilters`, `reviews.notPurchased`, `reviews.alreadyLeft`,
`theme.light`, `theme.dark`, `language.uz`, `language.ru`,
`language.changed`, `gate.title`, `gate.text`, `gate.button`
(ikkala tilda ham).

> Tekshirildi: `status.*` kalitlari **ishlatiladi** — ular dinamik
> chaqiriladi (`t(\`status.${status}\`)`), shuning uchun ro'yxatga
> kirmadi.

**Vaqt:** ~15 daqiqa.

---

## D-4. `cancelNotified` bayrog'i — o'lik

[api/order-cancel.ts:80](api/order-cancel.ts) uni yozadi, lekin uni
o'qiydigan yagona kod — `bot/firebase_db.py` ichidagi eski kuzatuv sikli,
u endi ishga tushmaydi. Bayroq hech qachon `true` bo'lmaydi.

D-1 bilan birga o'chadi.

---

## D-5. `countProductsInCategory` ishlatilmaydi

[src/admin/lib/db.ts](src/admin/lib/db.ts) da e'lon qilingan, lekin
`CategoriesPage` allaqachon yuklangan `products` massividan hisoblaydi.

**Vaqt:** ~5 daqiqa.

---

## D-6. `node_modules/.tmp/tsconfig.app.tsbuildinfo` git'da

`.gitignore` da `node_modules/` bor, lekin bu fayl allaqachon
kuzatilyapti — shuning uchun **har commit'da o'zgarib turadi** va diff'ni
ifloslantiradi.

**Yechim:** `git rm --cached node_modules/.tmp/tsconfig.app.tsbuildinfo`
**Vaqt:** ~5 daqiqa.

---

# ✅ Nima yaxshi qilingan

Adolat yuzasidan — bular ko'p loyihada yo'q va o'zgartirishga hojat yo'q:

| | |
|---|---|
| **Narx serverda** | Mijoz faqat «nimadan nechta» yuboradi; narx, chegirma, yetkazish — hammasi Firestore'dagi haqiqiy qiymatdan qayta hisoblanadi. Brauzerdan narx aldab bo'lmaydi. |
| **Telegram imzosi** | HMAC to'g'ri tekshiriladi, `timingSafeEqual` bilan, 24 soatlik muddat bilan ([telegram-auth.ts](api/_lib/telegram-auth.ts)). Namunaviy. |
| **Tranzaksiyalar** | Buyurtma, sharh, kuryer «Oldim» — hammasi atomik. Ikki kuryer bir vaqtda bosса ham buyurtma bittasiga tegadi. |
| **Maxfiy kalitlar** | `.env` va service account git'da yo'q va **hech qachon bo'lmagan** (tarix tekshirildi). |
| **Firestore qoidalari** | Umumiy tamoyil to'g'ri: mijoz pul bilan bog'liq narsani yoza olmaydi; oxirida `allow read, write: if false`. A-3 dan boshqa joyi mustahkam. |
| **i18n** | 249 kalit, ikkala tilda **aniq mos**, takror yo'q. |
| **Takroriy buyurtma** | `clientOrderId` bilan to'siladi — sekin internetda ikki marta bosilsa ham bitta buyurtma. |
| **Izohlar** | Kod izohlari **nima** emas, **nega** deb yozilgan. Bu kamdan-kam uchraydi va loyihani tushunishni ancha osonlashtirdi. |

---

# 📋 Taklif qilingan tartib

## 1-to'lqin — «Yo'qotishni to'xtatish» (~6 soat)

Bular hozir ham pul yoki ishonch yo'qotyapti:

| | Ish | Vaqt |
|---|---|---|
| A-1 | Bekor qilinganda ombor qoldig'ini qaytarish | 2 s |
| A-2 | Mijoz bekor qilsa — kuryer xabari va mijoz xabari | 1 s |
| A-3 | `settings` ruxsatlarini yopish | 0,5 s |
| A-4 | `seed` amalini himoyalash | 1 s |
| A-6 | Hero rasmni siqish (1.9 MB → ~150 KB) | 0,5 s |
| B-1 | Taom o'chirilganda rasmlarni tozalash | 1 s |

## 2-to'lqin — «Kelajakka tayyorlash» (~9 soat)

Hozir sezilmaydi, 6 oydan keyin og'riq beradi:

| | Ish | Vaqt |
|---|---|---|
| A-5 | Buyurtmalarga `limit` + sahifalash | 4 s |
| A-7 | Promokod `usedBy` ni ostki kolleksiyaga | 2 s |
| B-5 | Bildirishnomalarni cheklash va tozalash | 1,5 s |
| B-11 | Telegram navbati va qayta urinish | 3 s |

*(B-11 kuryer rejasidagi 1.3-band bilan bir xil ish — ikki marta qilinmaydi.)*

## 3-to'lqin — «Tozalash» (~7 soat)

| | Ish | Vaqt |
|---|---|---|
| D-1 | `bot/firebase_db.py` ni olib tashlash + kalitni Railway'dan chiqarish | 3 s |
| D-2 | O'lcham/rang qoldig'ini o'chirish | 2 s |
| C-1 | `hours.ts` ni birlashtirish | 1 s |
| C-3 | Promokod tekshiruvini birlashtirish | 1 s |
| D-3, D-5, D-6, C-8 | Mayda tozalashlar | 0,5 s |

## 4-to'lqin — «Ishonchlilik» (~9 soat)

| | Ish | Vaqt |
|---|---|---|
| C-6 | Toza mantiqqa testlar | 4 s |
| B-3 | Xabarnoma segmentlarini optimallash | 3 s |
| B-4 | Sharh tranzaksiyasini yengillatish | 2 s |

## Qolganlari

B-2, B-6, B-7, B-8, B-9, B-10, C-2, C-4, C-5, C-7 — har biri 20 daqiqadan
1,5 soatgacha. Ular yuqoridagi to'lqinlar bilan yo'l-yo'lakay qilinadi.

---

## Mening tavsiyam

**1-to'lqinni to'liq qilaylik** — 6 soat, va u haqiqiy yo'qotishlarni
to'xtatadi. Ayniqsa **A-1** (ombor) va **A-6** (rasm): birinchisi
restoranning menyusini jimgina buzib turibdi, ikkinchisi har bir yangi
mijozning birinchi taassuroti.

Keyin **D-1** (bot kaliti) — u xavfsizlik va tartibni birdan yaxshilaydi.

2-to'lqinni esa mijozlar soni o'sganda, lekin **panel sekinlashishidan
oldin** qilish kerak. Buni oldindan sezish oson: buyurtmalar 5 000 tadan
oshganda.

---

*Savolingiz bo'lsa yoki tartibni o'zgartirmoqchi bo'lsangiz — ayting.
Tasdiqlaganingizdan keyin boshlayman.*
