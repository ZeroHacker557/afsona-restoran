import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { getOpenState, readHours, toMinutes, toClock, type WorkingHours } from '../shared/hours.ts'

/**
 * Ish vaqti — eng nozik mantiqlardan biri.
 *
 * U ikki joyda ishlatiladi: mijoz oynasida ("hozir yopiq" deb ko'rsatish)
 * va serverda (buyurtmani qabul qilishdan oldin qayta tekshirish). Xato
 * bo'lsa, restoran yopiq paytda buyurtma qabul qilinadi yoki ochiq paytda
 * mijoz "yopiq" degan yozuvni ko'radi.
 *
 * Vaqt mintaqasi: `tzOffset` — UTC dan daqiqada. O'zbekiston = +300.
 */

/** Berilgan soatlar bilan to'liq sozlama yasaydi. */
function hours(patch: Partial<WorkingHours> = {}, day: Partial<{ closed: boolean; open: string; close: string }> = {}): WorkingHours {
  return {
    enabled: true,
    temporarilyClosed: false,
    closedNote: '',
    tzOffset: 300,
    days: Array.from({ length: 7 }, () => ({ closed: false, open: '09:00', close: '23:00', ...day })),
    ...patch,
  }
}

/** Toshkent vaqtidagi soatni UTC `Date` ga aylantiradi. */
function tashkent(year: number, month: number, day: number, hh: number, mm = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hh, mm) - 300 * 60 * 1000)
}

describe('toMinutes / toClock', () => {
  test('to‘g‘ri qiymatlar', () => {
    assert.equal(toMinutes('09:00'), 540)
    assert.equal(toMinutes('00:00'), 0)
    assert.equal(toMinutes('23:59'), 1439)
    assert.equal(toClock(540), '09:00')
    assert.equal(toClock(0), '00:00')
  })

  test('noto‘g‘ri qiymat null qaytaradi', () => {
    assert.equal(toMinutes(''), null)
    assert.equal(toMinutes('salom'), null)
    assert.equal(toMinutes('25:00'), null)
    assert.equal(toMinutes('12:75'), null)
  })
})

describe('getOpenState', () => {
  test('tekshiruv o‘chirilgan bo‘lsa — doim ochiq', () => {
    const state = getOpenState(hours({ enabled: false }), tashkent(2026, 9, 1, 4))
    assert.equal(state.open, true)
  })

  test('vaqtincha yopiq — ish vaqtiga qaramay yopiq', () => {
    const state = getOpenState(hours({ temporarilyClosed: true }), tashkent(2026, 9, 1, 12))
    assert.equal(state.open, false)
    assert.equal(state.reason, 'temporarily')
  })

  test('ish vaqti ichida — ochiq', () => {
    const state = getOpenState(hours(), tashkent(2026, 9, 1, 12))
    assert.equal(state.open, true)
  })

  test('ochilishdan oldin — yopiq', () => {
    const state = getOpenState(hours(), tashkent(2026, 9, 1, 7))
    assert.equal(state.open, false)
    assert.equal(state.opensAt, '09:00')
  })

  test('yopilgandan keyin — yopiq', () => {
    const state = getOpenState(hours(), tashkent(2026, 9, 1, 23, 30))
    assert.equal(state.open, false)
  })

  test('aynan ochilish daqiqasida — ochiq', () => {
    const state = getOpenState(hours(), tashkent(2026, 9, 1, 9, 0))
    assert.equal(state.open, true)
  })

  test('dam olish kuni — yopiq', () => {
    // 2026-09-06 — yakshanba (JS getDay = 0)
    const config = hours()
    config.days[0] = { closed: true, open: '09:00', close: '23:00' }
    const state = getOpenState(config, tashkent(2026, 9, 6, 12))
    assert.equal(state.open, false)
    assert.equal(state.reason, 'day-off')
  })

  test('tungacha cho‘zilgan smena: 18:00 – 02:00, soat 01:00 da ochiq', () => {
    const config = hours({}, { open: '18:00', close: '02:00' })
    const state = getOpenState(config, tashkent(2026, 9, 2, 1))
    assert.equal(state.open, true, 'kechagi smena hali tugamagan')
  })

  test('tungacha cho‘zilgan smena: soat 03:00 da yopiq', () => {
    const config = hours({}, { open: '18:00', close: '02:00' })
    const state = getOpenState(config, tashkent(2026, 9, 2, 3))
    assert.equal(state.open, false)
  })

  test('vaqt mintaqasi hisobga olinadi', () => {
    // UTC 05:00 = Toshkentda 10:00 → ochiq
    assert.equal(getOpenState(hours(), new Date(Date.UTC(2026, 8, 1, 5))).open, true)
    // UTC 01:00 = Toshkentda 06:00 → hali yopiq
    assert.equal(getOpenState(hours(), new Date(Date.UTC(2026, 8, 1, 1))).open, false)
  })
})

describe('readHours', () => {
  test('bo‘sh ma‘lumotdan xavfsiz sozlama', () => {
    const parsed = readHours(undefined)
    assert.equal(parsed.days.length, 7)
    assert.equal(typeof parsed.enabled, 'boolean')
  })

  test('yetishmayotgan kunlar to‘ldiriladi', () => {
    const parsed = readHours({ enabled: true, days: [{ closed: false, open: '10:00', close: '20:00' }] })
    assert.equal(parsed.days.length, 7)
    assert.equal(parsed.days[0].open, '10:00')
  })

  test('axlat qiymatlar yiqitmaydi', () => {
    const parsed = readHours({ enabled: 'ha', tzOffset: 'salom', days: 'yo‘q' })
    assert.equal(parsed.days.length, 7)
    assert.equal(Number.isFinite(parsed.tzOffset), true)
  })
})
