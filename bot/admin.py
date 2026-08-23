"""
Admin panel — Telegram inline keyboard orqali mahsulot va kategoriya boshqaruvi.
"""
import asyncio
import os
import uuid
from aiogram import Router, F, Bot
from aiogram.exceptions import TelegramForbiddenError, TelegramRetryAfter
from aiogram.types import (
    Message, CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup,
    FSInputFile
)
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from config import ADMIN_IDS, IMAGES_DIR
import firebase_db as db

router = Router()


# ─── FSM States ──────────────────────────────────────────────

class AddCategory(StatesGroup):
    name = State()

class BroadcastMenu(StatesGroup):
    message = State()

class AddPromo(StatesGroup):
    code = State()
    discount = State()


class AddProduct(StatesGroup):
    category = State()
    name = State()
    price = State()
    old_price = State()
    description = State()
    sizes = State()
    color = State()
    discount = State()
    stock = State()
    image = State()
    more_images = State()


class EditProduct(StatesGroup):
    value = State()


class DeliverySettings(StatesGroup):
    fee = State()
    free_from = State()


# ─── Helpers ─────────────────────────────────────────────────

def is_admin(user_id: int) -> bool:
    return user_id in ADMIN_IDS


def admin_menu_kb():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🛒 Buyurtmalar", callback_data="admin_orders")],
        [InlineKeyboardButton(text="📦 Mahsulotlar", callback_data="admin_products"),
         InlineKeyboardButton(text="📂 Kategoriyalar", callback_data="admin_categories")],
        [InlineKeyboardButton(text="➕ Mahsulot qo'shish", callback_data="admin_add_product")],
        [InlineKeyboardButton(text="➕ Kategoriya qo'shish", callback_data="admin_add_category")],
        [InlineKeyboardButton(text="🎟 Promokodlar", callback_data="admin_promocodes"),
         InlineKeyboardButton(text="📢 Xabarnoma", callback_data="admin_broadcast")],
        [InlineKeyboardButton(text="🚚 Yetkazib berish", callback_data="admin_delivery"),
         InlineKeyboardButton(text="📊 Statistika", callback_data="admin_stats")],
    ])


def back_to_menu_kb():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="◀️ Admin panel", callback_data="admin_menu")]
    ])


async def safe_edit(callback: CallbackQuery, text: str, kb: InlineKeyboardMarkup | None = None):
    """
    Xabarni tahrirlaydi. Agar xabar rasmli bo'lsa (edit_text ishlamaydi),
    eskisini o'chirib yangisini yuboradi.
    """
    try:
        await callback.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
    except Exception:
        try:
            await callback.message.delete()
        except Exception:
            pass
        await callback.message.answer(text, reply_markup=kb, parse_mode="HTML")


def stock_mark(product: dict) -> str:
    """Ro'yxatdagi qoldiq belgisi."""
    stock = product.get("stock")
    if not isinstance(stock, int):
        return "\U0001f4e6"
    if stock == 0:
        return "\U0001f534"
    if stock <= 5:
        return "\U0001f7e1"
    return "\U0001f7e2"


def product_edit_kb(prod_id) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✏️ Nom", callback_data=f"pedit_name_{prod_id}"),
         InlineKeyboardButton(text="💰 Narx", callback_data=f"pedit_price_{prod_id}")],
        [InlineKeyboardButton(text="📦 Qoldiq", callback_data=f"pedit_stock_{prod_id}"),
         InlineKeyboardButton(text="📝 Tavsif", callback_data=f"pedit_description_{prod_id}")],
        [InlineKeyboardButton(text="🗑 O'chirish", callback_data=f"prod_del_{prod_id}")],
        [InlineKeyboardButton(text="◀️ Mahsulotlar", callback_data="admin_products")],
    ])


def skip_kb(next_step: str):
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⏭ O'tkazib yuborish", callback_data=f"skip_{next_step}")]
    ])


# ─── Admin Menu ──────────────────────────────────────────────

