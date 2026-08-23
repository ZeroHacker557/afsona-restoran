"""
Firebase Firestore & Storage Integration for Python Telegram Bot
"""
import os
import uuid
import urllib.parse
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, firestore, storage

from config import CARD_NUMBER, CARD_OWNER

KEY_FILENAME = "ecommercytest-firebase-adminsdk-fbsvc-645304f3a0.json"

# Search for service account key file in root or bot dir
key_path = KEY_FILENAME
if not os.path.exists(key_path):
    key_path = os.path.join(os.path.dirname(__file__), "..", KEY_FILENAME)

if not firebase_admin._apps:
    cred = credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred, {
        'storageBucket': 'ecommercytest.firebasestorage.app'
    })

db = firestore.client()
bucket = storage.bucket()


def format_price(amount: int | float) -> str:
    try:
        val = int(amount)
        return f"{val:,}".replace(",", " ") + " so'm"
    except (ValueError, TypeError):
        return f"{amount} so'm"


# ─── Storage Image Upload ─────────────────────────────────────

def upload_image_to_firebase(local_path: str) -> str:
    """Uploads a local image file to Firebase Storage and returns its public URL."""
    try:
        blob_name = f"products/{uuid.uuid4().hex}_{os.path.basename(local_path)}"
        blob = bucket.blob(blob_name)
        blob.upload_from_filename(local_path)
        
        # Standard public Firebase download URL format
        encoded_name = urllib.parse.quote(blob_name, safe='')
        url = f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{encoded_name}?alt=media"
        print(f"[OK] Uploaded image to Firebase: {url}")
        return url
    except Exception as e:
        print(f"[ERR] Firebase Storage error: {e}")
        return ""


# ─── Products ─────────────────────────────────────────────────

def get_products():
    docs = db.collection("products").get()
    products = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        products.append(d)
    return products


def get_product_by_id(prod_id: str | int):
    doc_ref = db.collection("products").document(str(prod_id))
    doc = doc_ref.get()
    if doc.exists:
        d = doc.to_dict()
        d["id"] = doc.id
        return d
    return None


def add_product(data: dict):
    # Process local images if any and upload to Firebase Storage
    firebase_images = []
    for img in data.get("images", []):
        if img.startswith("http://") or img.startswith("https://"):
            firebase_images.append(img)
        else:
            # Check local images folder
            local_path = os.path.join("images", img)
            if not os.path.exists(local_path):
                local_path = img
            if os.path.exists(local_path):
                public_url = upload_image_to_firebase(local_path)
                if public_url:
                    firebase_images.append(public_url)
                else:
                    firebase_images.append(img)
            else:
                firebase_images.append(img)

    product_id = str(int(uuid.uuid4().int % 1000000))
    product_data = {
        "id": product_id,
        "name": data.get("name", ""),
        "price": data.get("price", 0),
        "oldPrice": data.get("oldPrice"),
        "category": data.get("category", ""),
        "images": firebase_images,
        "rating": 5.0,
        "reviews": 0,
        "sizes": data.get("sizes", []),
        "color": data.get("color", ""),
        "description": data.get("description", ""),
        "discount": data.get("discount", ""),
        # Ombor qoldig'i. Buyurtma berilganda server kamaytiradi.
        "stock": int(data.get("stock", 0) or 0),
    }

    db.collection("products").document(product_id).set(product_data)
    print(f"[OK] Firebase: Mahsulot saqlandi ({product_data['name']})")
    return product_data


def update_product(prod_id: str | int, updates: dict) -> bool:
    """Mahsulotning ayrim maydonlarini yangilaydi (narx, nom, qoldiq...)."""
    try:
        ref = db.collection("products").document(str(prod_id))
        if not ref.get().exists:
            return False
        ref.update(updates)
        print(f"[OK] Firebase: Mahsulot yangilandi ({prod_id}): {list(updates)}")
        return True
    except Exception as e:
        print(f"[ERR] update_product: {e}")
        return False


