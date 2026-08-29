"""
Afsona Restaurant — mijozlar uchun Telegram bot.

Bot endi FAQAT mijoz bilan muloqot qiladi:
  • /start, menyu tugmasi, telefon raqamini olish
  • «Buyurtmalarim», «Biz bilan aloqa», «Yordam»

Boshqaruv (taomlar, buyurtmalar, statistika, xabarnoma) `/admin` web
panelida. Mijozga ketadigan xabarlarni ham (status o'zgarishi, to'lov
tasdig'i, ommaviy xabarnoma) Vercel funksiyalari to'g'ridan-to'g'ri
Telegram Bot API orqali yuboradi — ya'ni bu dastur o'chib qolsa ham
buyurtmalar va xabarlar yo'qolmaydi.
"""
import asyncio
import logging

import aiohttp

from aiogram import Bot, Dispatcher, F
from aiogram.types import (
    CallbackQuery,
    ChatMemberUpdated,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    MenuButtonWebApp,
    Message,
    ReplyKeyboardMarkup,
    WebAppInfo,
)
from aiogram.client.default import DefaultBotProperties
from aiogram.exceptions import TelegramBadRequest
from aiogram.fsm.storage.memory import MemoryStorage

from config import API_BASE_URL, BOT_API_SECRET, BOT_TOKEN, MINI_APP_URL
import firebase_db as db

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode="HTML"))
dp = Dispatcher(storage=MemoryStorage())

RESTAURANT_NAME = "Afsona Restaurant"


# ─── Klaviaturalar ────────────────────────────────────────────

def main_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            # Mini app yozuv maydoni yonidagi doimiy «🍽 Menyu» tugmasi
            # orqali ochiladi; bu tugma unga yo'l ko'rsatadi.
            [KeyboardButton(text="🍽 Menyu")],
            [KeyboardButton(text="📦 Buyurtmalarim")],
            [KeyboardButton(text="📞 Biz bilan aloqa"), KeyboardButton(text="ℹ️ Yordam")],
        ],
        resize_keyboard=True,
    )


# ─── Premium (custom) emoji ───────────────────────────────────
#
# Telegram HTML rejimida maxsus emoji shunday yoziladi:
#   <tg-emoji emoji-id="123">🍽</tg-emoji>
# Ichidagi oddiy emoji — zaxira: maxsus emoji ko'rsatilmasa o'sha chiqadi.
#
# DIQQAT: Telegram bunday emojini faqat Fragment'da qo'shimcha username
# sotib olgan botlarga ruxsat beradi. Aks holda so'rov xato bilan
# qaytadi — shuning uchun quyida oddiy variantga qaytish (fallback) bor.

CUSTOM_EMOJI = {
    "menu": "5233237686751355290",
    "bullet": "5337006433084912502",
    "point": "5411322793373477644",
}

# Bir marta rad javobi kelsa, keyin qayta urinilmaydi
_custom_emoji_ok = True


def ce(key: str, fallback: str, rich: bool = True) -> str:
    """Maxsus emoji yoki oddiysi."""
    emoji_id = CUSTOM_EMOJI.get(key)
    if not rich or not emoji_id:
        return fallback
    return f'<tg-emoji emoji-id="{emoji_id}">{fallback}</tg-emoji>'


async def answer_rich(message: Message, build, **kwargs):
    """
    Matnni avval maxsus emoji bilan yuboradi. Telegram rad etsa —
    oddiy emoji bilan qayta yuboradi va keyingi safar urinmaydi.
    """
    global _custom_emoji_ok

    if _custom_emoji_ok:
        try:
            await message.answer(build(True), **kwargs)
            return
        except TelegramBadRequest as e:
            _custom_emoji_ok = False
            logger.warning(f"[EMOJI] maxsus emoji ishlamadi, oddiysiga o'tildi: {e}")

    await message.answer(build(False), **kwargs)