@router.message(F.text == "/admin")
async def cmd_admin(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        await message.answer("⛔ Sizda admin huquqi yo'q.")
        return
    await state.clear()
    await message.answer(
        "🛠 <b>Admin Panel</b>\n\nQuyidagi bo'limlardan birini tanlang:",
        reply_markup=admin_menu_kb(),
        parse_mode="HTML"
    )


@router.callback_query(F.data == "admin_menu")
async def cb_admin_menu(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await state.clear()
    await callback.message.edit_text(
        "🛠 <b>Admin Panel</b>\n\nQuyidagi bo'limlardan birini tanlang:",
        reply_markup=admin_menu_kb(),
        parse_mode="HTML"
    )


# ─── Statistics ──────────────────────────────────────────────

@router.callback_query(F.data == "admin_stats")
async def cb_stats(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        return
    products = db.get_products()
    categories = db.get_categories()
    users = db.get_all_users()
    
    docs = db.db.collection("orders").get()
    orders = [doc.to_dict() for doc in docs]
    
    total_revenue = sum(o.get('total', 0) for o in orders if o.get('status') == 'Yetkazildi')
    active_orders = sum(1 for o in orders if o.get('status') in ['Yangi', 'Qabul qilindi', 'Yetkazilmoqda'])
    
    await callback.message.edit_text(
        f"📊 <b>Batafsil Statistika</b>\n\n"
        f"👥 Foydalanuvchilar: <b>{len(users)}</b>\n"
        f"📦 Mahsulotlar: <b>{len(products)}</b>\n"
        f"📂 Kategoriyalar: <b>{len(categories)}</b>\n"
        f"🛒 Barcha buyurtmalar: <b>{len(orders)}</b>\n"
        f"🔄 Faol buyurtmalar: <b>{active_orders}</b>\n"
        f"💰 Umumiy daromad: <b>{db.format_price(total_revenue)}</b>\n",
        reply_markup=back_to_menu_kb(),
        parse_mode="HTML"
    )


# ─── Categories ──────────────────────────────────────────────

@router.callback_query(F.data == "admin_categories")
async def cb_categories(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        return
    cats = db.get_categories()
    if not cats:
        await callback.message.edit_text(
            "📂 <b>Kategoriyalar</b>\n\nHali kategoriya qo'shilmagan.",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="➕ Kategoriya qo'shish", callback_data="admin_add_category")],
                [InlineKeyboardButton(text="◀️ Admin panel", callback_data="admin_menu")]
            ]),
            parse_mode="HTML"
        )
        return

    buttons = []
    for c in cats:
        buttons.append([
            InlineKeyboardButton(text=f"📂 {c['name']}", callback_data=f"cat_view_{c['id']}"),
            InlineKeyboardButton(text="🗑", callback_data=f"cat_del_{c['id']}")
        ])
    buttons.append([InlineKeyboardButton(text="➕ Kategoriya qo'shish", callback_data="admin_add_category")])
    buttons.append([InlineKeyboardButton(text="◀️ Admin panel", callback_data="admin_menu")])

    await callback.message.edit_text(
        f"📂 <b>Kategoriyalar</b> ({len(cats)} ta)\n\nO'chirish uchun 🗑 tugmasini bosing:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="HTML"
    )


@router.callback_query(F.data == "admin_add_category")
async def cb_add_category(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await state.set_state(AddCategory.name)
    await callback.message.edit_text(
        "📂 <b>Yangi kategoriya</b>\n\nKategoriya nomini yozing:",
        parse_mode="HTML"
    )


@router.message(AddCategory.name)
async def process_category_name(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    cat = db.add_category(message.text.strip())
    await state.clear()
    await message.answer(
        f"✅ Kategoriya qo'shildi: <b>{cat['name']}</b>",
        reply_markup=back_to_menu_kb(),
        parse_mode="HTML"
    )


@router.callback_query(F.data.startswith("cat_del_"))
async def cb_delete_category(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        return
    cat_id = callback.data.split("cat_del_")[-1]
    cat = db.get_category_by_id(cat_id)
    name = cat["name"] if cat else "Noma'lum"
    db.delete_category(cat_id)
    await callback.answer(f"🗑 {name} o'chirildi")
    # Refresh list
    await cb_categories(callback)


# ─── Products List ───────────────────────────────────────────

@router.callback_query(F.data == "admin_products")
async def cb_products(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        return
    products = db.get_products()
    if not products:
        await callback.message.edit_text(
            "📦 <b>Mahsulotlar</b>\n\nHali mahsulot qo'shilmagan.",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="➕ Mahsulot qo'shish", callback_data="admin_add_product")],
                [InlineKeyboardButton(text="◀️ Admin panel", callback_data="admin_menu")]
            ]),
            parse_mode="HTML"
        )
        return

    buttons = []
    for p in products[-20:]:  # Last 20
        buttons.append([
            InlineKeyboardButton(
                text=f"{stock_mark(p)} {p['name'][:26]} — {db.format_price(p['price'])}",
                callback_data=f"prod_view_{p['id']}"
            ),
            InlineKeyboardButton(text="🗑", callback_data=f"prod_del_{p['id']}")
        ])
    buttons.append([InlineKeyboardButton(text="➕ Mahsulot qo'shish", callback_data="admin_add_product")])
    buttons.append([InlineKeyboardButton(text="◀️ Admin panel", callback_data="admin_menu")])

    await callback.message.edit_text(
        f"📦 <b>Mahsulotlar</b> ({len(products)} ta)\n\nKo'rish yoki o'chirish:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="HTML"
    )


