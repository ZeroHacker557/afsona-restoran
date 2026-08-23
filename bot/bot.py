"""
ShopOnline Telegram Bot — Admin panel + Mini App + To'lov tizimi
"""
import asyncio
import json
import logging

from aiogram import Bot, Dispatcher, F
from aiogram.types import (
    Message, WebAppInfo, InlineKeyboardButton,
    InlineKeyboardMarkup, ReplyKeyboardMarkup, KeyboardButton,
    MenuButtonWebApp, CallbackQuery
)
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.client.default import DefaultBotProperties

# Karta ma'lumoti config.py dan emas, settings/payment hujjatidan olinadi (F-07)
from config import BOT_TOKEN, ADMIN_IDS, MINI_APP_URL
from admin import router as admin_router
import firebase_db as db

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode="HTML"))
dp  = Dispatcher(storage=MemoryStorage())
dp.include_router(admin_router)


# ─── FSM ─────────────────────────────────────────────────────

class PaymentUpload(StatesGroup):
    waiting_photo = State()


# ─── Status emoji map ─────────────────────────────────────────

STATUS_EMOJI = {
    "Qabul qilindi":  "🟢",
    "Yetkazilmoqda":  "🚚",
    "Yetkazildi":     "🎉",
    "Rad etildi":     "🔴",
    "Bekor qilingan": "🔴",
}


# ─── Klaviaturalar ────────────────────────────────────────────

def main_kb(is_admin: bool = False):
    rows = [
        [KeyboardButton(text="🛍 Katalogni ochish", web_app=WebAppInfo(url=MINI_APP_URL))],
        [KeyboardButton(text="📦 Buyurtmalarim")],
        [KeyboardButton(text="📞 Biz bilan aloqa"), KeyboardButton(text="ℹ️ Yordam")]
    ]
    if is_admin:
        rows.append([KeyboardButton(text="🛠 Admin Panel")])
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)