def delete_product(prod_id: str | int):
    db.collection("products").document(str(prod_id)).delete()
    print(f"[DEL] Firebase: Mahsulot o'chirildi ({prod_id})")


# ─── Categories ───────────────────────────────────────────────

def get_categories():
    docs = db.collection("categories").get()
    categories = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        categories.append(d)
    return categories


def get_category_by_id(cat_id: str | int):
    doc_ref = db.collection("categories").document(str(cat_id))
    doc = doc_ref.get()
    if doc.exists:
        d = doc.to_dict()
        d["id"] = doc.id
        return d
    return None


def add_category(name: str):
    cat_id = str(int(uuid.uuid4().int % 100000))
    cat_data = {"id": cat_id, "name": name, "icon": "package"}
    db.collection("categories").document(cat_id).set(cat_data)
    print(f"[OK] Firebase: Kategoriya qo'shildi ({name})")
    return cat_data


def delete_category(cat_id: str | int):
    db.collection("categories").document(str(cat_id)).delete()
    print(f"[DEL] Firebase: Kategoriya o'chirildi ({cat_id})")


# ─── Orders ───────────────────────────────────────────────
#
# Buyurtmaning yagona kaliti — Firestore hujjat id'si. Ilgari "id" maydonidagi
# "#1234567" ishlatilgan edi, u har ~2.8 soatda takrorlanib, noto'g'ri
# buyurtma yangilanishiga olib kelardi. Eski yozuvlar buzilmasligi uchun
# quyidagi funksiyalar avval hujjat id'sini, topilmasa "id" maydonini qidiradi.


def _order_ref(order_id: str):
    """Hujjat havolasini qaytaradi: avval doc.id, keyin eski 'id' maydoni."""
    ref = db.collection("orders").document(str(order_id))
    if ref.get().exists:
        return ref

    docs = db.collection("orders").where("id", "==", str(order_id)).limit(1).get()
    for doc in docs:
        return doc.reference
    return None


def update_order_status(order_id: str, new_status: str):
    try:
        ref = _order_ref(order_id)
        if ref is None:
            print(f"[ERR] Order {order_id} topilmadi")
            return False
        ref.update({"status": new_status})
        print(f"[OK] Order {order_id} status updated to {new_status}")
        return True
    except Exception as e:
        print(f"[ERR] Failed to update order status: {e}")
        return False


def update_payment_status(order_id: str, payment_status: str):
    """To'lov statusini yangilash"""
    try:
        ref = _order_ref(order_id)
        if ref is None:
            print(f"[ERR] Order {order_id} topilmadi")
            return False
        ref.update({"paymentStatus": payment_status})
        print(f"[OK] Order {order_id} payment status updated to {payment_status}")
        return True
    except Exception as e:
        print(f"[ERR] Failed to update payment status: {e}")
        return False


def get_order_by_id(order_id: str):
    """Buyurtmani hujjat id'si (yoki eski 'id' maydoni) bo'yicha olish"""
    try:
        ref = _order_ref(order_id)
        if ref is None:
            return None
        snap = ref.get()
        if not snap.exists:
            return None
        d = snap.to_dict()
        d["_doc_id"] = snap.id
        return d
    except Exception as e:
        print(f"[ERR] get_order_by_id: {e}")
        return None


def delete_order(doc_id: str) -> bool:
    """Buyurtmani butunlay o'chiradi. Faqat admin paneldan chaqiriladi."""
    try:
        ref = db.collection("orders").document(str(doc_id))
        if not ref.get().exists:
            return False
        ref.delete()
        print(f"[DEL] Buyurtma o'chirildi: {doc_id}")
        return True
    except Exception as e:
        print(f"[ERR] delete_order: {e}")
        return False


def order_display_id(order: dict) -> str:
    """Foydalanuvchiga ko'rsatiladigan raqam (eski yozuvlarda 'id' maydoni)."""
    return order.get("orderNumber") or order.get("id") or "—"


_MONTHS_UZ = ["yan", "fev", "mar", "apr", "may", "iyun",
              "iyul", "avg", "sen", "okt", "noy", "dek"]


