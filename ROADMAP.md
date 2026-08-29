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
