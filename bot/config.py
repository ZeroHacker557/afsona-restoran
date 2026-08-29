"""
Bot sozlamalari.

Barcha maxfiy qiymatlar `.env` faylidan yoki muhit o'zgaruvchilaridan
o'qiladi — kodda token va karta raqami saqlanmaydi. Namuna: `.env.example`.

Katalog, buyurtma va to'lov sozlamalari endi bu yerda emas: ularni
`/admin` boshqaruv paneli Firestore'da saqlaydi.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent


def _load_env_file() -> None:
    """
    Oddiy .env o'qigich — qo'shimcha kutubxonasiz.
    Avval loyiha ildizidagi, keyin bot/ ichidagi fayl ko'riladi.
    """
    for path in (ROOT_DIR / '.env', BASE_DIR / '.env'):
        if not path.exists():
            continue
        for raw in path.read_text(encoding='utf-8').splitlines():
            line = raw.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            # Muhit o'zgaruvchisi ustun turadi
            os.environ.setdefault(key, value)


_load_env_file()


def _require(name: str) -> str:
    value = os.environ.get(name, '').strip()
    if not value:
        raise RuntimeError(
            f"{name} sozlanmagan. Loyiha ildizida .env fayl yarating "
            f"(.env.example dan nusxa oling) yoki muhit o'zgaruvchisini qo'ying."
        )
    return value


# ─── Telegram ────────────────────────────────────────────────
BOT_TOKEN = _require('BOT_TOKEN')
BOT_USERNAME = os.environ.get('BOT_USERNAME', '').lstrip('@')
MINI_APP_URL = os.environ.get('MINI_APP_URL', '').rstrip('/')

# Buyurtma xabarnomasi keladigan Telegram ID'lar. Asosiy ro'yxat
# Firestore'dagi settings/admins hujjatida — bu esa zaxira.
ADMIN_CHAT_IDS = {
    int(part)
    for part in os.environ.get('ADMIN_CHAT_IDS', '').replace(';', ',').split(',')
    if part.strip().lstrip('-').isdigit()
}

# ─── Vercel API ──────────────────────────────────────────────
# Tugma bosilganda bot qoidalarni o'zi hal qilmaydi — API'ga uzatadi.
# Shu sababli status, xabar va ruxsat mantiqi bitta joyda turadi.
API_BASE_URL = os.environ.get('ADMIN_PANEL_URL', '').replace('/admin', '').rstrip('/')     or os.environ.get('MINI_APP_URL', '').rstrip('/')
BOT_API_SECRET = os.environ.get('BOT_API_SECRET', '').strip()

# ─── Firebase ────────────────────────────────────────────────
# Service account JSON fayli (bot uchun). Yo'l ko'rsatilmasa, loyiha
# ildizidagi *-firebase-adminsdk-*.json fayli qidiriladi.
FIREBASE_KEY_FILE = os.environ.get('FIREBASE_KEY_FILE', '').strip()
FIREBASE_STORAGE_BUCKET = os.environ.get('FIREBASE_STORAGE_BUCKET', '').strip()


def find_service_account() -> str:
    """Service account JSON faylining yo'lini topadi."""
    if FIREBASE_KEY_FILE:
        candidate = Path(FIREBASE_KEY_FILE)
        if not candidate.is_absolute():
            candidate = ROOT_DIR / FIREBASE_KEY_FILE
        if candidate.exists():
            return str(candidate)
        raise RuntimeError(f"FIREBASE_KEY_FILE topilmadi: {candidate}")

    for directory in (ROOT_DIR, BASE_DIR):
        matches = sorted(directory.glob('*firebase-adminsdk*.json'))
        if matches:
            return str(matches[0])

    raise RuntimeError(
        "Firebase service account JSON fayli topilmadi. Uni loyiha ildiziga "
        "qo'ying yoki .env da FIREBASE_KEY_FILE yo'lini ko'rsating."
    )
