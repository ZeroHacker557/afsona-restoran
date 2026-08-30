# Keyingi bosqich — g'oyalar ro'yxati

> Bu ishlarni **hozir emas**, buyurtmachi «**Qo'shimcha planlarni boshlaymiz**»
> deganda boshlaymiz. Hozirgi holat (mini app + `/admin` paneli) taqdimot
> uchun yetarli deb qaror qilindi.
>
> Tartib tavsiya bo'yicha: **modifikatorlar → ETA → kuryerlar → kassa hisoboti**.

---

## 🔥 Birinchi navbatda

### 1. Modifikatorlar va qo'shimchalar
Har taomga porsiya (kichik/o'rta/katta), qo'shimchalar (pishloq +8 000, achchiq
sous +3 000), tanlovlar («achchiq qilinsinmi?»). Narx savatda avtomatik
hisoblanadi.
**Nega:** hozir taom qat'iy bitta narxda — restoran menyusining yarmini
to'g'ri ko'rsatib bo'lmaydi.

### 2. Kuryerlar moduli
Kuryerlar ro'yxati, buyurtmani kuryerga biriktirish. Biriktirilganda kuryerga
Telegram'ga lokatsiya + mijoz ma'lumoti avtomatik ketadi. Kuryer o'zi
«Yetkazdim» tugmasini bosadi.
**Nega:** hozir buni qo'lda «Xaritani ulashish» orqali qilinadi.

### 3. Tayyorlanish vaqti (ETA)
«Qabul qilindi» bosilganda 15 / 30 / 45 daqiqa tanlanadi. Mijozga xabar
boradi, ilovada orqaga sanoq ko'rinadi.
**Nega:** «qachon keladi?» qo'ng'iroqlari keskin kamayadi.

### 4. Oshxona ekrani (KDS)
`/admin/kitchen` — planshet uchun alohida sahifa: faqat taomlar katta
shriftda, narxsiz. Oshpaz tayyor bo'lganini bosadi.

### 5. Kunlik kassa hisoboti
Kun oxirida naqd/karta ajratilgan hisobot, o'rtacha chek, bekor qilinganlar.
Bir tugma bilan Telegram'ga yuboriladi.

---

## 🍽 Menyu

6. **Ikki tilli taom nomlari** — ilova uz/ru, lekin taom nomlari bitta tilda.
7. **Kombo va setlar** — «Oilaviy set: 2 osh + 4 somsa + choy — 15% arzon».
8. **Vaqt bo'yicha menyu** — nonushta 08:00–11:00, biznes-lanch 12:00–15:00.
9. **«Bugungi taklif»** — bosh sahifada alohida banner, paneldan bir klik.
10. **Ombor bilan bog'lash** — qoldiq 0 ga tushganda avtomatik stop-listga
    (`stock` maydoni bor, avtomatika yo'q).

## 💚 Mijozni qaytarish

11. **Sodiqlik ballari** — har buyurtmadan 3% ball yoki «har 10-buyurtma bepul».
12. **Avtomatik kampaniyalar** — tug'ilgan kun promokodi; 30 kun kirmaganga
    «sog'indik» chegirmasi; savatni tashlab ketganga eslatma.
13. **Sharhlar bo'limi** — baho, javob yozish, past bahoda ogohlantirish.
14. **Referal** — «do'stingni taklif qil, ikkalangga 10 000 so'm».

## 📊 Boshqaruv

15. **Yetkazish zonalari** — xaritada poligon, har zonaga o'z narxi.
16. **Soatlik issiqlik xaritasi** — qaysi kun/soatda ko'p buyurtma.
17. **Xarajatlar va sof foyda** — mahsulot xaridi kiritiladi, sof foyda chiqadi.
18. **Buyurtmani tahrirlash** — paneldan taom qo'shish/olib tashlash.
19. **Xodimlar guruhi** — buyurtmalar Telegram guruhiga tushsin.
20. **Menyu zaxirasi** — butun menyuni JSON'ga saqlash/tiklash.

---

## Ilgari ataylab qoldirilganlar

Bular birinchi bosqichda kelishilgan holda **kiritilmadi** — kerak bo'lsa
qaytib ko'riladi:

- Rollar (egasi / menejer / operator / oshxona)
- Amallar jurnali (kim nima o'zgartirgani)
- Buyurtmalarni CSV/Excel eksport
- Stol bandlash (bron)

---

# Admin panel bo'yicha saqlangan g'oyalar

> 2026-08-30 da muhokama qilindi. Kartani sudrab ko'chirish, bekor qilish
> sababi, taomlarni sudrab tartiblash va PWA (ilova qilib o'rnatish)
> **bajarildi**. Quyidagilar keyinga qoldirildi — har biri alohida,
> mustaqil ish.

---

## A. Telefon orqali buyurtma (paneldan buyurtma yaratish)

**Nima qilinadi.** Buyurtmalar sahifasiga «Buyurtma qo'shish» tugmasi.
Ochilgan oynada: mijoz telefoni (mavjud mijoz bo'lsa avtomatik topiladi va
ismi/manzili to'ldiriladi), taomlar ro'yxatidan tanlash + miqdor, manzil,
to'lov usuli, izoh. Saqlangach buyurtma oddiy buyurtma kabi Kanban'ning
«Yangi» ustuniga tushadi, kuryerga ham boradi.

**Nega kerak.** Restoranga qo'ng'iroq qiladigan mijozlar baribir bo'ladi —
ayniqsa katta buyurtmalar (bayram, ofis) telefon orqali keladi. Hozir ular
tizimga umuman tushmaydi: kassa hisoboti ham, statistika ham, mijoz tarixi
ham noto'g'ri chiqadi. Restoran egasi «kunlik tushum» degan raqamga
ishonolmaydi.

**Texnik jihat.** Yangi buyurtma Firestore'ga admin nomidan yoziladi —
`orderNumber` ni ketma-ket berish uchun bot bilan bir xil hisoblagichdan
foydalanish kerak, aks holda raqamlar takrorlanadi. Buyurtmaga
`source: 'phone'` maydoni qo'yiladi. Mijoz `userId` siz ham bo'lishi
mumkin — bunda Telegram xabari ketmaydi, buni UI'da aytib qo'yish kerak.

**Taxminiy hajm:** ~5 soat. **Sotish narxi:** 1 mln so'm.

---

## B. Taom nusxasini olish (dublikat)

**Nima qilinadi.** Taom oynasida «Nusxa olish» tugmasi. Barcha maydonlar
(narx, kategoriya, tavsif, rasmlar, qoldiq) ko'chiriladi, nomga
« — nusxa» qo'shiladi va yangi taom sifatida tahrirlash oynasi ochiladi.

**Nega kerak.** «Manti» dan «Qovurma manti», «Katta lavash» dan «Kichik
lavash» yasashda hamma narsani qaytadan yozish va rasmni qaytadan yuklash
kerak. Menyuni birinchi marta to'ldirishda bu eng ko'p vaqt oladigan ish.

**Texnik jihat.** Oson: `createProduct` ga mavjud obyekt `id` siz
uzatiladi. Rasmlar Storage'da bir xil URL bilan qoladi — nusxa
o'chirilganda asl taomning rasmi ham o'chib ketmasligi uchun rasm
o'chirish mantiqini tekshirish kerak (`removeUploaded` URL bo'yicha
ishlaydi).

**Taxminiy hajm:** ~1 soat. **Sotish narxi:** alohida sotilmaydi.

---

## C. Aloqa uzilganini ko'rsatish

**Nima qilinadi.** Panel tepasida qizil chiziq: «Aloqa yo'q — ma'lumot
yangilanmayapti». Aloqa tiklanganda o'zi yo'qoladi.

**Nega kerak.** Eng xavfli holat: internet uzilsa Firestore listener jim
qotadi, panel esa eski ma'lumotni ko'rsatib turaveradi. Admin yangi
buyurtma kelmayapti deb o'ylaydi — aslida kelyapti, u ko'rmayapti.
Buyurtma yo'qoladi va aybdor dasturchi bo'ladi.

**Texnik jihat.** Ikki manba kerak: `navigator.onLine` +
`online`/`offline` hodisalari — bu faqat tarmoq kartasini biladi.
Ishonchliroq belgi: Firestore `onSnapshot` ning xato callback'i va
`snapshot.metadata.fromCache` bayrog'i. Ikkalasi birga ishlatiladi.
PWA oflayn sahifasi (`public/offline-admin.html`) allaqachon bor — u
sahifa umuman ochilmaganda ishlaydi, bu esa sahifa ochiq turganda kerak.

**Taxminiy hajm:** ~1 soat. **Sotish narxi:** alohida sotilmaydi.

---

## D. Taqqoslash grafigi (bu hafta / o'tgan hafta)

**Nima qilinadi.** Bosh sahifadagi 14 kunlik grafikka ikkinchi qator —
o'tgan haftaning shu kunlari xira rangda. Ustida «O'tgan haftaga nisbatan
+18%» degan yozuv.

**Nega kerak.** Hozirgi grafik faqat «qancha» ni ko'rsatadi. Restoran
egasini qiziqtiradigan savol boshqa: «o'syapmizmi yoki tushyapmizmi?».
Bitta raqam butun taqdimotning ma'nosini o'zgartiradi.

**Texnik jihat.** Ma'lumot allaqachon bor (`orders`), faqat ikkinchi oyna
bo'yicha guruhlash va `BarChart` ni ikki qatorli qilish kerak.

**Taxminiy hajm:** ~2 soat. **Sotish narxi:** 500 ming so'm.

---

## E. Sotilmayotgan taomlar ro'yxati

**Nima qilinadi.** Statistika sahifasida alohida blok: «30 kun ichida
0 marta buyurtma qilingan taomlar». Har birining yoniga «Stop-listga» va
«O'chirish» tugmasi.

**Nega kerak.** Menyu vaqt o'tgani sayin shishadi. Sotilmaydigan taom
mijozni chalg'itadi va oshxonada zaxira mahsulot band qiladi. Restoran
egasi buni o'zi hisoblab chiqolmaydi.

**Texnik jihat.** `orders` ni 30 kun bo'yicha yig'ib, sotilgan taom
nomlari to'plamini olish; `products` dan shu to'plamda yo'qlarini
ajratish. **Diqqat:** taomlar buyurtmada nom bo'yicha saqlanadi, id
bo'yicha emas — nomi o'zgargan taom «sotilmagan» bo'lib ko'rinadi. Buni
izohda aytish yoki id bo'yicha solishtirishga o'tish kerak.

**Taxminiy hajm:** ~1 soat. **Sotish narxi:** 500 ming so'm.

---

## F. Soatlik yuklama (issiqlik xaritasi)

**Nima qilinadi.** Hafta kunlari × soatlar jadvali, har katak buyurtma
soniga qarab bo'yalgan. Ostida: «Eng band vaqt — juma 19:00–21:00».

**Nega kerak.** Xodim va kuryerni qachon ko'proq chiqarishni shu hal
qiladi. Aksiyani qaysi soatga qo'yishni ham. Bu — restoran egasi pul
tejaydigan yagona hisobot.

**Texnik jihat.** `createdAt` dan hafta kuni va soatni olib, 7×24
jadvalga yig'ish. Yuqoridagi 16-band bilan bir xil ish.

**Taxminiy hajm:** ~2 soat. **Sotish narxi:** 1 mln so'm.

---

## G. Buyurtma tarixi (timeline)

**Nima qilinadi.** Buyurtma oynasida vaqt chizig'i: `15:08 yaratildi →
15:11 qabul qilindi (Aziz) → 15:40 kuryer oldi (Bek) → 16:02 yetkazildi`.
Bekor qilingan bo'lsa — sababi bilan.

**Nega kerak.** Nizo chiqqanda («men bosmadim», «kech qabul qilindi»)
faqat shu hal qiladi. Ikki-uch admin ishlaydigan joyda bu shart.

**Texnik jihat.** Buyurtma hujjatiga `events: [{at, status, by}]` massivi
qo'shiladi, `handleOrderStatus` da `arrayUnion` bilan yoziladi. Kim
bosgani `requireAdmin` qaytargan email'dan olinadi. Bu **to'liq audit
jurnali emas** — faqat bitta buyurtma bo'yicha, shuning uchun birinchi
bosqichda ataylab qoldirilgan «amallar jurnali» dan ancha yengil.

**Taxminiy hajm:** ~2 soat. **Sotish narxi:** 1 mln so'm.

---

## H. Qora ro'yxat (mijozni bloklash)

**Nima qilinadi.** Mijozlar sahifasida «Bloklash» tugmasi + sabab.
Bloklangan mijoz mini appda buyurtma bera olmaydi. Alohida
«Bloklanganlar» filtri.

**Nega kerak.** Buyurtma berib qabul qilib olmaydigan mijoz restoranga
to'g'ridan-to'g'ri zarar keltiradi — taom tayyorlandi, kuryer bordi. Har
bir yetkazib berish xizmatida bor.

**Texnik jihat.** `users/{id}.blocked = true`. Tekshiruv **serverda**
bo'lishi shart — mini appdagi tekshiruvni chetlab o'tish oson. Buyurtma
hozir Firestore'ga to'g'ridan-to'g'ri yoziladi, shuning uchun Firestore
rules'ga shart qo'shish yoki buyurtma yaratishni API orqali o'tkazish
kerak. **Bu ish ko'rinib turganidan kattaroq** — rejalashtirganda hisobga
olinsin.

**Taxminiy hajm:** ~2 soat (mini app tomoni bilan ~4 soat).
**Sotish narxi:** 500 ming so'm.

---

## I. Sozlamalarni o'zgartirishda tasdiqlash

**Nima qilinadi.** «Restoranni vaqtincha yopish», ish vaqtini va yetkazish
narxini o'zgartirishda «Rostdan ham?» oynasi.

**Nega kerak.** «Restoranni yopish» tugmasi tepada, bir bosishda ishlaydi.
Tasodifan bosilsa — restoran mijozlar uchun yopiladi va buni hech kim
darrov sezmaydi.

**Texnik jihat.** `ConfirmBar` komponenti bor, faqat ulash kerak.

**Taxminiy hajm:** ~1 soat. **Sotish narxi:** alohida sotilmaydi.

---

## Tavsiya etilgan tartib

1. **C** (aloqa uzilishi) va **I** (tasdiqlash) — ikkalasi ~2 soat,
   ikkalasi ham yo'qotishning oldini oladi. Birinchi qilinadi.
2. **A** (telefon orqali buyurtma) — mijozga sotiladigan eng kuchli g'oya.
3. **G** (buyurtma tarixi) — ikkinchi admin qo'shilishi bilan zarur bo'ladi.
4. **D + E + F** — «Statistika to'plami» deb birga sotiladi (~5 soat).
5. **H** (qora ro'yxat) — talab paydo bo'lganda.
6. **B** (nusxa olish) — istalgan boshqa ish bilan birga.