def app_kb(text: str, page: str = "") -> InlineKeyboardMarkup | None:
    """
    Ilovani ochadigan inline tugma.

    `web_app` turidagi tugma ilovani Telegram ICHIDA ochadi — brauzerga
    olib chiqib ketmaydi. `page` berilsa, ilova to'g'ridan-to'g'ri o'sha
    bo'limda ochiladi (mini app `?page=` ni o'qiydi).
    """
    if not MINI_APP_URL:
        return None

    url = f"{MINI_APP_URL}/?page={page}" if page else MINI_APP_URL
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text=text, web_app=WebAppInfo(url=url))]]
    )


def contact_kb() -> ReplyKeyboardMarkup:
    """Telefon raqamini bir bosishda olish uchun."""
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📱 Raqamni yuborish", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


# ─── Yordamchi ────────────────────────────────────────────────

def brand_info() -> dict:
    """Aloqa ma'lumotlari — admin panelda kiritiladi (settings/brand)."""
    try:
        snap = db.db.collection("settings").document("brand").get()
        return snap.to_dict() or {} if snap.exists else {}
    except Exception as e:
        logger.warning(f"[BRAND] o'qib bo'lmadi: {e}")
        return {}


def working_hours_text() -> str:
    """settings/hours hujjatidan bugungi ish vaqti."""
    try:
        snap = db.db.collection("settings").document("hours").get()
        data = snap.to_dict() or {} if snap.exists else {}
        if not data.get("enabled"):
            return "Har kuni, kun bo'yi"
        if data.get("temporarilyClosed"):
            return "Hozircha yopiq"

        days = data.get("days") or []
        # Yakshanbadan boshlanadigan tartib (JS getDay bilan bir xil)
        import datetime
        index = (datetime.datetime.now().weekday() + 1) % 7
        day = days[index] if index < len(days) else None
        if not day or day.get("closed"):
            return "Bugun dam olish kuni"
        return f"{day.get('open', '09:00')} — {day.get('close', '23:00')}"
    except Exception as e:
        logger.warning(f"[HOURS] o'qib bo'lmadi: {e}")
        return "—"


# ─── /start ──────────────────────────────────────────────────

@dp.message(F.text.startswith("/start"))
async def cmd_start(message: Message):
    user = message.from_user

    await message.answer(
        f"Assalomu alaykum, <b>{user.first_name}</b>! 👋\n\n"
        f"✨ <b>{RESTAURANT_NAME}ga xush kelibsiz!</b>\n\n"
        "🍽 <b>Menyudan o'zingizga yoqqan taomlarni tanlang va oson buyurtma bering.</b>\n\n"
        "👇 <i>Buyurtmani boshlash uchun quyidagi tugmani bosing:</i>",
        reply_markup=main_kb(),
    )

    # Telefon raqami hali saqlanmagan bo'lsa, bir bosishda so'raymiz.
    # Mini app buni buyurtma formasiga avtomatik qo'yadi.
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
    contact = message.contact

    # Faqat o'z raqamini qabul qilamiz — boshqa odamning kontaktini emas
    if contact.user_id != message.from_user.id:
        await message.answer(
            "❌ Iltimos, <b>o'zingizning</b> raqamingizni yuboring.",
            reply_markup=contact_kb(),
        )
        return

    phone = contact.phone_number
    if not phone.startswith("+"):
        phone = f"+{phone}"

    if db.set_user_phone(message.from_user.id, phone):
        await message.answer(
            f"✅ Raqamingiz saqlandi: <code>{phone}</code>\n\n"
            "Endi buyurtma berishda u avtomatik to'ldiriladi.",
            reply_markup=main_kb(),
        )
    else:
        await message.answer(
            "❌ Raqamni saqlab bo'lmadi. Keyinroq qayta urinib ko'ring.",
            reply_markup=main_kb(),
        )


# ─── Menyu ───────────────────────────────────────────────────

