import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { searchProducts } from '../src/utils/search.ts'
import { money, shortMoney } from '../src/admin/lib/format.ts'
import type { Product } from '../src/types/domain.ts'

const taom = (id: number, name: string, category = 'Milliy taomlar', description = ''): Product => ({
  id, name, category, description, price: 40_000, rating: 5, reviews: 0, images: [],
})

const menyu = [
  taom(1, 'Manti'),
  taom(2, "To'y Oshi", 'Milliy taomlar', 'Bayramona palov'),
  taom(3, 'Lag‘mon'),
  taom(4, 'Choy', 'Ichimliklar'),
]

describe('searchProducts', () => {
  test('bo‘sh so‘rov — hammasi qaytadi', () => {
    assert.equal(searchProducts(menyu, '').length, 4)
    assert.equal(searchProducts(menyu, '   ').length, 4)
  })

  test('nom bo‘yicha topadi', () => {
    const natija = searchProducts(menyu, 'manti')
    assert.equal(natija.length, 1)
    assert.equal(natija[0].name, 'Manti')
  })

  test('katta-kichik harf farq qilmaydi', () => {
    assert.equal(searchProducts(menyu, 'MANTI').length, 1)
    assert.equal(searchProducts(menyu, 'MaNtI').length, 1)
  })

  test('kategoriya bo‘yicha ham topadi', () => {
    const natija = searchProducts(menyu, 'ichimlik')
    assert.ok(natija.some((p) => p.name === 'Choy'))
  })

  test('tavsif bo‘yicha topadi', () => {
    const natija = searchProducts(menyu, 'palov')
    assert.ok(natija.some((p) => p.name === "To'y Oshi"))
  })

  test('topilmasa — bo‘sh ro‘yxat', () => {
    assert.equal(searchProducts(menyu, 'pitsa').length, 0)
  })

  test('bir necha so‘z — hammasi mos kelishi kerak', () => {
    const natija = searchProducts(menyu, "to'y oshi")
    assert.ok(natija.some((p) => p.name === "To'y Oshi"))
  })

  test('nomdagi moslik kategoriyadagidan yuqori turadi', () => {
    const royxat = [
      taom(1, 'Sharbat', 'Ichimliklar'),
      taom(2, 'Choy', 'Sharbatlar'),
    ]
    const natija = searchProducts(royxat, 'sharbat')
    assert.equal(natija[0].name, 'Sharbat', 'nomi mos kelgani birinchi bo‘lishi kerak')
  })
})

describe('money', () => {
  test('minglar ajratiladi', () => {
    assert.equal(money(45_000), "45 000 so'm")
    assert.equal(money(1_250_000), "1 250 000 so'm")
  })

  test('nol va bo‘sh qiymatlar', () => {
    assert.equal(money(0), "0 so'm")
    assert.equal(money(null), "0 so'm")
    assert.equal(money(undefined), "0 so'm")
    assert.equal(money('salom'), "0 so'm")
  })

  test('kasr yaxlitlanadi', () => {
    assert.equal(money(45_000.4), "45 000 so'm")
    assert.equal(money(45_000.6), "45 001 so'm")
  })

  test('ajratkich oddiy probel — HTML da buzilmasin', () => {
    assert.equal(money(45_000).includes(' '), false)
  })
})

describe('shortMoney', () => {
  test('millionlar', () => {
    assert.equal(shortMoney(1_500_000), '1.5 mln')
    assert.equal(shortMoney(2_000_000), '2 mln')
  })

  test('minglar', () => {
    assert.equal(shortMoney(45_000), '45 ming')
  })

  test('kichik summalar to‘liq ko‘rsatiladi', () => {
    assert.equal(shortMoney(5_000), '5 000')
  })
})
