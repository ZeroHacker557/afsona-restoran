import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { courierButtons, courierText, findCourier } from '../api/_lib/courier.ts'

/**
 * Kuryer tugmalari va matni.
 *
 * Bu — loyihaning eng nozik qoidalaridan biri:
 *
 *  1. Admin «Qabul qilindi» bosmaguncha «Oldim» tugmasi CHIQMAYDI.
 *  2. Buyurtmani olgan kuryergina «Yetkazildi» ni ko'radi.
 *  3. Mijozning ismi va telefoni buyurtma OLINGUNCHA yashirin —
 *     guruhda o'nlab odam bo'lishi mumkin.
 *
 * Bularning biri buzilsa, mijoz ma'lumoti sizib chiqadi yoki kuryer
 * tasdiqlanmagan buyurtmani olib ketadi.
 */

const buyurtma = (patch = {}) => ({
  id: 'ORD1',
  orderNumber: '#1042',
  status: 'Qabul qilindi',
  total: 85_000,
  paymentMethod: 'Naqd',
  products: [{ product: { name: 'Manti', price: 36_000 }, quantity: 2 }],
  customer: { name: 'Aziz', phone: '+998901112233', address: 'Navoiy 12' },
  ...patch,
})

const matnlar = (b: ReturnType<typeof courierButtons>) => b.map((x) => x.text)

describe('courierButtons — status bo‘yicha', () => {
  test('«Yangi» — hech qanday amal tugmasi yo‘q', () => {
    const b = courierButtons(buyurtma({ status: 'Yangi' }))
    assert.equal(
      b.some((x) => x.callback),
      false,
      'admin tasdiqlamaguncha kuryer buyurtmani ololmasligi kerak',
    )
  })

  test('«Qabul qilindi» — «Oldim» chiqadi', () => {
    const b = courierButtons(buyurtma())
    assert.ok(matnlar(b).some((t) => t.includes('Oldim')))
  })

  test('kuryer olgach — «Oldim» yo‘qoladi, «Yetkazildi» chiqadi', () => {
    const b = courierButtons(buyurtma({ status: 'Yetkazilmoqda', courierId: 555 }))
    const t = matnlar(b)
    assert.equal(t.some((x) => x.includes('Oldim')), false)
    assert.ok(t.some((x) => x.includes('Yetkazildi')))
  })

  test('«Yetkazildi» — amal tugmalari qolmaydi', () => {
    const b = courierButtons(buyurtma({ status: 'Yetkazildi', courierId: 555 }))
    assert.equal(b.some((x) => x.callback), false)
  })

  test('bekor qilingan — amal tugmalari qolmaydi', () => {
    for (const status of ['Bekor qilingan', 'Rad etildi']) {
      const b = courierButtons(buyurtma({ status, courierId: 555 }))
      assert.equal(b.some((x) => x.callback), false, status)
    }
  })

  test('lokatsiya bo‘lsa — xarita tugmasi qo‘shiladi', () => {
    const bilan = courierButtons(
      buyurtma({ customer: { name: 'A', phone: '+1', address: 'B', location: { lat: 41.3, lng: 69.2 } } }),
    )
    assert.ok(bilan.some((x) => x.url?.includes('maps.google.com')))

    const siz = courierButtons(buyurtma())
    assert.equal(siz.some((x) => x.url?.includes('maps.google.com')), false)
  })

  test('har bir amal tugmasi buyurtma id‘sini olib yuradi', () => {
    const b = courierButtons(buyurtma())
    for (const tugma of b.filter((x) => x.callback)) {
      assert.ok(tugma.callback?.endsWith(':ORD1'), tugma.callback)
    }
  })
})

describe('courierText — maxfiylik', () => {
  test('olinmagan buyurtmada telefon KO‘RINMAYDI', () => {
    const matn = courierText(buyurtma(), false)
    assert.equal(matn.includes('+998901112233'), false, 'telefon guruhga sizib chiqmasligi kerak')
    assert.equal(matn.includes('Aziz'), false)
    assert.ok(matn.includes('Navoiy 12'), 'manzil esa kerak — kuryer masofani baholaydi')
  })

  test('olingandan keyin telefon ko‘rinadi', () => {
    const matn = courierText(buyurtma({ status: 'Yetkazilmoqda', courierId: 555 }), true)
    assert.ok(matn.includes('+998901112233'))
    assert.ok(matn.includes('Aziz'))
  })

  test('«Yangi» holatda kutish haqida yozadi', () => {
    const matn = courierText(buyurtma({ status: 'Yangi' }), false)
    assert.ok(matn.includes('Admin tasdiqlashini kutmoqda'))
  })

  test('taomlar va summa ko‘rsatiladi', () => {
    const matn = courierText(buyurtma(), false)
    assert.ok(matn.includes('Manti'))
    assert.ok(matn.includes('× 2'))
    assert.ok(matn.includes('85 000'))
  })

  test('kuryer ismi biriktirilgach yoziladi', () => {
    const matn = courierText(buyurtma({ courierName: 'Bek', status: 'Yetkazilmoqda' }), true)
    assert.ok(matn.includes('Bek'))
  })
})

describe('findCourier', () => {
  const sozlama = {
    list: [
      { id: 111, name: 'Bek', active: true },
      { id: 222, name: 'Aziz', active: false },
      { id: 333, name: 'Jasur' },
    ],
    groupChatId: null,
    groupTitle: '',
    mode: 'both' as const,
  }

  test('faol kuryer topiladi', () => {
    assert.equal(findCourier(sozlama, 111)?.name, 'Bek')
  })

  test('`active` ko‘rsatilmagan — faol deb qaraladi', () => {
    assert.equal(findCourier(sozlama, 333)?.name, 'Jasur')
  })

  test('o‘chirilgan kuryer topilmaydi', () => {
    assert.equal(findCourier(sozlama, 222), null)
  })

  test('ro‘yxatda yo‘q odam — null', () => {
    assert.equal(findCourier(sozlama, 999), null)
  })
})