def menu_text(rich: bool) -> str:
    dot = ce("bullet", "🔸", rich)
    return (
        "{} <b>MENYU</b>\n".format(ce("menu", "🍽", rich))
        + "━━━━━━━━━━━━━━━━━━━━━━\n\n"
        + "Barcha taomlarimiz rasmlari va narxlari bilan ilovada.\n\n"
        + f"{dot} Kategoriyalar bo'yicha tanlaysiz\n"
        + f"{dot} Savatga qo'shib, bir necha bosishda buyurtma berasiz\n"
        + f"{dot} Manzilni xaritadan belgilaysiz\n\n"
        + "{} <i>Ochish uchun tugmani bosing</i>".format(ce("point", "👇", rich))
    )


@dp.message(F.text == "🍽 Menyu")
async def handle_open_catalog(message: Message):
    await answer_rich(
        message,
        menu_text,
        reply_markup=app_kb("🍽 Menyuni ochish", "catalog"),
    )


# ─── Buyurtmalarim ───────────────────────────────────────────

@dp.message(F.text == "📦 Buyurtmalarim")
async def handle_my_orders(message: Message):
    """
    Buyurtmalar ro'yxati bot ichida ko'rsatilmaydi.

    Sababi: ilovada ular ancha yaxshi ko'rinadi — rasmlar, holat
    chizig'i, chek va bekor qilish tugmasi bilan. Bot esa uzun,
    o'qilmaydigan matn chiqarardi va har safar qayta yuborilardi.
    """
    text = (
        "📦 <b>Buyurtmalarim</b>\n"
        "━━━━━━━━━━━━━━\n\n"
        "Barcha buyurtmalaringiz ilovada saqlanadi:\n\n"
        "🔸 Holatini real vaqtda kuzatasiz\n"
        "🔸 Taomlar, summa va chekni ko'rasiz\n"
        "🔸 Kerak bo'lsa bekor qilasiz\n"
        "🔸 Karta bilan to'lasangiz — chekni yuborasiz\n\n"
        "👇 <i>Ochish uchun tugmani bosing</i>"
    )

    await message.answer(text, reply_markup=app_kb("📦 Buyurtmalarim", "orders"))


@dp.message(F.text == "📞 Biz bilan aloqa")
async def cmd_contact(message: Message):
    info = brand_info()
    name = info.get("name") or RESTAURANT_NAME

    lines = [f"📞 <b>{name} — biz bilan bog'lanish:</b>", ""]
    if info.get("telegram"):
        lines.append(f"👨‍💻 <b>Qo'llab-quvvatlash:</b> @{str(info['telegram']).lstrip('@')}")
    if info.get("phone"):
        lines.append(f"📞 <b>Telefon:</b> {info['phone']}")
    if info.get("email"):
        lines.append(f"✉️ <b>Email:</b> {info['email']}")
    if info.get("address"):
        lines.append(f"📍 <b>Manzil:</b> {info['address']}")
    lines.append(f"⏰ <b>Bugungi ish vaqti:</b> {working_hours_text()}")
    lines.append("")
    lines.append("<i>Savollaringiz bo'lsa, bemalol murojaat qiling!</i>")

    await message.answer("\n".join(lines))


@dp.message(F.text.in_({"ℹ️ Yordam", "/help"}))
async def cmd_help(message: Message):
    await message.answer(
        "ℹ️ <b>Botdan qanday foydalanish mumkin?</b>\n\n"
        "1️⃣ Yozuv maydoni yonidagi <b>«🍽 Menyu»</b> tugmasini bosib, "
        "taomlar bilan tanishing.\n"
        "2️⃣ O'zingizga yoqqan taomlarni <b>Savatga</b> qo'shing.\n"
        "3️⃣ Buyurtmani rasmiylashtirishda <b>Naqd</b> yoki <b>Karta</b> to'lovini tanlang.\n"
        "4️⃣ Karta orqali to'lasangiz, chek rasmini <b>ilovaning o'zida</b> "
        "«Buyurtmalarim» bo'limidan yuboring.\n"
        "5️⃣ Buyurtma holati o'zgarganda sizga shu yerda xabar keladi.\n\n"
        "<i>Qo'shimcha savollar uchun «📞 Biz bilan aloqa» bo'limiga yozing.</i>"
    )


