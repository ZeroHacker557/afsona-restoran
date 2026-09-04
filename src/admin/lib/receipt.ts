import { BRAND } from '../../config/brand'
import { formatDateTime } from './format'
import type { AdminOrder } from './db'

/**
 * Buyurtma cheki — oshxona va kuryer uchun.
 *
 * 80 mm termal printerga moslangan (restoranlardagi eng keng tarqalgan
 * o'lcham), lekin oddiy A4 printerda ham to'g'ri chiqadi — shunchaki
 * sahifaning chap tepasida tor ustun bo'lib bosiladi.
 *
 * Nega monoshrift va faqat qora rang: termal printer ranglarni bosmaydi,
 * kulrang matn esa yomon chiqadi. Ajratish uchun faqat chiziq, bo'sh joy
 * va harf kattaligi ishlatiladi.
 */

/**
 * Chekda pul faqat raqam bilan yoziladi — "so'm" har qatorda
 * takrorlanmaydi. Valyuta bir marta, JAMI qatorida ko'rsatiladi.
 */
function num(amount: unknown): string {
  return Math.round(Number(amount) || 0)
    .toLocaleString('ru-RU')
    .replace(new RegExp(String.fromCharCode(160), 'g'), ' ')
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Nom va narx — ikki chekkaga tortilgan qator. */
function row(left: string, right: string, bold = false): string {
  return `<div class="row${bold ? ' b' : ''}"><span>${left}</span><span>${right}</span></div>`
}

function block(title: string, body: string): string {
  return `<div class="sep"></div><div class="label">${title}</div>${body}`
}

export function buildReceiptHtml(order: AdminOrder): string {
  const customer = order.customer || {}

  const items = order.products
    .map((item) => {
      const name = escapeHtml(item.product?.name || 'Taom')
      const qty = Number(item.quantity) || 1
      const price = Number(item.product?.price) || 0
      return `
        <div class="item">
          <div class="item-name">${name}</div>
          <div class="row">
            <span class="qty">${qty} × ${num(price)}</span>
            <span>${num(price * qty)}</span>
          </div>
        </div>`
    })
    .join('')

  const subtotal = Number(order.subtotal) || 0
  const discount = Number(order.discount) || 0
  const delivery = Number(order.deliveryFee) || 0
  const containers = Number(order.containerFee) || 0
  const pickup = order.deliveryType === 'pickup'

  const totals = [
    subtotal ? row('Mahsulotlar', num(subtotal)) : '',
    discount
      ? row(
          `Chegirma${order.promoCode ? ` (${escapeHtml(order.promoCode)})` : ''}`,
          `−${num(discount)}`,
        )
      : '',
    containers ? row('Idishlar', num(containers)) : '',
    delivery ? row('Yetkazish', num(delivery)) : '',
    pickup ? row('Olib ketish', 'mijoz o‘zi oladi') : '',
  ].join('')

  const payment = order.paymentMethod === 'Karta'
    ? `Karta — ${order.paymentStatus === 'Tolangan' ? "to'langan" : "to'lov kutilmoqda"}`
    : 'Naqd — kuryer oladi'

  const customerBlock = block(
    'Mijoz',
    [
      customer.name ? `<div class="line big">${escapeHtml(customer.name)}</div>` : '',
      customer.phone ? `<div class="line big">${escapeHtml(customer.phone)}</div>` : '',
      pickup
        ? '<div class="line">Olib ketish — mijoz o‘zi oladi</div>'
        : customer.address
          ? `<div class="line">${escapeHtml(customer.address)}</div>`
          : '',
    ].join(''),
  )

  const commentBlock = customer.comment
    ? `<div class="note"><div class="label">Izoh</div>${escapeHtml(customer.comment)}</div>`
    : ''

  const courierBlock = order.courierName
    ? block('Kuryer', `<div class="line big">${escapeHtml(order.courierName)}</div>`)
    : ''

  return `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<title>Chek ${escapeHtml(order.orderNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }

  * { box-sizing: border-box; }

  body {
    margin: 0 auto;
    padding: 6px 0 18px;
    width: 72mm;
    background: #fff;
    color: #000;
    font-family: "Cascadia Mono", "Consolas", "DejaVu Sans Mono", ui-monospace, monospace;
    font-size: 12px;
    line-height: 1.45;
    -webkit-font-smoothing: none;
  }

  header { text-align: center; }
  .brand {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .kind { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; margin-top: 2px; }

  .number {
    text-align: center;
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 1px;
    margin: 8px 0 2px;
  }
  .when { text-align: center; font-size: 11px; }

  .sep { border-top: 1px dashed #000; margin: 9px 0; }
  .sep.solid { border-top: 2px solid #000; margin: 8px 0; }

  .label {
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 3px;
  }

  .item { margin-bottom: 7px; }
  .item:last-child { margin-bottom: 0; }
  .item-name { font-weight: 700; word-break: break-word; }
  .qty { padding-left: 10px; }

  .row { display: flex; justify-content: space-between; gap: 10px; }
  .row.b { font-weight: 700; }

  .total { display: flex; justify-content: space-between; font-size: 17px; font-weight: 700; }

  .line { word-break: break-word; }
  .line.big { font-size: 14px; font-weight: 700; }

  .note {
    border: 2px solid #000;
    padding: 7px 9px;
    margin-top: 9px;
    font-weight: 700;
    word-break: break-word;
  }

  footer { text-align: center; margin-top: 14px; font-size: 11px; }
  .cut { text-align: center; margin-top: 10px; letter-spacing: 2px; }

  @media print {
    body { width: auto; padding: 0; }
  }
</style>
</head>
<body>

<header>
  <div class="brand">${escapeHtml(BRAND.name)} ${escapeHtml(BRAND.nameSuffix)}</div>
  <div class="kind">Buyurtma cheki</div>
</header>

<div class="number">${escapeHtml(order.orderNumber)}</div>
<div class="when">${escapeHtml(formatDateTime(order.createdAt))}</div>

<div class="sep"></div>
${items}

<div class="sep"></div>
${totals}
<div class="sep solid"></div>
<div class="total"><span>JAMI</span><span>${num(order.total)} so'm</span></div>
<div class="sep solid"></div>

<div class="row b"><span>To'lov</span><span>${escapeHtml(payment)}</span></div>

${customerBlock}
${commentBlock}
${courierBlock}

<footer>
  Rahmat! Yoqimli ishtaha<br>
  ${escapeHtml(BRAND.phone)}
</footer>

<div class="cut">· · · · · · · · · ·</div>

<script>
  window.onload = function () { window.print() }
</script>
</body>
</html>`
}
