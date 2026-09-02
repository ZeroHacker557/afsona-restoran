import { useMemo, useRef, useState } from 'react'
import {
  GripVertical,
  ImagePlus,
  Percent,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { useAdminData } from '../lib/data-context'
import {
  createProduct,
  deleteProduct,
  deleteProducts,
  orphanImages,
  saveProductOrder,
  shiftPrices,
  updateProduct,
  type AdminProduct,
} from '../lib/db'
import { removeUploaded, uploadProductImage } from '../lib/upload'
import { Modal } from '../components/Modal'
import { CardsSkeleton, Chip, ConfirmBar, Empty, Field, Spinner, Switch } from '../components/ui'
import { toast, toastError } from '../lib/toast'
import { money } from '../lib/format'

export function ProductsPage() {
  const { products, categories, loaded } = useAdminData()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [editing, setEditing] = useState<AdminProduct | 'new' | null>(null)
  const [selection, setSelection] = useState<string[]>([])
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [busy, setBusy] = useState(false)

  /** Sudralayotgan taom. */
  const [dragId, setDragId] = useState<string | null>(null)
  /** Ustiga tashlanmoqchi bo'lgan taom — chiziq shu yerda ko'rinadi. */
  const [overId, setOverId] = useState<string | null>(null)
  /**
   * Saqlash javobini kutayotgan tartib. Firestore yangilanishi kelgunicha
   * kartalar sakrab qolmasligi uchun mahalliy tartibni ishlatamiz.
   */
  const [localOrder, setLocalOrder] = useState<string[] | null>(null)

  /** To'liq ro'yxat — sudrab qo'yilgan tartib bilan. */
  const ordered = useMemo(() => {
    if (!localOrder) return products
    const rank = new Map(localOrder.map((id, index) => [id, index]))
    return [...products].sort(
      (a, b) =>
        (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    )
  }, [products, localOrder])

  /**
   * Taomni boshqasining o'rniga qo'yish.
   *
   * Tartib butun ro'yxat bo'yicha hisoblanadi — kategoriya yoki qidiruv
   * bilan filtrlangan bo'lsa ham, "A ni B turgan joyga qo'y" degani
   * to'liq ro'yxatdagi haqiqiy o'rin bilan bir xil bo'ladi.
   */
  async function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return
    const ids = ordered.map((product) => product.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return

    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    setLocalOrder(ids)

    try {
      await saveProductOrder(ids)
      toast('Tartib saqlandi — ilovada ham shunday ko‘rinadi')
    } catch (error) {
      toastError(error)
      setLocalOrder(null)
    }
  }

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return ordered.filter((product) => {
      if (category !== 'all' && product.category !== category) return false
      if (!needle) return true
      return (
        product.name.toLowerCase().includes(needle) ||
        (product.description || '').toLowerCase().includes(needle)
      )
    })
  }, [ordered, search, category])

  const toggleSelect = (id: string) =>
    setSelection((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    )

  async function toggleAvailable(product: AdminProduct) {
    try {
      await updateProduct(product.id, { available: product.available === false })
      toast(product.available === false ? 'Taom sotuvga qaytdi' : 'Taom stop-listga qo‘shildi')
    } catch (error) {
      toastError(error)
    }
  }

  async function bulkDelete() {
    setBusy(true)
    try {
      // Faqat boshqa taom ishlatmayotgan rasmlar o'chiriladi
      await deleteProducts(selection, orphanImages(selection, products))
      toast(`${selection.length} ta taom o'chirildi`)
      setSelection([])
      setConfirmBulk(false)
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  async function bulkPrice(percent: number) {
    setBusy(true)
    try {
      await shiftPrices(selection, percent, products)
      toast(`Narx ${percent > 0 ? '+' : ''}${percent}% o'zgardi`)
      setSelection([])
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--faint)' }}
          />
          <input
            className="adm-input adm-input-search"
            placeholder="Taom qidirish"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          className="adm-select"
          style={{ width: 'auto' }}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="all">Barcha kategoriyalar</option>
          {categories.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>

        <button className="adm-btn primary" onClick={() => setEditing('new')}>
          <Plus size={17} />
          Taom qo'shish
        </button>
      </div>

      {selection.length > 0 && (
        <div className="adm-card flex flex-wrap items-center gap-2 p-3">
          <span className="text-sm font-bold">{selection.length} ta tanlandi</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button className="adm-btn sm" onClick={() => bulkPrice(10)} disabled={busy}>
              <Percent size={14} /> +10%
            </button>
            <button className="adm-btn sm" onClick={() => bulkPrice(-10)} disabled={busy}>
              <Percent size={14} /> −10%
            </button>
            <button className="adm-btn danger sm" onClick={() => setConfirmBulk(true)} disabled={busy}>
              <Trash2 size={14} /> O'chirish
            </button>
            <button className="adm-btn ghost sm" onClick={() => setSelection([])}>
              Bekor
            </button>
          </div>
          {confirmBulk && (
            <div className="w-full">
              <ConfirmBar
                text={`${selection.length} ta taom o'chiriladi.`}
                onCancel={() => setConfirmBulk(false)}
                onConfirm={bulkDelete}
                busy={busy}
              />
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="adm-card">
          {!loaded.products ? (
            <CardsSkeleton count={8} />
          ) : (
            <Empty text="Taom topilmadi" />
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((product) => (
            <div
              key={product.id}
              className={[
                'adm-card adm-clickable flex gap-3 p-3',
                dragId === product.id ? 'dragging' : '',
                overId === product.id && dragId !== product.id ? 'drop-here' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={product.available === false ? { opacity: 0.62 } : undefined}
              onDragOver={(event) => {
                if (!dragId) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                setOverId(product.id)
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node)) return
                setOverId((current) => (current === product.id ? null : current))
              }}
              onDrop={(event) => {
                event.preventDefault()
                const id = product.id
                setOverId(null)
                setDragId(null)
                void dropOn(id)
              }}
            >
              {/*
                 Sudrash faqat shu dastakdan boshlanadi — aks holda katta
                 ichidagi checkbox va tugmalarni bosish qiyinlashadi.
              */}
              <span
                draggable
                className="adm-grip"
                title="Sudrab tartibni o'zgartiring"
                onDragStart={(event) => {
                  setDragId(product.id)
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', product.id)
                }}
                onDragEnd={() => {
                  setDragId(null)
                  setOverId(null)
                }}
              >
                <GripVertical size={15} />
              </span>

              <label className="flex items-start pt-1">
                <input
                  type="checkbox"
                  checked={selection.includes(product.id)}
                  onChange={() => toggleSelect(product.id)}
                />
              </label>

              {product.images[0] ? (
                <img className="adm-thumb" style={{ height: 62, width: 62 }} src={product.images[0]} alt="" />
              ) : (
                <span className="adm-thumb" style={{ height: 62, width: 62 }} />
              )}

              <div className="min-w-0 flex-1">
                <button className="block w-full text-left" onClick={() => setEditing(product)}>
                  <span className="block truncate font-bold">{product.name}</span>
                  <span className="block text-xs" style={{ color: 'var(--muted)' }}>
                    {product.category || 'Kategoriyasiz'}
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="font-extrabold">{money(product.price)}</span>
                    {!!product.oldPrice && (
                      <span className="text-xs line-through" style={{ color: 'var(--faint)' }}>
                        {money(product.oldPrice)}
                      </span>
                    )}
                  </span>
                </button>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    className="adm-btn sm"
                    onClick={() => toggleAvailable(product)}
                    style={
                      product.available === false
                        ? { background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'transparent' }
                        : undefined
                    }
                  >
                    {product.available === false ? 'Stop-listda' : 'Sotuvda'}
                  </button>
                  {typeof product.stock === 'number' && (
                    <Chip
                      color={product.stock > 0 ? 'var(--muted)' : 'var(--danger)'}
                      background={product.stock > 0 ? 'var(--surface-3)' : 'var(--danger-soft)'}
                    >
                      Qoldiq: {product.stock}
                    </Chip>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ProductModal
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

// ── Taom formasi ─────────────────────────────────────────────

type FormState = {
  name: string
  price: string
  oldPrice: string
  category: string
  description: string
  discount: string
  stock: string
  available: boolean
  images: string[]
}

function ProductModal({ product, onClose }: { product: AdminProduct | null; onClose: () => void }) {
  const { categories, products } = useAdminData()
  const fileInput = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormState>({
    name: product?.name || '',
    price: product ? String(product.price) : '',
    oldPrice: product?.oldPrice ? String(product.oldPrice) : '',
    category: product?.category || categories[0]?.name || '',
    description: product?.description || '',
    discount: product?.discount || '',
    stock: product?.stock == null ? '' : String(product.stock),
    available: product ? product.available !== false : true,
    images: product?.images || [],
  })
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }))

  async function pickImages(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try {
      const urls: string[] = []
      for (const file of Array.from(files).slice(0, 8)) {
        urls.push(await uploadProductImage(file))
      }
      set('images', [...form.images, ...urls])
      toast(`${urls.length} ta rasm yuklandi`)
    } catch (error) {
      toastError(error)
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function removeImage(url: string) {
    set('images', form.images.filter((item) => item !== url))
    // Faylni Storage'dan ham tozalaymiz — keraksiz joy egallamasin
    void removeUploaded(url)
  }

  function makeMain(url: string) {
    set('images', [url, ...form.images.filter((item) => item !== url)])
  }

  async function save() {
    const price = Number(form.price)
    if (!form.name.trim()) return toast('Nomni kiriting', 'error')
    if (!Number.isFinite(price) || price <= 0) return toast("Narx noto'g'ri", 'error')
    if (!form.category) return toast('Kategoriya tanlang', 'error')

    setBusy(true)
    try {
      const payload = {
        name: form.name.trim(),
        price: Math.round(price),
        oldPrice: form.oldPrice ? Math.round(Number(form.oldPrice)) : null,
        category: form.category,
        description: form.description.trim(),
        discount: form.discount.trim(),
        stock: form.stock === '' ? null : Math.max(Math.round(Number(form.stock)), 0),
        available: form.available,
        images: form.images,
      }

      if (product) {
        await updateProduct(product.id, payload)
        toast('Taom yangilandi')
      } else {
        await createProduct(payload)
        toast("Taom qo'shildi")
      }
      onClose()
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!product) return
    setBusy(true)
    try {
      // Faqat boshqa taom ishlatmayotgan rasmlar o'chiriladi
      await deleteProduct(product.id, orphanImages([product.id], products))
      toast("Taom o'chirildi")
      onClose()
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={product ? 'Taomni tahrirlash' : "Yangi taom qo'shish"}
      onClose={onClose}
      wide
      footer={
        <>
          {product && (
            <button
              className="adm-btn danger"
              style={{ marginRight: 'auto' }}
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
            >
              <Trash2 size={16} /> O'chirish
            </button>
          )}
          <button className="adm-btn" onClick={onClose} disabled={busy}>
            Bekor
          </button>
          <button className="adm-btn primary" onClick={save} disabled={busy || uploading}>
            {busy ? <Spinner /> : null}
            Saqlash
          </button>
        </>
      }
    >
      {confirmDelete && (
        <ConfirmBar
          text="Taom butunlay o'chiriladi."
          onCancel={() => setConfirmDelete(false)}
          onConfirm={remove}
          busy={busy}
        />
      )}

      {/* Rasmlar */}
      <div>
        <span className="adm-label">Rasmlar</span>
        <div className="flex flex-wrap gap-2">
          {form.images.map((url, index) => (
            <div key={url} className="relative">
              <img
                src={url}
                alt=""
                className="size-24 rounded-[var(--r-sm)] border object-cover"
                style={{ borderColor: index === 0 ? 'var(--brand)' : 'var(--line)' }}
              />
              <button
                className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full"
                style={{ background: 'var(--danger)', color: '#fff' }}
                onClick={() => removeImage(url)}
                title="O'chirish"
              >
                <X size={13} />
              </button>
              {index !== 0 && (
                <button
                  className="absolute bottom-1 left-1 grid size-6 place-items-center rounded-full"
                  style={{ background: 'var(--surface)', color: 'var(--brand)' }}
                  onClick={() => makeMain(url)}
                  title="Asosiy qilish"
                >
                  <Star size={13} />
                </button>
              )}
              {index === 0 && (
                <span
                  className="absolute bottom-1 left-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
                >
                  Asosiy
                </span>
              )}
            </div>
          ))}

          <button
            className="grid size-24 place-items-center rounded-[var(--r-sm)] border border-dashed"
            style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Spinner /> : <ImagePlus size={22} />}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => pickImages(event.target.files)}
          />
        </div>
        <p className="adm-hint">Birinchi rasm katalogda asosiy bo'lib ko'rinadi.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nomi">
          <input
            className="adm-input"
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder="Osh"
          />
        </Field>

        <Field label="Kategoriya">
          <select
            className="adm-select"
            value={form.category}
            onChange={(event) => set('category', event.target.value)}
          >
            <option value="">— tanlang —</option>
            {categories.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Narx (so'm)">
          <input
            className="adm-input"
            inputMode="numeric"
            value={form.price}
            onChange={(event) => set('price', event.target.value.replace(/\D/g, ''))}
            placeholder="35000"
          />
        </Field>

        <Field label="Eski narx" hint="Chegirmani ko'rsatish uchun, ixtiyoriy">
          <input
            className="adm-input"
            inputMode="numeric"
            value={form.oldPrice}
            onChange={(event) => set('oldPrice', event.target.value.replace(/\D/g, ''))}
          />
        </Field>

        <Field label="Chegirma yorlig'i" hint="Masalan: -20% yoki YANGI">
          <input
            className="adm-input"
            value={form.discount}
            onChange={(event) => set('discount', event.target.value)}
          />
        </Field>

        <Field label="Qoldiq" hint="Bo'sh qoldirilsa hisob yuritilmaydi">
          <input
            className="adm-input"
            inputMode="numeric"
            value={form.stock}
            onChange={(event) => set('stock', event.target.value.replace(/\D/g, ''))}
          />
        </Field>
      </div>

      <Field label="Tavsif">
        <textarea
          className="adm-textarea"
          value={form.description}
          onChange={(event) => set('description', event.target.value)}
          placeholder="Tarkibi, porsiya hajmi, tayyorlanish vaqti…"
        />
      </Field>

      <Switch
        checked={form.available}
        onChange={(value) => set('available', value)}
        label="Sotuvda"
        hint="O'chirilsa ilovada 'mavjud emas' bo'lib ko'rinadi va savatga qo'shilmaydi"
      />
    </Modal>
  )
}