# ─── Buyurtma tugmalari (kuryer va admin) ─────────────────────
#
# Bu yerda hech qanday qoida yo'q: bot faqat "falonchi shu tugmani bosdi"
# deb API'ga aytadi. Kim kuryer, buyurtmani kim olgan, status qanday
# o'zgaradi, mijozga nima yoziladi — hammasi serverda hal bo'ladi
# (api/_lib/courier.ts). Shu tufayli qoidalar bitta joyda turadi va
# panel bilan bot hech qachon bir-biriga zid ish qilmaydi.


async def _api(action: str, payload: dict) -> dict:
    """Vercel API'ga so'rov yuboradi. Xato bo'lsa bo'sh javob qaytaradi."""
    if not API_BASE_URL or not BOT_API_SECRET:
        logger.warning("[API] API_BASE_URL yoki BOT_API_SECRET sozlanmagan")
        return {}

    url = f"{API_BASE_URL}/api/admin"
    body = {"action": action, **payload}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json=body,
                headers={"X-Bot-Secret": BOT_API_SECRET},
                timeout=aiohttp.ClientTimeout(total=25),
            ) as response:
                data = await response.json(content_type=None)
                if not isinstance(data, dict):
                    return {}
                return data
    except Exception as e:
        logger.warning(f"[API] {action}: {e}")
        return {}


@dp.callback_query(F.data.regexp(r"^(take|done|loc):"))
async def cb_order_button(callback: CallbackQuery):
    act, order_id = callback.data.split(":", 1)

    result = await _api(
        "courier.action",
        {
            "act": act,
            "orderId": order_id,
            "userId": callback.from_user.id,
            "chatId": callback.message.chat.id,
        },
    )

    alert = result.get("alert") or result.get("error") or "Bajarilmadi, qayta urining."
    await callback.answer(alert, show_alert=bool(result.get("loud")))


@dp.message(F.text.regexp(r"^/guruh"))
async def cmd_bind_group(message: Message):
    """Xodimlar guruhini biriktiradi. Faqat admin ishlata oladi."""
    chat = message.chat

    if chat.type not in ("group", "supergroup"):
        await message.answer(
            "Bu buyruq guruh ichida ishlaydi. Avval botni guruhga qo'shing, "
            "so'ng o'sha yerda <code>/guruh</code> deb yozing."
        )
        return

    result = await _api(
        "courier.group",
        {"chatId": chat.id, "title": chat.title or "", "userId": message.from_user.id},
    )

    await message.answer(
        result.get("text")
        or "Guruhni biriktirib bo'lmadi. Internet va sozlamalarni tekshiring."
    )


# ─── Kanal biriktirish ────────────────────────────────────────
#
# Kanallarda buyruqlar botga yetib bormaydi, shuning uchun `/kanal` deb
# yozib bo'lmaydi. Buning o'rniga Telegram botning kanaldagi maqomi
# o'zgarganda `my_chat_member` yangilanishini yuboradi — botni
# administrator qilib qo'shish kifoya, qolganini o'zi hal qiladi.


@dp.my_chat_member()
async def on_my_status_changed(event: ChatMemberUpdated):
    chat = event.chat
    if chat.type != "channel":
        return

    status = event.new_chat_member.status
    if status != "administrator":
        return

    result = await _api(
        "channel.bind",
        {
            "chatId": chat.id,
            "title": chat.title or "",
            "username": chat.username or "",
            "userId": event.from_user.id if event.from_user else 0,
        },
    )

    if result.get("ok"):
        logger.info(f"[KANAL] biriktirildi: {chat.title} ({chat.id})")
    else:
        logger.warning(f"[KANAL] biriktirilmadi: {result.get('error') or 'javob yo‘q'}")


# ─── Main ─────────────────────────────────────────────────────

async def main():
    if MINI_APP_URL:
        try:
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(text="🍽 Menyu", web_app=WebAppInfo(url=MINI_APP_URL))
            )
        except Exception as e:
            logger.warning(f"Menu button: {e}")
    else:
        logger.warning("MINI_APP_URL sozlanmagan — menyu tugmasi qo'yilmadi")

    logger.info("[BOT] Ishga tushdi ✅")

    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