@router.callback_query(F.data.startswith("prod_view_"))
async def cb_view_product(callback: CallbackQuery, bot: Bot):
    if not is_admin(callback.from_user.id):
        return
    prod_id = callback.data.split("prod_view_")[-1]
    p = db.get_product_by_id(prod_id)
    if not p:
        await callback.answer("Mahsulot topilmadi")
        return

    text = (
        f"📦 <b>{p['name']}</b>\n\n"
        f"💰 Narx: <b>{db.format_price(p['price'])}</b>\n"
    )
    if p.get("oldPrice"):
        text += f"💰 Eski narx: <s>{db.format_price(p['oldPrice'])}</s>\n"
    text += f"📂 Kategoriya: {p['category']}\n"
    if p.get("color"):
        text += f"🎨 Rang: {p['color']}\n"
    if p.get("sizes"):
        text += f"📏 Razmerlar: {', '.join(p['sizes'])}\n"
    if p.get("discount"):
        text += f"🏷 Chegirma: {p['discount']}\n"
    if p.get("description"):
        text += f"\n📝 {p['description'][:200]}\n"
    stock = p.get("stock")
    if isinstance(stock, int):
        mark = "🔴" if stock == 0 else ("🟡" if stock <= 5 else "🟢")
        text += f"📦 Omborda: {mark} <b>{stock}</b> ta\n"
    text += f"\n⭐ {p['rating']} ({p['reviews']} baho)"

    kb = product_edit_kb(p["id"])

    # Rasm Firebase Storage'da (to'liq URL) yoki eski lokal fayl bo'lishi mumkin
    images = p.get("images") or []
    if images:
        first = images[0]
        try:
            if str(first).startswith("http"):
                await callback.message.delete()
                await bot.send_photo(
                    callback.from_user.id, photo=first,
                    caption=text, reply_markup=kb, parse_mode="HTML"
                )
                return
            img_path = os.path.join(IMAGES_DIR, first)
            if os.path.exists(img_path):
                await callback.message.delete()
                await bot.send_photo(
                    callback.from_user.id, photo=FSInputFile(img_path),
                    caption=text, reply_markup=kb, parse_mode="HTML"
                )
                return
        except Exception as e:
            print(f"[WARN] Mahsulot rasmini yuborib bo'lmadi: {e}")

    await safe_edit(callback, text, kb)


@router.callback_query(F.data.startswith("prod_del_"))
async def cb_delete_product(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        return
    prod_id = callback.data.split("prod_del_")[-1]
    p = db.get_product_by_id(prod_id)
    name = p["name"] if p else "Noma'lum"
    db.delete_product(prod_id)
    await callback.answer(f"🗑 {name} o'chirildi")
    await cb_products(callback)


# ─── Add Product Flow ────────────────────────────────────────

@router.callback_query(F.data == "admin_add_product")
async def cb_add_product_start(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return

    cats = db.get_categories()
    if not cats:
        await callback.message.edit_text(
            "⚠️ Avval kamida bitta kategoriya qo'shing!",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="➕ Kategoriya qo'shish", callback_data="admin_add_category")],
                [InlineKeyboardButton(text="◀️ Admin panel", callback_data="admin_menu")]
            ]),
            parse_mode="HTML"
        )
        return

    buttons = [[InlineKeyboardButton(text=c["name"], callback_data=f"addprod_cat_{c['id']}")] for c in cats]
    buttons.append([InlineKeyboardButton(text="❌ Bekor qilish", callback_data="admin_menu")])

    await callback.message.edit_text(
        "📦 <b>Yangi mahsulot</b>\n\n1️⃣ Kategoriyani tanlang:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        parse_mode="HTML"
    )


