"""
Adminlarni boshqarish.

config.py dagi ADMIN_IDS — EGALAR ro'yxati. Ular doim admin bo'lib
qoladi va admin paneldan o'chirib bo'lmaydi: aks holda oxirgi admin
o'zini o'chirib, panelga umuman kira olmay qolishi mumkin edi.

Qolgan adminlar Firestore'dagi settings/admins hujjatida saqlanadi va
panel orqali qo'shiladi/o'chiriladi. Ro'yxat xotirada keshlanadi —
har bir tugma bosilganda bazaga so'rov ketmasligi uchun.
"""
from config import ADMIN_IDS as OWNER_IDS
import firebase_db as db

_cache: set[int] | None = None


def refresh() -> set[int]:
    """Ro'yxatni bazadan qayta o'qiydi."""
    global _cache
    _cache = set(OWNER_IDS) | db.get_extra_admin_ids()
    return _cache


def all_admins() -> set[int]:
    if _cache is None:
        return refresh()
    return _cache


def is_admin(user_id: int) -> bool:
    return user_id in all_admins()


def is_owner(user_id: int) -> bool:
    """Egani panel orqali o'chirib bo'lmaydi."""
    return user_id in OWNER_IDS


def add(user_id: int) -> bool:
    if user_id in all_admins():
        return False
    if not db.add_extra_admin(user_id):
        return False
    refresh()
    return True


def remove(user_id: int) -> bool:
    if is_owner(user_id):
        return False
    if not db.remove_extra_admin(user_id):
        return False
    refresh()
    return True
