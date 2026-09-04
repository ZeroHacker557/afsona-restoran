import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readDeliveryType, isPickup, statusLabel } from '../shared/delivery.ts'
import { orderTotal } from '../shared/pricing.ts'

/**
 * Olib ketish.
 *
 * Eng muhim shart: eski buyurtmalarda `deliveryType` maydoni umuman
 * yo'q — ular yetkazish bo'lib qolishi va hech narsa o'zgarmasligi
 * kerak. Testlarning yarmi aynan shuni qo'riqlaydi.
 */

describe('readDeliveryType', () => {
  test('maydon yo‘q — yetkazish', () => {
    assert.equal(readDeliveryType(undefined), 'delivery')
    assert.equal(readDeliveryType(null), 'delivery')
  })

  test('pickup — olib ketish', () => {
    assert.equal(readDeliveryType('pickup'), 'pickup')
  })

  test('notanish qiymat — yetkazish', () => {
    assert.equal(readDeliveryType('PICKUP'), 'delivery')
    assert.equal(readDeliveryType('olib ketish'), 'delivery')
    assert.equal(readDeliveryType(1), 'delivery')
    assert.equal(readDeliveryType(true), 'delivery')
  })
})

describe('isPickup', () => {
  test('eski buyurtma — yetkazish', () => {
    assert.equal(isPickup({}), false)
    assert.equal(isPickup(null), false)
    assert.equal(isPickup(undefined), false)
  })

  test('olib ketish buyurtmasi', () => {
    assert.equal(isPickup({ deliveryType: 'pickup' }), true)
  })

  test('aniq yetkazish', () => {
    assert.equal(isPickup({ deliveryType: 'delivery' }), false)
  })
})

describe('statusLabel', () => {
  test('yetkazishda nom o‘zgarmaydi', () => {
    for (const status of ['Yangi', 'Qabul qilindi', 'Yetkazilmoqda', 'Yetkazildi']) {
      assert.equal(statusLabel(status, 'delivery'), status)
    }
  })

  test('olib ketishda tushunarli nom', () => {
    assert.equal(statusLabel('Qabul qilindi', 'pickup'), 'Tayyorlanmoqda')
    assert.equal(statusLabel('Yetkazilmoqda', 'pickup'), 'Tayyor')
    assert.equal(statusLabel('Yetkazildi', 'pickup'), 'Topshirildi')
  })

  test('«Yangi» ikkalasida ham bir xil', () => {
    assert.equal(statusLabel('Yangi', 'pickup'), 'Yangi')
  })

  test('bekor qilish nomlari o‘zgarmaydi', () => {
    assert.equal(statusLabel('Bekor qilingan', 'pickup'), 'Bekor qilingan')
    assert.equal(statusLabel('Rad etildi', 'pickup'), 'Rad etildi')
  })

  test('notanish status o‘zi holicha qaytadi', () => {
    assert.equal(statusLabel('Nimadir', 'pickup'), 'Nimadir')
  })
})

describe('olib ketishda summa', () => {
  test('yetkazish narxi qo‘shilmaydi', () => {
    // Server olib ketishda deliveryFee ni 0 qiladi
    const yetkazish = orderTotal({ subtotal: 60000, deliveryFee: 20000 })
    const olibKetish = orderTotal({ subtotal: 60000, deliveryFee: 0 })
    assert.equal(yetkazish, 80000)
    assert.equal(olibKetish, 60000)
  })

  test('idish narxi olib ketishda ham olinadi', () => {
    // Idish taom bilan beriladi — mijoz o'zi kelsa ham qadoq kerak
    assert.equal(orderTotal({ subtotal: 60000, containerFee: 6000, deliveryFee: 0 }), 66000)
  })

  test('chegirma ishlaydi, yetkazish esa yo‘q', () => {
    assert.equal(
      orderTotal({ subtotal: 100000, discount: 10000, containerFee: 3000, deliveryFee: 0 }),
      93000,
    )
  })
})