@router.callback_query(F.data.startswith("addprod_cat_"))
async def cb_add_product_category(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    cat_id = callback.data.split("addprod_cat_")[-1]
    cat = db.get_category_by_id(cat_id)
    if not cat:
        await callback.answer("Kategoriya topilmadi")
        return

    await state.update_data(category=cat["name"], images=[])
    await state.set_state(AddProduct.name)
    await callback.message.edit_text(
        f"📦 <b>Yangi mahsulot</b>\n\n"
        f"📂 Kategoriya: <b>{cat['name']}</b>\n\n"
        f"2️⃣ Mahsulot nomini yozing:",
        parse_mode="HTML"
    )


@router.message(AddProduct.name)
async def process_product_name(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await state.update_data(name=message.text.strip())
    await state.set_state(AddProduct.price)
    await message.answer(
        f"✅ Nom: <b>{message.text.strip()}</b>\n\n"
        f"3️⃣ Narxni kiriting (faqat raqam, so'mda):\n"
        f"Masalan: <code>150000</code>",
        parse_mode="HTML"
    )


@router.message(AddProduct.price)
async def process_product_price(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    try:
        price = int(message.text.strip().replace(" ", "").replace(",", ""))
    except ValueError:
        await message.answer("❌ Faqat raqam kiriting! Masalan: 150000")
        return
    await state.update_data(price=price)
    await state.set_state(AddProduct.old_price)
    await message.answer(
        f"✅ Narx: <b>{db.format_price(price)}</b>\n\n"
        f"4️⃣ Eski narxni kiriting (chegirma uchun).",
        reply_markup=skip_kb("old_price"),
        parse_mode="HTML"
    )


@router.callback_query(F.data == "skip_old_price")
async def cb_skip_old_price(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await state.update_data(oldPrice=None)
    await state.set_state(AddProduct.description)
    await callback.message.edit_text(callback.message.html_text)
    await callback.message.answer(
        "5️⃣ Mahsulot tavsifini yozing:",
        reply_markup=skip_kb("desc"),
        parse_mode="HTML"
    )


@router.message(AddProduct.old_price)
async def process_old_price(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    text = message.text.strip()
    old_price = None
    if text != "-":
        try:
            old_price = int(text.replace(" ", "").replace(",", ""))
        except ValueError:
            await message.answer("❌ Faqat raqam kiriting!")
            return
    await state.update_data(oldPrice=old_price)
    await state.set_state(AddProduct.description)
    await message.answer(
        "5️⃣ Mahsulot tavsifini yozing:",
        reply_markup=skip_kb("desc"),
        parse_mode="HTML"
    )


@router.callback_query(F.data == "skip_desc")
async def cb_skip_desc(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await state.update_data(description="")
    await state.set_state(AddProduct.sizes)
    await callback.message.edit_text(callback.message.html_text)
    await callback.message.answer(
        "6️⃣ Razmerlarni vergul bilan yozing.\nMasalan: <code>S, M, L, XL</code>",
        reply_markup=skip_kb("sizes"),
        parse_mode="HTML"
    )


@router.message(AddProduct.description)
async def process_description(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    text = message.text.strip()
    desc = text if text != "-" else ""
    await state.update_data(description=desc)
    await state.set_state(AddProduct.sizes)
    await message.answer(
        "6️⃣ Razmerlarni vergul bilan yozing.\nMasalan: <code>S, M, L, XL</code>",
        reply_markup=skip_kb("sizes"),
        parse_mode="HTML"
    )


@router.callback_query(F.data == "skip_sizes")
async def cb_skip_sizes(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await state.update_data(sizes=[])
    await state.set_state(AddProduct.color)
    await callback.message.edit_text(callback.message.html_text)
    await callback.message.answer(
        "7️⃣ Ranglarni vergul bilan yozing.\nMasalan: <code>Qora, Oq, Qizil</code>",
        reply_markup=skip_kb("color"),
        parse_mode="HTML"
    )


@router.message(AddProduct.sizes)
async def process_sizes(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    text = message.text.strip()
    sizes = [s.strip() for s in text.split(",")] if text != "-" else []
    await state.update_data(sizes=sizes)
    await state.set_state(AddProduct.color)
    await message.answer(
        "7️⃣ Ranglarni vergul bilan yozing.\nMasalan: <code>Qora, Oq, Qizil</code>",
        reply_markup=skip_kb("color"),
        parse_mode="HTML"
    )


@router.callback_query(F.data == "skip_color")
async def cb_skip_color(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await state.update_data(color="")
    await state.set_state(AddProduct.discount)
    await callback.message.edit_text(callback.message.html_text)
    await callback.message.answer(
        "8️⃣ Chegirma foizini yozing.\nMasalan: <code>-20%</code>",
        reply_markup=skip_kb("discount"),
        parse_mode="HTML"
    )


@router.message(AddProduct.color)
async def process_color(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    text = message.text.strip()
    color = text if text != "-" else ""
    await state.update_data(color=color)
    await state.set_state(AddProduct.discount)
    await message.answer(
        "8️⃣ Chegirma foizini yozing.\nMasalan: <code>-20%</code>",
        reply_markup=skip_kb("discount"),
        parse_mode="HTML"
    )


ASK_STOCK = "9\ufe0f\u20e3 Omborda nechta bor? (faqat raqam)\nMasalan: <code>25</code>"
ASK_IMAGE = "\U0001f51f Mahsulot rasmini yuboring (foto sifatida).\nBu asosiy rasm bo'ladi:"


@router.callback_query(F.data == "skip_discount")
async def cb_skip_discount(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("Ruxsat yo'q", show_alert=True)
        return
    await state.update_data(discount="")
    await state.set_state(AddProduct.stock)
    await callback.message.edit_text(callback.message.html_text)
    await callback.message.answer(ASK_STOCK, parse_mode="HTML")
    await callback.answer()


@router.message(AddProduct.discount)
async def process_discount(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    text = message.text.strip()
    discount = text if text != "-" else ""
    await state.update_data(discount=discount)
    await state.set_state(AddProduct.stock)
    await message.answer(ASK_STOCK, parse_mode="HTML")


@router.message(AddProduct.stock)
async def process_stock(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    try:
        stock = int(message.text.strip().replace(" ", ""))
        if stock < 0:
            raise ValueError
    except (ValueError, AttributeError):
        await message.answer("Manfiy bo'lmagan butun son kiriting. Masalan: 25")
        return
    await state.update_data(stock=stock)
    await state.set_state(AddProduct.image)
    await message.answer(ASK_IMAGE, parse_mode="HTML")


@router.message(AddProduct.image, F.photo)
async def process_image(message: Message, state: FSMContext, bot: Bot):
    if not is_admin(message.from_user.id):
        return

    # Download image
    photo = message.photo[-1]  # Highest resolution
    file = await bot.get_file(photo.file_id)
    ext = "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(IMAGES_DIR, filename)
    await bot.download_file(file.file_path, filepath)

    data = await state.get_data()
    images = data.get("images", [])
    images.append(filename)
    await state.update_data(images=images)

    await state.set_state(AddProduct.more_images)
    await message.answer(
        f"✅ Rasm saqlandi! ({len(images)} ta rasm)\n\n"
        f"Yana rasm qo'shmoqchimisiz?",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="📷 Yana rasm qo'shish", callback_data="addprod_more_img")],
            [InlineKeyboardButton(text="✅ Tayyor — saqlash", callback_data="addprod_save")],
        ]),
        parse_mode="HTML"
    )


@router.message(AddProduct.image)
async def process_image_invalid(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await message.answer("❌ Iltimos, rasm yuboring (foto sifatida)!")


@router.callback_query(F.data == "addprod_more_img")
async def cb_more_images(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await state.set_state(AddProduct.image)
    await callback.message.edit_text("📷 Keyingi rasmni yuboring:")


@router.message(AddProduct.more_images, F.photo)
async def process_more_image(message: Message, state: FSMContext, bot: Bot):
    # Same as process_image
    await process_image(message, state, bot)


@router.callback_query(F.data == "addprod_save")
async def cb_save_product(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    data = await state.get_data()
    product = db.add_product(data)
    await state.clear()

    text = (
        f"✅ <b>Mahsulot qo'shildi!</b>\n\n"
        f"📦 {product['name']}\n"
        f"💰 {db.format_price(product['price'])}\n"
        f"📂 {product['category']}\n"
        f"🖼 {len(product.get('images', []))} ta rasm\n"
    )

    await callback.message.edit_text(
        text,
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="➕ Yana mahsulot qo'shish", callback_data="admin_add_product")],
            [InlineKeyboardButton(text="◀️ Admin panel", callback_data="admin_menu")],
        ]),
        parse_mode="HTML"
    )


# ─── Broadcast (Ommaviy xabar) ───────────────────────────────

@router.callback_query(F.data == "admin_broadcast")
async def cb_broadcast(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await state.set_state(BroadcastMenu.message)
    await callback.message.edit_text(
        "📢 <b>Ommaviy xabarnoma</b>\n\nFoydalanuvchilarga yubormoqchi bo'lgan xabarni kiriting (yoki /cancel yozing):",
        reply_markup=back_to_menu_kb(),
        parse_mode="HTML"
    )

@router.message(BroadcastMenu.message)
async def process_broadcast_message(message: Message, state: FSMContext, bot: Bot):
    if not is_admin(message.from_user.id):
        return
    if message.text == "/cancel":
        await state.clear()
        await message.answer("❌ Bekor qilindi.", reply_markup=InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="◀️ Admin panel", callback_data="admin_menu")]]))
        return

    body = message.html_text or message.text or ""
    if not body.strip():
        await message.answer("Xabar matni bo'sh. Qaytadan yozing yoki /cancel.")
        return

    users = db.get_all_users()
    await state.clear()

    progress = await message.answer(f"Yuborilmoqda... (0/{len(users)})")

    sent = blocked = failed = 0
    for i, u in enumerate(users, 1):
        user_id = u.get("id")
        if not user_id:
            continue
        try:
            uid = int(user_id)
        except (TypeError, ValueError):
            continue

        # 1) Mini appdagi bildirishnomalar ro'yxatiga
        try:
            db.send_notification(uid, "Xabarnoma", message.text or body, "system")
        except Exception as e:
            print(f"[BROADCAST] notification xatosi {uid}: {e}")

        # 2) Telegram xabari — avval buni qilmasdik, admin esa
        #    "yuborildi" degan yolg'on tasdiq olardi (F-22)
        try:
            await bot.send_message(uid, body, parse_mode="HTML")
            sent += 1
        except TelegramForbiddenError:
            blocked += 1
        except TelegramRetryAfter as e:
            await asyncio.sleep(e.retry_after)
            try:
                await bot.send_message(uid, body, parse_mode="HTML")
                sent += 1
            except Exception:
                failed += 1
        except Exception as e:
            print(f"[BROADCAST] {uid}: {e}")
            failed += 1

        # Telegram limiti ~30 xabar/sekund
        await asyncio.sleep(0.05)

        if i % 25 == 0:
            try:
                await progress.edit_text(f"Yuborilmoqda... ({i}/{len(users)})")
            except Exception:
                pass

    report = (
        "\U0001f4e2 <b>Xabarnoma yakunlandi</b>\n\n"
        f"\u2705 Yetkazildi: <b>{sent}</b>\n"
        f"\U0001f6ab Botni bloklagan: <b>{blocked}</b>\n"
        f"\u26a0\ufe0f Xatolik: <b>{failed}</b>\n\n"
        "<i>Barchasi mini appdagi bildirishnomalarda ham ko'rinadi.</i>"
    )
    try:
        await progress.edit_text(report, parse_mode="HTML", reply_markup=back_to_menu_kb())
    except Exception:
        await message.answer(report, parse_mode="HTML", reply_markup=back_to_menu_kb())


# ─── Promocodes (Promokodlar) ────────────────────────────────

@router.callback_query(F.data == "admin_promocodes")
async def cb_promocodes(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        return
    codes = db.get_promocodes()
    text = "🎟 <b>Promokodlar</b>\n\n"
    if not codes:
        text += "Hozircha promokodlar yo'q."
    else:
        for c in codes:
            text += f"▪️ <b>{c.get('code', '')}</b> - {c.get('discountPercent', 0)}% chegirma (Faol: {'✅' if c.get('active', True) else '❌'})\n"
    
    buttons = [
        [InlineKeyboardButton(text="➕ Promokod qo'shish", callback_data="admin_add_promo")],
        [InlineKeyboardButton(text="◀️ Admin panel", callback_data="admin_menu")]
    ]
    await callback.message.edit_text(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons), parse_mode="HTML")


@router.callback_query(F.data == "admin_add_promo")
async def cb_add_promo(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await state.set_state(AddPromo.code)
    await callback.message.edit_text("🎟 Yangi promokodni kiriting (masalan: NEWYEAR2026):", reply_markup=back_to_menu_kb())


@router.message(AddPromo.code)
async def process_promo_code(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await state.update_data(code=message.text.upper())
    await state.set_state(AddPromo.discount)
    await message.answer("Endi chegirma foizini kiriting (raqamda, masalan: 10):")


@router.message(AddPromo.discount)
async def process_promo_discount(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    try:
        discount = int(message.text)
    except ValueError:
        await message.answer("Iltimos, faqat raqam kiriting!")
        return

    data = await state.get_data()
    db.add_promocode(data['code'], discount)
    await state.clear()
    await message.answer(f"✅ Promokod <b>{data['code']}</b> ({discount}%) saqlandi!", parse_mode="HTML", reply_markup=InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="◀️ Admin panel", callback_data="admin_menu")]]))


# ─── Mahsulotni tahrirlash (F-24) ────────────────────────────
#
# Ilgari narxni o'zgartirish uchun mahsulotni o'chirib, 9 bosqichli
# formani boshidan to'ldirish kerak edi — rasmlarini ham qaytadan.

EDIT_FIELDS = {
    "name": ("Yangi nomni yozing:", "Nom"),
    "price": ("Yangi narxni yozing (faqat raqam):", "Narx"),
    "stock": ("Ombordagi yangi qoldiqni yozing (faqat raqam):", "Qoldiq"),
    "description": ("Yangi tavsifni yozing:", "Tavsif"),
}


@router.callback_query(F.data.startswith("pedit_"))
async def cb_edit_product_field(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("Ruxsat yo'q", show_alert=True)
        return

    rest = callback.data[len("pedit_"):]
    field, _, prod_id = rest.partition("_")
    if field not in EDIT_FIELDS:
        await callback.answer("Noma'lum maydon")
        return

    product = db.get_product_by_id(prod_id)
    if not product:
        await callback.answer("Mahsulot topilmadi", show_alert=True)
        return

    prompt, label = EDIT_FIELDS[field]
    current = product.get(field)
    if field == "price":
        current = db.format_price(current or 0)

    await state.update_data(edit_prod_id=prod_id, edit_field=field)
    await state.set_state(EditProduct.value)

    shown_current = current if current not in (None, "") else "\u2014"
    product_name = product.get("name", "")

    await callback.message.answer(
        f"\u270f\ufe0f <b>{product_name}</b>\n"
        f"{label} \u2014 hozirgi qiymat: <b>{shown_current}</b>\n\n"
        f"{prompt}\n\n<i>Bekor qilish uchun /cancel</i>",
        parse_mode="HTML",
    )
    await callback.answer()


@router.message(EditProduct.value)
async def process_edit_value(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return

    if (message.text or "").strip() == "/cancel":
        await state.clear()
        await message.answer("Bekor qilindi.", reply_markup=back_to_menu_kb())
        return

    data = await state.get_data()
    prod_id = data.get("edit_prod_id")
    field = data.get("edit_field")
    raw = (message.text or "").strip()

    if field in ("price", "stock"):
        try:
            value = int(raw.replace(" ", "").replace(",", ""))
            if value < 0:
                raise ValueError
        except ValueError:
            await message.answer("Manfiy bo'lmagan butun son kiriting.")
            return
    else:
        if not raw:
            await message.answer("Bo'sh qiymat qabul qilinmaydi.")
            return
        value = raw

    if not db.update_product(prod_id, {field: value}):
        await state.clear()
        await message.answer("Mahsulot topilmadi yoki yangilanmadi.", reply_markup=back_to_menu_kb())
        return

    await state.clear()
    shown = db.format_price(value) if field == "price" else value
    await message.answer(
        f"\u2705 <b>{EDIT_FIELDS[field][1]}</b> yangilandi: <b>{shown}</b>\n\n"
        "<i>O'zgarish mini appda darhol ko'rinadi.</i>",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="\U0001f4e6 Mahsulotga qaytish", callback_data=f"prod_view_{prod_id}")],
            [InlineKeyboardButton(text="\u25c0\ufe0f Admin panel", callback_data="admin_menu")],
        ]),
    )


# ─── Buyurtmalar ro'yxati (F-24) ─────────────────────────────

ORDER_STATUS_FILTERS = [
    ("all", "Barchasi"),
    ("Yangi", "\U0001f7e1 Yangi"),
    ("Qabul qilindi", "\U0001f7e2 Qabul qilingan"),
    ("Yetkazilmoqda", "\U0001f69a Yo'lda"),
    ("Yetkazildi", "\U0001f389 Yetkazilgan"),
]


def orders_filter_kb(active: str) -> InlineKeyboardMarkup:
    rows, row = [], []
    for value, label in ORDER_STATUS_FILTERS:
        mark = "\u2022 " if value == active else ""
        row.append(InlineKeyboardButton(text=f"{mark}{label}", callback_data=f"orders_{value}"))
        if len(row) == 2:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append([InlineKeyboardButton(text="\u25c0\ufe0f Admin panel", callback_data="admin_menu")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


@router.callback_query(F.data == "admin_orders")
async def cb_orders(callback: CallbackQuery):
    await show_orders(callback, "all")


@router.callback_query(F.data.startswith("orders_"))
async def cb_orders_filtered(callback: CallbackQuery):
    await show_orders(callback, callback.data[len("orders_"):])


async def show_orders(callback: CallbackQuery, status: str):
    if not is_admin(callback.from_user.id):
        await callback.answer("Ruxsat yo'q", show_alert=True)
        return

    orders = db.get_orders(None if status == "all" else status, limit=10)

    label = dict(ORDER_STATUS_FILTERS).get(status, "Barchasi")
    text = f"\U0001f6d2 <b>Buyurtmalar \u2014 {label}</b>\n"
    text += "\u2501" * 22 + "\n\n"

    if not orders:
        text += "Bu bo'limda buyurtma yo'q."
    else:
        for o in orders:
            total = o.get("total", 0)
            total_str = db.format_price(total) if isinstance(total, (int, float)) else str(total)
            customer = o.get("customer", {})
            text += f"\U0001f9fe <b>{db.order_display_id(o)}</b> \u2014 {o.get('status', 'Yangi')}\n"
            text += f"\U0001f4c5 {db.order_date_text(o)}\n"
            cust_name = customer.get("name") or "—"
            cust_phone = customer.get("phone") or "—"
            text += f"👤 {cust_name} • <code>{cust_phone}</code>\n"
            text += f"\U0001f4b0 <b>{total_str}</b>"
            if o.get("paymentMethod") == "Karta":
                pay = o.get("paymentStatus") or "Kutilmoqda"
                text += f" \u2022 \U0001f4b3 {pay}"
            text += "\n\n"
        text += f"<i>Oxirgi {len(orders)} ta ko'rsatildi.</i>"

    try:
        await callback.message.edit_text(text, reply_markup=orders_filter_kb(status), parse_mode="HTML")
    except Exception:
        await callback.message.answer(text, reply_markup=orders_filter_kb(status), parse_mode="HTML")
    await callback.answer()


# ─── Yetkazib berish sozlamalari ─────────────────────────────

@router.callback_query(F.data == "admin_delivery")
async def cb_delivery(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("Ruxsat yo'q", show_alert=True)
        return

    settings = db.get_delivery_settings()
    fee = settings["fee"]
    free_from = settings["freeFrom"]

    text = "\U0001f69a <b>Yetkazib berish</b>\n\n"
    text += f"Narx: <b>{db.format_price(fee) if fee else 'Bepul'}</b>\n"
    if free_from:
        text += f"Bepul yetkazish: <b>{db.format_price(free_from)}</b>dan yuqori buyurtmalarga\n"
    else:
        text += "Bepul yetkazish chegarasi: <b>yo'q</b>\n"
    text += "\n<i>Bu qiymatlar mini appdagi hisob-kitobda va buyurtma summasida ishlatiladi.</i>"

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="\u270f\ufe0f O'zgartirish", callback_data="delivery_edit")],
        [InlineKeyboardButton(text="\u25c0\ufe0f Admin panel", callback_data="admin_menu")],
    ])
    try:
        await callback.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
    except Exception:
        await callback.message.answer(text, reply_markup=kb, parse_mode="HTML")
    await callback.answer()


@router.callback_query(F.data == "delivery_edit")
async def cb_delivery_edit(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        await callback.answer("Ruxsat yo'q", show_alert=True)
        return
    await state.set_state(DeliverySettings.fee)
    await callback.message.answer(
        "\U0001f69a Yetkazib berish narxini yozing (so'mda, faqat raqam).\n"
        "Bepul bo'lsa <code>0</code> yozing:",
        parse_mode="HTML",
    )
    await callback.answer()


@router.message(DeliverySettings.fee)
async def process_delivery_fee(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    try:
        fee = int((message.text or "").strip().replace(" ", "").replace(",", ""))
        if fee < 0:
            raise ValueError
    except ValueError:
        await message.answer("Manfiy bo'lmagan butun son kiriting.")
        return

    await state.update_data(fee=fee)
    await state.set_state(DeliverySettings.free_from)
    await message.answer(
        "Endi bepul yetkazish chegarasini yozing.\n"
        "Masalan <code>500000</code> \u2014 shu summadan yuqori buyurtmalar bepul.\n"
        "Chegara kerak bo'lmasa <code>0</code> yozing:",
        parse_mode="HTML",
    )


@router.message(DeliverySettings.free_from)
async def process_delivery_free_from(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    try:
        free_from = int((message.text or "").strip().replace(" ", "").replace(",", ""))
        if free_from < 0:
            raise ValueError
    except ValueError:
        await message.answer("Manfiy bo'lmagan butun son kiriting.")
        return

    data = await state.get_data()
    fee = data.get("fee", 0)
    db.update_delivery_settings(fee, free_from)
    await state.clear()

    text = "\u2705 <b>Yetkazib berish sozlamalari saqlandi</b>\n\n"
    text += f"Narx: <b>{db.format_price(fee) if fee else 'Bepul'}</b>\n"
    if free_from:
        text += f"Bepul: <b>{db.format_price(free_from)}</b>dan yuqori buyurtmalarga"
    else:
        text += "Bepul yetkazish chegarasi: yo'q"

    await message.answer(text, parse_mode="HTML", reply_markup=back_to_menu_kb())