def order_date_text(order: dict) -> str:
    """
    Buyurtma sanasi. Yangi yozuvlarda createdAt (ISO, UTC) bor —
    uni o'qiladigan ko'rinishga aylantiramiz. Eski yozuvlarda
    formatlangan 'date' matni saqlanib qolgan (F-10).
    """
    created = order.get("createdAt")
    if created:
        try:
            dt = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
            dt = dt.astimezone()
            return f"{dt.day} {_MONTHS_UZ[dt.month - 1]}, {dt.year} • {dt:%H:%M}"
        except (ValueError, TypeError):
            pass
    return order.get("date") or "—"


def claim_order_notification(doc_id: str) -> bool:
    """
    Buyurtmani 'adminga yuborilgan' deb belgilaydi.
    Transaction ichida atomik: True qaytsa — xabar yuborish shu chaqiruv
    zimmasida, aks holda boshqa birov allaqachon yuborgan.
    """
    ref = db.collection("orders").document(doc_id)

    @firestore.transactional
    def _claim(transaction):
        snap = ref.get(transaction=transaction)
        if not snap.exists:
            return False
        # Faqat aniq False bo'lganini olamiz. Eski buyurtmalarda bu maydon
        # umuman yo'q — ular qayta yuborilmasligi kerak.
        if snap.to_dict().get("notified") is not False:
            return False
        transaction.update(ref, {"notified": True})
        return True

    try:
        return _claim(db.transaction())
    except Exception as e:
        print(f"[ERR] claim_order_notification: {e}")
        return False


def claim_cancel_notification(doc_id: str) -> bool:
    """
    Mijoz bekor qilgan buyurtmani 'adminga aytildi' deb belgilaydi.
    claim_order_notification bilan bir xil mantiq — takroriy xabar bo'lmasin.
    """
    ref = db.collection("orders").document(doc_id)

    @firestore.transactional
    def _claim(transaction):
        snap = ref.get(transaction=transaction)
        if not snap.exists:
            return False
        if snap.to_dict().get("cancelNotified") is not False:
            return False
        transaction.update(ref, {"cancelNotified": True})
        return True

    try:
        return _claim(db.transaction())
    except Exception as e:
        print(f"[ERR] claim_cancel_notification: {e}")
        return False


def release_order_notification(doc_id: str):
    """Xabar yuborilmasa bayroqni qaytaramiz — keyingi urinishda qayta yuboriladi."""
    try:
        db.collection("orders").document(doc_id).update({"notified": False})
    except Exception as e:
        print(f"[ERR] release_order_notification: {e}")


def get_user_orders(user_id: int):
    """Foydalanuvchining barcha buyurtmalarini olish"""
    try:
        docs = db.collection("orders").where("userId", "==", user_id).get()
        orders = []
        for doc in docs:
            d = doc.to_dict()
            d["_doc_id"] = doc.id
            orders.append(d)
        orders.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
        return orders
    except Exception as e:
        print(f"[ERR] get_user_orders: {e}")
        return []


def listen_to_new_orders(callback, cancel_callback=None):
    """
    Yangi buyurtmalarni kuzatadi va callback'ni chaqiradi.

    Vaqt oynasiga tayanmaydi: har bir buyurtmada `notified` bayrog'i bor.
    Shu sababli bot qancha vaqt o'chib turgan bo'lsa ham, ishga tushganda
    yuborilmagan buyurtmalarni yetkazadi (F-21). Eski, `notified` maydoni
    yo'q buyurtmalar esa qayta yuborilmaydi.

    callback(order_data) — yuborish muvaffaqiyatsiz bo'lsa
    release_order_notification(doc_id) chaqirilishi kerak.
    """

    def on_snapshot(col_snapshot, changes, read_time):
        for change in changes:
            order_data = change.document.to_dict() or {}
            doc_id = change.document.id

            # ── Yangi buyurtma ──
            if change.type.name == 'ADDED':
                if order_data.get("notified") is False and claim_order_notification(doc_id):
                    order_data['_doc_id'] = doc_id
                    try:
                        callback(order_data)
                    except Exception as e:
                        print(f"[ERR] Buyurtma callback xatosi: {e}")
                        release_order_notification(doc_id)
                    continue

            # ── Mijoz bekor qildi ──
            if cancel_callback and order_data.get("cancelNotified") is False:
                if claim_cancel_notification(doc_id):
                    order_data['_doc_id'] = doc_id
                    try:
                        cancel_callback(order_data)
                    except Exception as e:
                        print(f"[ERR] Bekor qilish callback xatosi: {e}")

    orders_watch = db.collection("orders").on_snapshot(on_snapshot)
    return orders_watch

