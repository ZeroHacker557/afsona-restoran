import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { containerTotal, orderTotal } from '../shared/pricing.ts'

/**
 * Narx formulasi.
 *
 * Bu hisob mijoz ekranida ham, serverda ham, chekda ham ishlaydi —
 * uchalasi bir xil javob berishi shart. Shuning uchun formula alohida
 * faylda va shu yerda tekshiriladi.
 */

describe('containerTotal', () => {
  test('idish narxi yo‘q — 0', () => {
    assert.equal(containerTotal([{ product: {}, quantity: 3 }]), 0)
  })

  test('null va 0 — idishsiz deb qaraladi', () => {
    assert.equal(containerTotal([{ product: { containerPrice: null }, quantity: 2 }]), 0)
    assert.equal(containerTotal([{ product: { containerPrice: 0 }, quantity: 2 }]), 0)
  })

  test('porsiyaga ko‘paytiriladi', () => {
    assert.equal(containerTotal([{ product: { containerPrice: 3000 }, quantity: 3 }]), 9000)
  })

  test('bir nechta taom qo‘shiladi', () => {
    const items = [
      { product: { containerPrice: 3000 }, quantity: 2 }, // 6000
      { product: { containerPrice: 1500 }, quantity: 1 }, // 1500
      { product: {}, quantity: 5 },                       // 0
    ]
    assert.equal(containerTotal(items), 7500)
  })

  test('bo‘sh savat — 0', () => {
    assert.equal(containerTotal([]), 0)
  })

  test('manfiy narx e’tiborga olinmaydi', () => {
    assert.equal(containerTotal([{ product: { containerPrice: -500 }, quantity: 2 }]), 0)
  })

  test('noto‘g‘ri miqdor e’tiborga olinmaydi', () => {
    assert.equal(containerTotal([{ product: { containerPrice: 3000 }, quantity: 0 }]), 0)
    assert.equal(containerTotal([{ product: { containerPrice: 3000 }, quantity: NaN }]), 0)
  })

  test('kasrli narx yaxlitlanadi', () => {
    assert.equal(containerTotal([{ product: { containerPrice: 2500.4 }, quantity: 2 }]), 5000)
  })
})

describe('orderTotal', () => {
  test('faqat taomlar', () => {
    assert.equal(orderTotal({ subtotal: 50000 }), 50000)
  })

  test('chegirma faqat taomga tushadi, idishga emas', () => {
    // 100 000 taom − 10 000 chegirma + 6 000 idish = 96 000
    const total = orderTotal({ subtotal: 100000, discount: 10000, containerFee: 6000 })
    assert.equal(total, 96000)
  })

  test('yetkazish ham chegirmadan keyin qo‘shiladi', () => {
    const total = orderTotal({
      subtotal: 100000,
      discount: 20000,
      containerFee: 5000,
      deliveryFee: 15000,
    })
    assert.equal(total, 100000)
  })

  test('chegirma summadan katta bo‘lsa — manfiyga tushmaydi', () => {
    const total = orderTotal({ subtotal: 10000, discount: 50000, containerFee: 3000 })
    assert.equal(total, 3000)
  })

  test('idishsiz buyurtma eski hisobdek qoladi', () => {
    const eski = orderTotal({ subtotal: 80000, discount: 8000, deliveryFee: 15000 })
    const yangi = orderTotal({ subtotal: 80000, discount: 8000, containerFee: 0, deliveryFee: 15000 })
    assert.equal(eski, yangi)
    assert.equal(eski, 87000)
  })

  test('yetishmayotgan qiymatlar 0 deb olinadi', () => {
    assert.equal(orderTotal({ subtotal: 50000, discount: undefined, containerFee: undefined }), 50000)
  })
})