def contact_kb() -> ReplyKeyboardMarkup:
    """Telefon raqamini bir bosishda olish uchun (F-26)."""
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📱 Raqamni yuborish", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def order_action_kb(order_id: str) -> InlineKeyboardMarkup:
    """Admin uchun 4ta status tugmasi"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Qabul",     callback_data=f"os:Qabul qilindi:{order_id}"),
            InlineKeyboardButton(text="🚚 Yetkazish", callback_data=f"os:Yetkazilmoqda:{order_id}")
        ],
        [
            InlineKeyboardButton(text="🎉 Bajarildi", callback_data=f"os:Yetkazildi:{order_id}"),
            InlineKeyboardButton(text="❌ Rad etish", callback_data=f"os:Rad etildi:{order_id}")
        ]
    ])


def receipt_kb(order_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💳 To'lov chekini yuborish", callback_data=f"receipt:{order_id}")]
    ])


def resend_receipt_kb(order_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💳 Qayta chek yuborish", callback_data=f"receipt:{order_id}")]
    ])


def payment_confirm_kb(order_id: str, user_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Tasdiqlash", callback_data=f"pconf:ok:{order_id}:{user_id}"),
            InlineKeyboardButton(text="❌ Rad etish",  callback_data=f"pconf:no:{order_id}:{user_id}")
        ]
    ])


def mini_app_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🛍 Buyurtmalarimni ko'rish", web_app=WebAppInfo(url=MINI_APP_URL))]
    ])


# ─── Yordamchi funksiyalar ────────────────────────────────────

def get_display_name(order_data: dict) -> str:
    raw = order_data.get("username", "")
    if raw and " " not in raw.strip():
        return f"@{raw}"
    return raw or order_data.get("customer", {}).get("name", "—")


def get_products_text(products: list) -> str:
    lines = ""
    for i, p in enumerate(products, 1):
        qty      = p.get("quantity", 1)
        size     = p.get("size")
        color    = p.get("color")
        prod     = p.get("product") or p
        name     = prod.get("name", "—")
        price    = prod.get("price", 0)
        item_sum = db.format_price(price * qty)
        
        variant_info = []
        if size: variant_info.append(f"O'lcham: {size}")
        if color: variant_info.append(f"Rang: {color}")
        var_text = f" ({', '.join(variant_info)})" if variant_info else ""
        
        lines += f"  <b>{i}. {name}</b>{var_text}\n"
        lines += f"     └ {qty} ta × {db.format_price(price)} = <b>{item_sum}</b>\n"
    return lines


# ─── Yangi buyurtma: Admin + User bildirishnomasi ─────────────

async def notify_admin_order(order_data: dict):
    try:
        customer   = order_data.get("customer", {})
        products   = order_data.get("products", [])
        total      = order_data.get("total", 0)
        # Tugmalar uchun — Firestore hujjat id'si; matn uchun — ko'rsatish raqami (F-03)
        doc_id     = order_data.get("_doc_id") or order_data.get("id", "")
        order_id   = db.order_display_id(order_data)
        pay_method = order_data.get("paymentMethod", "Naqd")
        user_id    = order_data.get("userId")
        total_str  = db.format_price(total) if isinstance(total, (int, float)) else str(total)
        tg_name    = get_display_name(order_data)
        pay_label  = "💵 Naqd (yetkazganda)" if pay_method == "Naqd" else "💳 Karta o'tkazmasi"

        # ── ADMIN XABARI ──────────────────────────────────────
        text  = f"🛒 <b>YANGI BUYURTMA ({order_id})</b>\n"
        text += "━" * 22 + "\n\n"
        text += f"📱 <b>Telegram:</b> {tg_name}\n"
        text += f"👤 <b>Ism:</b> {customer.get('name', '—')}\n"
        text += f"📞 <b>Tel:</b> <code>{customer.get('phone', '—')}</code>\n"
        text += f"📍 <b>Manzil:</b> {customer.get('address', '—')}\n"

        if customer.get("location"):
            lat = customer["location"].get("lat")
            lng = customer["location"].get("lng")
            if lat and lng:
                text += f"🗺 <a href='https://www.google.com/maps?q={lat},{lng}'>Xaritada ko'rish</a>\n"

        if customer.get("comment"):
            text += f"💬 <b>Izoh:</b> {customer['comment']}\n"

        text += f"\n💳 <b>To'lov:</b> {pay_label}\n"
        text += f"\n📦 <b>Mahsulotlar:</b>\n{get_products_text(products)}"
        text += "━" * 22 + "\n"

        subtotal = order_data.get("subtotal")
        discount = order_data.get("discount") or 0
        delivery_fee = order_data.get("deliveryFee") or 0
        if isinstance(subtotal, (int, float)) and (discount or delivery_fee):
            text += f"🧾 Mahsulotlar: {db.format_price(subtotal)}\n"
            if discount:
                promo = order_data.get("promoCode")
                promo_text = f" ({promo})" if promo else ""
                text += f"🏷 Chegirma{promo_text}: -{db.format_price(discount)}\n"
            if delivery_fee:
                text += f"🚚 Yetkazib berish: {db.format_price(delivery_fee)}\n"
            else:
                text += "🚚 Yetkazib berish: bepul\n"

        text += f"💰 <b>Jami: {total_str}</b>\n"
        text += "⏰ <b>Status:</b> 🟡 Yangi"
        if pay_method == "Karta":
            text += "\n💳 <b>To'lov:</b> ⏳ Chek kutilmoqda"

        for admin_id in ADMIN_IDS:
            try:
                await bot.send_message(admin_id, text,
                                       reply_markup=order_action_kb(doc_id),
                                       disable_web_page_preview=True)
            except Exception as e:
                logger.warning(f"[ADMIN] {admin_id} ga yuborib bo'lmadi: {e}")
        logger.info(f"[ADMIN] Yuborildi: {order_id} | {pay_method}")

        # ── USER XABARI (faqat Karta) ─────────────────────────
        if pay_method == "Karta":
            if not user_id:
                logger.warning(f"[USER] userId yo'q — xabar yuborib bo'lmaydi ({order_id})")
                return
            u_text  = "🎉 <b>Buyurtmangiz qabul qilindi!</b>\n"
            u_text += "━" * 22 + "\n\n"
            u_text += f"🆔 Buyurtma: <b>{order_id}</b>\n"
            u_text += "📦 <b>Mahsulotlar:</b>\n"
            for p in products:
                qty  = p.get("quantity", 1)
                prod = p.get("product") or p
                u_text += f"  • {prod.get('name', '—')} × {qty}\n"
            u_text += f"\n💰 Jami: <b>{total_str}</b>\n"
            u_text += "━" * 22 + "\n\n"
            pay_cfg = db.get_payment_settings()
            u_text += "💳 <b>To'lov uchun karta:</b>\n"
            u_text += f"<code>{pay_cfg['cardNumber']}</code>\n"
            u_text += f"👤 Egasi: <b>{pay_cfg['cardOwner']}</b>\n\n"
            u_text += (
                "📸 Kartaga o'tkazma qilgandan so'ng "
                "pastdagi tugmani bosib <b>chekni (screenshot)</b> yuboring.\n"
                "Admin tekshirib tasdiqlaydi ✅"
            )
            try:
                await bot.send_message(user_id, u_text, reply_markup=receipt_kb(doc_id))
                logger.info(f"[USER] Karta xabari yuborildi → {user_id} ({order_id})")
            except Exception as e:
                logger.error(f"[USER] Xabar yuborib bo'lmadi {user_id}: {e}")

    except Exception as e:
        logger.error(f"[ADMIN] notify_admin_order xatosi: {e}", exc_info=True)
        # Bayroqni qaytaramiz — buyurtma keyingi urinishda qayta yuboriladi (F-21)
        failed_doc_id = order_data.get("_doc_id")
        if failed_doc_id:
            db.release_order_notification(failed_doc_id)


# ─── Status o'zgartirish → Usergа xabar ──────────────────────

@dp.callback_query(F.data.startswith("os:"))
async def cb_order_status(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        return

    # order_id — Firestore hujjat id'si (F-03)
    _, status, order_id = callback.data.split(":", 2)

    if not db.update_order_status(order_id, status):
        await callback.answer("❌ Firestore yangilanmadi", show_alert=True)
        return

    emoji = STATUS_EMOJI.get(status, "ℹ️")

    # User'ga xabar
    order = db.get_order_by_id(order_id)
    display_id = db.order_display_id(order) if order else order_id
    if order and order.get("userId"):
        try:
            u_text  = "📦 <b>Buyurtmangiz yangilandi!</b>\n"
            u_text += "━" * 22 + "\n\n"
            u_text += f"🆔 Buyurtma: <b>{display_id}</b>\n"
            u_text += f"⏰ Yangi status: {emoji} <b>{status}</b>\n\n"
            u_text += "Batafsil ko'rish uchun 👇"
            await bot.send_message(order["userId"], u_text, reply_markup=mini_app_kb())
        except Exception as e:
            logger.warning(f"[USER] Status xabar xatosi: {e}")

    # Admin xabarini yangilash
    old = callback.message.html_text
    if "⏰ <b>Status:</b>" in old:
        new = old.split("⏰ <b>Status:</b>")[0] + f"⏰ <b>Status:</b> {emoji} {status}"
    else:
        new = old + f"\n⏰ <b>Status:</b> {emoji} {status}"

    try:
        await callback.message.edit_text(new, reply_markup=callback.message.reply_markup,
                                         disable_web_page_preview=True)
    except Exception:
        pass
    await callback.answer(f"✅ {status}")


# ─── Chek yuborish ────────────────────────────────────────────

@dp.callback_query(F.data.startswith("receipt:"))
async def cb_start_receipt(callback: CallbackQuery, state: FSMContext):
    order_id = callback.data.split("receipt:", 1)[-1]
    await state.update_data(receipt_order_id=order_id)
    await state.set_state(PaymentUpload.waiting_photo)
    await callback.message.answer(
        "📸 <b>To'lov chekini yuboring</b>\n\n"
        "Pul o'tkazilganini tasdiqlovchi <b>screenshot yoki rasmni</b> yuboring:"
    )
    await callback.answer()


@dp.message(PaymentUpload.waiting_photo, F.photo)
async def handle_receipt_photo(message: Message, state: FSMContext):
    data     = await state.get_data()
    order_id = data.get("receipt_order_id", "—")
    user_id  = message.from_user.id

    order   = db.get_order_by_id(order_id) if order_id != "—" else None
    display_id = db.order_display_id(order) if order else order_id
    caption = "💳 <b>TO'LOV CHEKI!</b>\n" + "━" * 22 + "\n\n"
    caption += f"📦 Buyurtma: <b>{display_id}</b>\n"
    if order:
        caption += f"📱 Mijoz: {get_display_name(order)}\n"
        caption += f"📞 Tel: <code>{order.get('customer', {}).get('phone', '—')}</code>\n"
        tot = order.get("total", 0)
        caption += f"💰 Summa: <b>{db.format_price(tot) if isinstance(tot,(int,float)) else tot}</b>\n"
    caption += "━" * 22

    try:
        for admin_id in ADMIN_IDS:
            try:
                await bot.send_photo(admin_id,
                                     photo=message.photo[-1].file_id,
                                     caption=caption,
                                     reply_markup=payment_confirm_kb(order_id, user_id))
            except Exception as e:
                logger.warning(f"[RECEIPT] Admin {admin_id} ga yuborib bo'lmadi: {e}")
        logger.info(f"[RECEIPT] Adminga yo'naltirildi: {order_id} ← {user_id}")
    except Exception as e:
        logger.error(f"[RECEIPT] Adminga yuborib bo'lmadi: {e}")

    await state.clear()
    await message.answer(
        "✅ <b>Chekingiz yuborildi!</b>\n\n"
        "Admin tekshirib, tez orada xabar beramiz 📬"
    )


@dp.message(PaymentUpload.waiting_photo)
async def handle_receipt_wrong(message: Message):
    await message.answer("❌ Iltimos, to'lov chekini <b>rasm (foto)</b> sifatida yuboring.")


# ─── Admin: To'lovni tasdiqlash / rad etish ──────────────────

@dp.callback_query(F.data.startswith("pconf:"))
async def cb_payment_confirm(callback: CallbackQuery):
    if callback.from_user.id not in ADMIN_IDS:
        return

    parts    = callback.data.split(":")
    action   = parts[1]        # ok | no
    order_id = parts[2]        # Firestore hujjat id'si
    user_id  = int(parts[3])

    order      = db.get_order_by_id(order_id)
    display_id = db.order_display_id(order) if order else order_id

    if action == "ok":
        db.update_payment_status(order_id, "Tolangan")
        logger.info(f"[PAY] Tasdiqlandi: {order_id}")

        # Usergа xabar
        try:
            u_text  = "✅ <b>To'lovingiz tasdiqlandi!</b>\n"
            u_text += "━" * 22 + "\n\n"
            u_text += f"📦 Buyurtma: <b>{display_id}</b>\n"
            u_text += "💰 To'lov qabul qilindi! Tez orada yetkaziladi 🚀"
            await bot.send_message(user_id, u_text, reply_markup=mini_app_kb())
        except Exception as e:
            logger.warning(f"[PAY] User xabari: {e}")

        # Chek xabarini yangilash
        try:
            await callback.message.edit_caption(
                (callback.message.caption or "") + "\n\n✅ <b>TASDIQLANDI</b>"
            )
        except Exception:
            pass

        # Barcha adminlarga status tugmalarini yuborish
        for admin_id in ADMIN_IDS:
            try:
                await bot.send_message(
                    admin_id,
                    f"📦 <b>{display_id}</b> — to'lov tasdiqlandi ✅\nBuyurtma statusini o'zgartiring:",
                    reply_markup=order_action_kb(order_id)
                )
            except Exception:
                pass
        await callback.answer("✅ Tasdiqlandi!", show_alert=True)

    elif action == "no":
        db.update_payment_status(order_id, "Rad etildi")
        logger.info(f"[PAY] Rad etildi: {order_id}")

        # Usergа xabar
        try:
            u_text  = "❌ <b>To'lov cheki rad etildi</b>\n"
            u_text += "━" * 22 + "\n\n"
            u_text += f"📦 Buyurtma: <b>{display_id}</b>\n"
            u_text += "Iltimos, to'g'ri chekni qayta yuboring."
            await bot.send_message(user_id, u_text, reply_markup=resend_receipt_kb(order_id))
        except Exception as e:
            logger.warning(f"[PAY] User xabari: {e}")

        # Chek xabarini yangilash
        try:
            await callback.message.edit_caption(
                (callback.message.caption or "") + "\n\n❌ <b>RAD ETILDI</b>"
            )
        except Exception:
            pass

        # Barcha adminlarga status tugmalarini yuborish
        for admin_id in ADMIN_IDS:
            try:
                await bot.send_message(
                    admin_id,
                    f"📦 <b>{display_id}</b> — chek rad etildi ❌ (mijoz qayta yuboradi)\nBuyurtma statusini o'zgartiring:",
                    reply_markup=order_action_kb(order_id)
                )
            except Exception:
                pass
        await callback.answer("❌ Rad etildi!", show_alert=True)


# ─── Buyurtmalarim ───────────────────────────────────────────

@dp.message(F.text == "📦 Buyurtmalarim")
async def handle_my_orders(message: Message):
    user_id = message.from_user.id
    orders  = db.get_user_orders(user_id)

    if not orders:
        await message.answer(
            "📦 <b>Sizda hozircha buyurtmalar mavjud emas.</b>\n\n"
            "Katalogimiz bilan tanishib, o'zingizga yoqqan mahsulotlarni xarid qilishingiz mumkin! 🛍"
        )
        return

    text = f"📦 <b>Buyurtmalarim</b> ({len(orders)} ta)\n" + "━" * 22 + "\n\n"
    btns = []

    for o in orders[:10]:
        # oid — ko'rsatish uchun, doc_id — tugmalar uchun (F-03)
        oid    = db.order_display_id(o)
        doc_id = o.get("_doc_id", "")
        tot  = o.get("total", 0)
        st   = o.get("status", "Yangi")
        pm   = o.get("paymentMethod", "Naqd")
        ps   = o.get("paymentStatus", "")
        e    = STATUS_EMOJI.get(st, "🟡")
        tstr = db.format_price(tot) if isinstance(tot, (int, float)) else str(tot)

        date_str = db.order_date_text(o)
        
        text += f"🧾 <b>Buyurtma:</b> {oid}\n"
        if date_str != "—": text += f"📅 <b>Sana:</b> {date_str}\n"
        text += f"📊 <b>Holat:</b> {e} {st}\n"
        
        if pm == "Karta":
            if ps == "Tolangan":
                text += "💳 <b>To'lov turi:</b> Karta (✅ Tasdiqlangan)\n"
            elif ps == "Rad etildi":
                text += "💳 <b>To'lov turi:</b> Karta (❌ Rad etilgan)\n"
                btns.append([InlineKeyboardButton(
                    text=f"💳 {oid} — qayta chek",
                    callback_data=f"receipt:{doc_id}"
                )])
            else:
                text += "💳 <b>To'lov turi:</b> Karta (⏳ Chek kutilmoqda)\n"
                btns.append([InlineKeyboardButton(
                    text=f"💳 {oid} — chek yuborish",
                    callback_data=f"receipt:{doc_id}"
                )])
        else:
            text += "💳 <b>To'lov turi:</b> 💵 Naqd (yetkazganda)\n"

        text += "\n🛍 <b>Mahsulotlar:</b>\n"
        
        products = o.get("products", [])
        for idx, p in enumerate(products, 1):
            qty   = p.get("quantity", 1)
            size  = p.get("size")
            color = p.get("color")
            prod  = p.get("product") or p
            name  = prod.get("name", "—")
            
            variant = []
            if size: variant.append(f"O'lcham: {size}")
            if color: variant.append(f"Rang: {color}")
            v_text = f" ({', '.join(variant)})" if variant else ""
            
            text += f"  {idx}. {name}{v_text} — <b>{qty} ta</b>\n"
            
        text += f"\n💰 <b>Jami summa:</b> {tstr}\n"
        text += "━━━━━━━━━━━━━━━━━━━━━━\n\n"

    kb = InlineKeyboardMarkup(inline_keyboard=btns) if btns else None
    await message.answer(text, reply_markup=kb)


# ─── /start ──────────────────────────────────────────────────

@dp.message(F.text.startswith("/start"))
async def cmd_start(message: Message, state: FSMContext):
    user     = message.from_user
    is_admin = user.id in ADMIN_IDS

    # ── Deep link: /start receipt_<hujjat_id> ──
    # Yangi havolalar Firestore hujjat id'sini yuboradi. Eski havolalarda
    # "#" siz raqam kelardi — u ham ishlashda davom etadi (F-03).
    parts = message.text.split(" ", 1)
    if len(parts) > 1 and parts[1].startswith("receipt_"):
        raw_id = parts[1].replace("receipt_", "").strip()

        order = db.get_order_by_id(raw_id) or db.get_order_by_id(f"#{raw_id}")
        if order:
            order_id   = order.get("_doc_id", raw_id)
            display_id = db.order_display_id(order)
            products  = order.get("products", [])
            total     = order.get("total", 0)
            total_str = db.format_price(total) if isinstance(total, (int, float)) else str(total)

            await state.update_data(receipt_order_id=order_id)
            await state.set_state(PaymentUpload.waiting_photo)

            u_text  = "💳 <b>To'lov ma'lumotlari</b>\n"
            u_text += "━" * 22 + "\n\n"
            u_text += f"🆔 Buyurtma ID: <b>{display_id}</b>\n"
            u_text += "📦 <b>Mahsulotlar:</b>\n"
            for p in products:
                qty   = p.get("quantity", 1)
                size  = p.get("size")
                color = p.get("color")
                prod  = p.get("product") or p
                name  = prod.get("name", "—")
                
                variant_info = []
                if size: variant_info.append(f"O'lcham: {size}")
                if color: variant_info.append(f"Rang: {color}")
                var_text = f" ({', '.join(variant_info)})" if variant_info else ""
                
                u_text += f"  • {name}{var_text} × {qty}\n"
            u_text += f"\n💰 Jami: <b>{total_str}</b>\n"
            u_text += "━" * 22 + "\n\n"
            pay_cfg = db.get_payment_settings()
            u_text += "💳 <b>Karta raqami:</b>\n"
            u_text += f"<code>{pay_cfg['cardNumber']}</code>\n"
            u_text += f"👤 Egasi: <b>{pay_cfg['cardOwner']}</b>\n\n"
            u_text += "📸 Pul o'tkazgandan so'ng <b>to'lov chekini (screenshot)</b> yuboring:"
            await message.answer(u_text, reply_markup=main_kb(is_admin))
        else:
            await message.answer(
                "❌ Buyurtma topilmadi.\n"
                "Iltimos, mini appdagi «To'lov chekini yuborish» tugmasini qayta bosing.",
                reply_markup=main_kb(is_admin)
            )
        return

    # ── Oddiy /start ──
    text = (
        f"Assalomu alaykum, <b>{user.first_name}</b>! 👋\n\n"
        "✨ <b>Online do'konimizga xush kelibsiz!</b>\n\n"
        "🛍 <b>Katalog orqali o'zingizga yoqqan mahsulotlarni tanlang va oson buyurtma bering.</b>\n\n"
        "👇 <i>Xaridni boshlash uchun quyidagi tugmani bosing:</i>"
    )
    await message.answer(text, reply_markup=main_kb(is_admin))

    # Telefon raqami hali saqlanmagan bo'lsa, bir bosishda so'raymiz.
    # Mini app buni buyurtma formasiga avtomatik qo'yadi (F-26).
    saved = db.get_user(user.id) or {}
    if not saved.get("phone"):
        await message.answer(
            "📱 <b>Telefon raqamingizni qoldiring</b>\n\n"
            "Buyurtma berganingizda uni qayta yozib o'tirmaysiz, "
            "kuryer esa siz bilan tez bog'lana oladi.\n\n"
            "<i>Ixtiyoriy — keyinroq ilovaning «Shaxsiy ma'lumotlar» "
            "bo'limidan ham kiritish mumkin.</i>",
            reply_markup=contact_kb(),
        )


@dp.message(F.contact)
async def handle_contact(message: Message):
    """Foydalanuvchi «Raqamni yuborish» tugmasini bosganda (F-26)."""
    contact = message.contact

    # Faqat o'z raqamini qabul qilamiz — boshqa odamning kontaktini emas
    if contact.user_id != message.from_user.id:
        await message.answer(
            "❌ Iltimos, <b>o'zingizning</b> raqamingizni yuboring.",
            reply_markup=contact_kb(),
        )
        return

    is_admin = message.from_user.id in ADMIN_IDS
    phone = contact.phone_number
    if not phone.startswith("+"):
        phone = f"+{phone}"

    if db.set_user_phone(message.from_user.id, phone):
        await message.answer(
            f"✅ Raqamingiz saqlandi: <code>{phone}</code>\n\n"
            "Endi buyurtma berishda u avtomatik to'ldiriladi.",
            reply_markup=main_kb(is_admin),
        )
    else:
        await message.answer(
            "❌ Raqamni saqlab bo'lmadi. Keyinroq qayta urinib ko'ring.",
            reply_markup=main_kb(is_admin),
        )


@dp.message(F.text == "🛠 Admin Panel")
async def handle_admin_btn(message: Message, state: FSMContext):
    from admin import cmd_admin
    await cmd_admin(message, state)


@dp.message(F.text == "📞 Biz bilan aloqa")
async def cmd_contact(message: Message):
    await message.answer(
        "📞 <b>Biz bilan bog'lanish:</b>\n\n"
        "👨‍💻 <b>Mijozlarni qo'llab-quvvatlash:</b> @admin\n"
        "📞 <b>Telefon raqam:</b> +998 90 123 45 67\n"
        "📍 <b>Manzil:</b> Toshkent shahri\n"
        "⏰ <b>Ish vaqti:</b> 09:00 dan 20:00 gacha\n\n"
        "<i>Savollaringiz bo'lsa, bemalol murojaat qiling! Biz har doim yordam berishga tayyormiz.</i>"
    )


@dp.message(F.text.in_({"ℹ️ Yordam", "/help"}))
async def cmd_help(message: Message):
    await message.answer(
        "ℹ️ <b>Botdan qanday foydalanish mumkin?</b>\n\n"
        "1️⃣ <b>Katalogni ochish</b> tugmasini bosib, mahsulotlar bilan tanishing.\n"
        "2️⃣ O'zingizga yoqqan mahsulotlarni <b>Savatga</b> qo'shing.\n"
        "3️⃣ Buyurtmani rasmiylashtirishda <b>Naqd</b> yoki <b>Karta</b> orqali to'lov usulini tanlang.\n"
        "4️⃣ Agar karta orqali to'lov qilsangiz, to'lov chekini botga yuboring.\n"
        "5️⃣ Buyurtmangiz holatini <b>Buyurtmalarim</b> bo'limidan kuzatib boring.\n\n"
        "<i>Qo'shimcha savollar uchun <b>'📞 Biz bilan aloqa'</b> bo'limiga murojaat qiling.</i>"
    )


# ─── WebApp sendData (fallback) ───────────────────────────────

@dp.message(F.web_app_data)
async def handle_webapp_data(message: Message):
    try:
        data       = json.loads(message.web_app_data.data)
        pay_method = data.get("paymentMethod", "Naqd")
        order_id   = data.get("id", "")
        await notify_admin_order(data)
        if pay_method == "Naqd":
            await message.answer(
                f"🎉 <b>Buyurtmangiz qabul qilindi!</b>\n"
                f"🆔 Buyurtma: <b>{order_id}</b>\n"
                "💵 To'lov: Naqd (yetkazganda)\n\n"
                "Operatorimiz tez orada bog'lanadi 📞"
            )
    except Exception as e:
        logger.error(f"WebApp data: {e}")
        await message.answer("❌ Xatolik. Qayta urinib ko'ring.")


# ─── Main ─────────────────────────────────────────────────────

async def main():
    # Sozlama hujjatlari hali yo'q bo'lsa, boshlang'ich qiymatlar bilan yaratamiz
    db.ensure_payment_settings()
    db.ensure_delivery_settings()

    try:
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(text="🛍 Katalog", web_app=WebAppInfo(url=MINI_APP_URL))
        )
    except Exception as e:
        logger.warning(f"Menu button: {e}")

    loop = asyncio.get_running_loop()

    def on_new_order(order_data):
        asyncio.run_coroutine_threadsafe(notify_admin_order(order_data), loop)

    watch = db.listen_to_new_orders(on_new_order)
    logger.info("[BOT] Ishga tushdi ✅")

    try:
        await dp.start_polling(bot)
    finally:
        watch.unsubscribe()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