# ─── Users ────────────────────────────────────────────────────

def get_user(user_id: int) -> dict | None:
    try:
        snap = db.collection("users").document(str(user_id)).get()
        return snap.to_dict() if snap.exists else None
    except Exception as e:
        print(f"[ERR] get_user: {e}")
        return None


def set_user_phone(user_id: int, phone: str):
    """Telefon raqamini saqlaydi — mini app uni avtomatik to'ldiradi (F-26)."""
    try:
        db.collection("users").document(str(user_id)).set(
            {"id": user_id, "phone": phone}, merge=True
        )
        print(f"[OK] Telefon saqlandi: {user_id}")
        return True
    except Exception as e:
        print(f"[ERR] set_user_phone: {e}")
        return False


def get_all_users():
    docs = db.collection("users").get()
    users = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        users.append(d)
    return users

# ─── Promocodes ───────────────────────────────────────────────

def get_promocodes():
    docs = db.collection("promocodes").get()
    codes = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        codes.append(d)
    return codes

def add_promocode(code: str, discount: int):
    doc_ref = db.collection("promocodes").document()
    doc_ref.set({
        "code": code.upper(),
        "discountPercent": discount,
        "active": True,
        "usageCount": 0
    })
    return doc_ref.id

def delete_promocode(code_id: str):
    db.collection("promocodes").document(code_id).delete()

# ─── Notifications ────────────────────────────────────────────

def send_notification(user_id: int, title: str, body: str, type: str = 'system'):
    doc_ref = db.collection("notifications").document()
    doc_ref.set({
        "userId": user_id,
        "title": title,
        "body": body,
        # ISO 8601 — mini app shu bo'yicha saralaydi (F-10)
        "date": datetime.now(timezone.utc).isoformat(),
        "read": False,
        "type": type
    })


# ─── Payment settings ─────────────────────────────────────────
#
# Karta ma'lumoti yagona joyda — settings/payment hujjatida. Bot ham,
# mini app ham shu yerdan o'qiydi (F-07). config.py faqat birinchi
# marta to'ldirish uchun boshlang'ich qiymat beradi.

def get_payment_settings() -> dict:
    try:
        snap = db.collection("settings").document("payment").get()
        if snap.exists:
            data = snap.to_dict() or {}
            return {
                "cardNumber": data.get("cardNumber") or CARD_NUMBER,
                "cardOwner": data.get("cardOwner") or CARD_OWNER,
            }
    except Exception as e:
        print(f"[ERR] get_payment_settings: {e}")
    return {"cardNumber": CARD_NUMBER, "cardOwner": CARD_OWNER}


def ensure_payment_settings():
    """Hujjat yo'q bo'lsa config.py qiymatlari bilan yaratadi."""
    try:
        ref = db.collection("settings").document("payment")
        if not ref.get().exists:
            ref.set({"cardNumber": CARD_NUMBER, "cardOwner": CARD_OWNER})
            print("[OK] settings/payment yaratildi")
    except Exception as e:
        print(f"[ERR] ensure_payment_settings: {e}")


def update_payment_settings(card_number: str, card_owner: str):
    db.collection("settings").document("payment").set(
        {"cardNumber": card_number, "cardOwner": card_owner}, merge=True
    )


