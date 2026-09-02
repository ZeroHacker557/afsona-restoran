import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { orderQuantities, CANCELLED_STATUSES } from '../api/_lib/stock.ts'

/**
 * Ombor qoldig'i.
 *
 * Buyurtma yaratilganda qoldiq kamayadi, bekor qilinganda qaytariladi.
 * Bu yerda hisoblash qismi tekshiriladi — Firestore yozuvi emas.
 */

describe('orderQuantities', () => {
  test('oddiy buyurtma', () => {
    const totals = orderQuantities({
      products: [
        { product: { id: '100' }, quantity: 2 },
        { product: { id: '200' }, quantity: 1 },
      ],
    })
    assert.equal(totals.get('100'), 2)
    assert.equal(totals.get('200'), 1)
  })

  test('bir xil taom bir necha marta — qo‘shiladi', () => {
    const totals = orderQuantities({
      products: [
        { product: { id: '100' }, quantity: 2 },
        { product: { id: '100' }, quantity: 3 },
      ],
    })
    assert.equal(totals.size, 1)
    assert.equal(totals.get('100'), 5)
  })

  test('id raqam bo‘lsa ham matnga aylanadi', () => {
    const totals = orderQuantities({ products: [{ product: { id: 100 }, quantity: 1 }] })
    assert.equal(totals.get('100'), 1)
  })

  test('id yo‘q bandlar tashlab ketiladi', () => {
    const totals = orderQuantities({
      products: [
        { product: {}, quantity: 5 },
        { quantity: 5 },
        { product: { id: '' }, quantity: 5 },
        { product: { id: '300' }, quantity: 1 },
      ],
    })
    assert.equal(totals.size, 1)
    assert.equal(totals.get('300'), 1)
  })

  test('nol yoki manfiy miqdor hisobga olinmaydi', () => {
    const totals = orderQuantities({
      products: [
        { product: { id: '100' }, quantity: 0 },
        { product: { id: '200' }, quantity: -3 },
        { product: { id: '300' }, quantity: 2 },
      ],
    })
    assert.equal(totals.size, 1)
    assert.equal(totals.get('300'), 2)
  })

  test('bo‘sh yoki noto‘g‘ri buyurtma — bo‘sh natija', () => {
    assert.equal(orderQuantities({}).size, 0)
    assert.equal(orderQuantities({ products: [] }).size, 0)
    assert.equal(orderQuantities({ products: 'salom' as never }).size, 0)
  })
})

describe('bekor qilingan statuslar', () => {
  test('ikkalasi ham qamrab olingan', () => {
    assert.equal(CANCELLED_STATUSES.has('Bekor qilingan'), true)
    assert.equal(CANCELLED_STATUSES.has('Rad etildi'), true)
  })

  test('faol statuslar kirmaydi', () => {
    for (const status of ['Yangi', 'Qabul qilindi', 'Yetkazilmoqda', 'Yetkazildi']) {
      assert.equal(CANCELLED_STATUSES.has(status), false, status)
    }
  })
})

/**
 * `handleOrderStatus` dagi qaror mantiqi.
 *
 * Bu yerda qayta yozilgan — asl kod Firestore tranzaksiyasi ichida
 * bo'lgani uchun to'g'ridan-to'g'ri chaqirib bo'lmaydi. Shart o'zgarsa,
 * bu test ham yangilanishi kerak.
 */
function qaror(eskiStatus: string, yangiStatus: string, restoredBefore: boolean) {
  const cancelled = CANCELLED_STATUSES.has(yangiStatus)
  const wasCancelled = CANCELLED_STATUSES.has(eskiStatus)

  if (cancelled && !restoredBefore) return { amal: 'qaytarish', bayroq: true }
  if (!cancelled && wasCancelled && restoredBefore) return { amal: 'kamaytirish', bayroq: false }
  return { amal: 'tegilmaydi', bayroq: restoredBefore }
}

describe('qoldiq qaytarish qarori', () => {
  test('bekor qilinganda — qaytariladi', () => {
    assert.deepEqual(qaror('Qabul qilindi', 'Bekor qilingan', false), {
      amal: 'qaytarish', bayroq: true,
    })
  })

  test('ikki marta bekor qilinsa — ikkinchisida tegilmaydi', () => {
    assert.deepEqual(qaror('Bekor qilingan', 'Rad etildi', true), {
      amal: 'tegilmaydi', bayroq: true,
    })
  })

  test('bekor holatidan qaytarilsa — qayta kamaytiriladi', () => {
    assert.deepEqual(qaror('Bekor qilingan', 'Qabul qilindi', true), {
      amal: 'kamaytirish', bayroq: false,
    })
  })

  test('oddiy status o‘zgarishi — qoldiqqa tegilmaydi', () => {
    assert.deepEqual(qaror('Qabul qilindi', 'Yetkazildi', false), {
      amal: 'tegilmaydi', bayroq: false,
    })
  })

  test('yetkazilgandan keyin bekor — baribir qaytariladi', () => {
    assert.deepEqual(qaror('Yetkazildi', 'Bekor qilingan', false), {
      amal: 'qaytarish', bayroq: true,
    })
  })
})
