import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { checkPromo, usedInLegacyArray, PROMO_MESSAGES } from '../api/_lib/promo.ts'

/**
 * Promokod qoidalari — pul bilan bog'liq, shuning uchun har shart alohida
 * tekshiriladi. Bu qoidalar ikki joyda ishlatiladi: `/api/promo`
 * (oldindan ko'rsatish) va `/api/orders` (haqiqiy hisob). Ikkalasi bir
 * xil javob berishi shart, aks holda mijoz bir narxni ko'rib, boshqasini
 * to'laydi.
 */

const asos = {
  code: 'TEST10',
  active: true,
  discountPercent: 10,
  usageCount: 2,
  maxUses: 5,
  minOrderTotal: 50_000,
}

const holat = (patch = {}) => ({
  subtotal: 100_000,
  alreadyUsed: false,
  isFirstOrder: true,
  ...patch,
})

describe('checkPromo', () => {
  test('shartlar bajarilsa — chegirma beriladi', () => {
    const r = checkPromo(asos, holat())
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.discountPercent, 10)
      assert.equal(r.code, 'TEST10')
    }
  })

  test('faol emas', () => {
    const r = checkPromo({ ...asos, active: false }, holat())
    assert.deepEqual(r, { ok: false, error: 'PROMO_INACTIVE' })
  })

  test('muddati tugagan', () => {
    const r = checkPromo({ ...asos, expiresAt: '2020-01-01T00:00:00.000Z' }, holat())
    assert.deepEqual(r, { ok: false, error: 'PROMO_EXPIRED' })
  })

  test('kelajakdagi muddat — o‘tadi', () => {
    const r = checkPromo({ ...asos, expiresAt: '2099-01-01T00:00:00.000Z' }, holat())
    assert.equal(r.ok, true)
  })

  test('foydalanish chegarasi tugagan', () => {
    const r = checkPromo({ ...asos, usageCount: 5 }, holat())
    assert.deepEqual(r, { ok: false, error: 'PROMO_USED_UP' })
  })

  test('maxUses = 0 — cheklovsiz deb qaraladi', () => {
    const r = checkPromo({ ...asos, maxUses: 0, usageCount: 9999 }, holat())
    assert.equal(r.ok, true)
  })

  test('shu mijoz allaqachon foydalangan', () => {
    const r = checkPromo(asos, holat({ alreadyUsed: true }))
    assert.deepEqual(r, { ok: false, error: 'PROMO_ALREADY_USED' })
  })

  test('summa minimaldan kam', () => {
    const r = checkPromo(asos, holat({ subtotal: 10_000 }))
    assert.deepEqual(r, { ok: false, error: 'PROMO_MIN_TOTAL' })
  })

  test('summa aynan minimalga teng — o‘tadi', () => {
    const r = checkPromo(asos, holat({ subtotal: 50_000 }))
    assert.equal(r.ok, true)
  })

  test('faqat birinchi buyurtma uchun — ikkinchisida rad', () => {
    const r = checkPromo({ ...asos, firstOrderOnly: true }, holat({ isFirstOrder: false }))
    assert.deepEqual(r, { ok: false, error: 'PROMO_FIRST_ONLY' })
  })

  test('faqat birinchi buyurtma uchun — birinchisida o‘tadi', () => {
    const r = checkPromo({ ...asos, firstOrderOnly: true }, holat({ isFirstOrder: true }))
    assert.equal(r.ok, true)
  })

  test('foiz 0–100 oralig‘iga qisqartiriladi', () => {
    const katta = checkPromo({ ...asos, discountPercent: 250 }, holat())
    assert.equal(katta.ok && katta.discountPercent, 100)

    const manfiy = checkPromo({ ...asos, discountPercent: -30 }, holat())
    assert.equal(manfiy.ok && manfiy.discountPercent, 0)

    const axlat = checkPromo({ ...asos, discountPercent: 'salom' }, holat())
    assert.equal(axlat.ok && axlat.discountPercent, 0)
  })

  test('har bir xato kodi uchun matn bor', () => {
    const kodlar = [
      'PROMO_NOT_FOUND', 'PROMO_INACTIVE', 'PROMO_EXPIRED', 'PROMO_USED_UP',
      'PROMO_ALREADY_USED', 'PROMO_MIN_TOTAL', 'PROMO_FIRST_ONLY',
    ]
    for (const kod of kodlar) {
      assert.ok(PROMO_MESSAGES[kod], `${kod} uchun matn yo'q`)
    }
  })
})

describe('usedInLegacyArray', () => {
  /*
     Eski promokodlarda foydalanuvchilar `usedBy` massivida saqlangan.
     Yangi yozuvlar ostki kolleksiyaga tushadi, lekin eskilarini ham
     tekshirish shart — aks holda o'sha mijozlar koddan ikkinchi marta
     foydalanardi.
  */
  test('massivda son sifatida', () => {
    assert.equal(usedInLegacyArray({ usedBy: [123, 456] }, 123, '123'), true)
  })

  test('massivda matn sifatida', () => {
    assert.equal(usedInLegacyArray({ usedBy: ['789'] }, 789, '789'), true)
  })

  test('massivda yo‘q', () => {
    assert.equal(usedInLegacyArray({ usedBy: [1, 2] }, 999, '999'), false)
  })

  test('massiv umuman yo‘q', () => {
    assert.equal(usedInLegacyArray({}, 1, '1'), false)
  })

  test('massiv o‘rniga axlat', () => {
    assert.equal(usedInLegacyArray({ usedBy: 'salom' }, 1, '1'), false)
  })
})