# ─── Delivery settings ────────────────────────────────────────

def get_delivery_settings() -> dict:
    try:
        snap = db.collection("settings").document("delivery").get()
        if snap.exists:
            data = snap.to_dict() or {}
            return {
                "fee": max(int(data.get("fee") or 0), 0),
                "freeFrom": max(int(data.get("freeFrom") or 0), 0),
            }
    except Exception as e:
        print(f"[ERR] get_delivery_settings: {e}")
    return {"fee": 0, "freeFrom": 0}


def ensure_delivery_settings():
    try:
        ref = db.collection("settings").document("delivery")
        if not ref.get().exists:
            ref.set({"fee": 0, "freeFrom": 0})
            print("[OK] settings/delivery yaratildi")
    except Exception as e:
        print(f"[ERR] ensure_delivery_settings: {e}")


def update_delivery_settings(fee: int, free_from: int):
    db.collection("settings").document("delivery").set(
        {"fee": int(fee), "freeFrom": int(free_from)}, merge=True
    )


# ─── Orders list (admin) ──────────────────────────────────────

def get_orders(status: str | None = None, limit: int = 20):
    """Buyurtmalar ro'yxati, yangisidan eskisiga."""
    try:
        query = db.collection("orders")
        if status:
            query = query.where("status", "==", status)
        docs = query.get()
        orders = []
        for doc in docs:
            d = doc.to_dict()
            d["_doc_id"] = doc.id
            orders.append(d)
        orders.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
        return orders[:limit]
    except Exception as e:
        print(f"[ERR] get_orders: {e}")
        return []


# ─── Sotuv hisoboti ───────────────────────────────────────────

def get_sales_report(days: int = 7) -> dict:
    """
    Oxirgi N kunlik savdo hisoboti.

    "Yetkazildi" statusidagi buyurtmalar haqiqiy savdo deb hisoblanadi;
    bekor qilingan va rad etilganlar summaga kirmaydi.
    """
    from datetime import timedelta

    since = datetime.now(timezone.utc) - timedelta(days=days)

    report = {
        "days": days,
        "orders": 0,
        "delivered": 0,
        "cancelled": 0,
        "pending": 0,
        "revenue": 0,
        "avg_check": 0,
        "top_products": [],
        "new_customers": 0,
    }

    try:
        docs = db.collection("orders").get()
    except Exception as e:
        print(f"[ERR] get_sales_report: {e}")
        return report

    product_counts = {}
    customers = set()
    delivered_totals = []

    for doc in docs:
        d = doc.to_dict() or {}

        created = d.get("createdAt")
        if not created:
            continue
        try:
            when = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
        except (ValueError, TypeError):
            continue
        if when < since:
            continue

        report["orders"] += 1

        status = d.get("status", "Yangi")
        if status == "Yetkazildi":
            report["delivered"] += 1
            total = d.get("total") or 0
            if isinstance(total, (int, float)):
                report["revenue"] += total
                delivered_totals.append(total)
        elif status in ("Bekor qilingan", "Rad etildi"):
            report["cancelled"] += 1
        else:
            report["pending"] += 1

        if d.get("userId"):
            customers.add(d["userId"])

        # Eng ko'p sotilgan mahsulotlar — bekor qilinmaganlar bo'yicha
        if status not in ("Bekor qilingan", "Rad etildi"):
            for item in d.get("products", []):
                prod = item.get("product") or {}
                name = prod.get("name")
                if not name:
                    continue
                qty = item.get("quantity", 1)
                entry = product_counts.setdefault(name, {"qty": 0, "sum": 0})
                entry["qty"] += qty
                entry["sum"] += (prod.get("price") or 0) * qty

    if delivered_totals:
        report["avg_check"] = round(sum(delivered_totals) / len(delivered_totals))

    report["new_customers"] = len(customers)
    report["top_products"] = sorted(
        ({"name": k, **v} for k, v in product_counts.items()),
        key=lambda x: x["qty"],
        reverse=True,
    )[:5]

    return report
