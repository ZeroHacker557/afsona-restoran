import { useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAdminData } from '../lib/data-context'
import {
  createCategory,
  deleteCategory,
  renameCategory,
  saveCategoryOrder,
  updateCategory,
  type AdminCategory,
} from '../lib/db'
import { CATEGORY_ICON_LIST, categoryIcon } from '../../utils/category-icons'
import { Modal } from '../components/Modal'
import { ConfirmBar, Empty, Field, Spinner } from '../components/ui'
import { toast, toastError } from '../lib/toast'

export function CategoriesPage() {
  const { categories, products } = useAdminData()
  const [editing, setEditing] = useState<AdminCategory | 'new' | null>(null)
  const [removing, setRemoving] = useState<AdminCategory | null>(null)
  const [busy, setBusy] = useState(false)

  const count = (name: string) => products.filter((product) => product.category === name).length

  async function move(index: number, direction: -1 | 1) {
    const next = [...categories]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    try {
      await saveCategoryOrder(next.map((item) => item.id))
    } catch (error) {
      toastError(error)
    }
  }

  async function remove() {
    if (!removing) return
    setBusy(true)
    try {
      await deleteCategory(removing.id)
      toast("Kategoriya o'chirildi")
      setRemoving(null)
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Kategoriyalar ilovada shu tartibda ko'rinadi.
        </p>
        <button className="adm-btn primary" onClick={() => setEditing('new')}>
          <Plus size={17} />
          Kategoriya qo'shish
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="adm-card">
          <Empty text="Hali kategoriya yo'q" />
        </div>
      ) : (
        <div className="adm-card adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Tartib</th>
                <th>Nomi</th>
                <th>Taomlar</th>
                <th style={{ width: 110 }} />
              </tr>
            </thead>
            <tbody>
              {categories.map((category, index) => {
                const Icon = categoryIcon(category.icon)
                const total = count(category.name)
                return (
                  <tr key={category.id}>
                    <td>
                      <div className="flex gap-1">
                        <button
                          className="adm-icon-btn"
                          style={{ height: 26, width: 26 }}
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          className="adm-icon-btn"
                          style={{ height: 26, width: 26 }}
                          onClick={() => move(index, 1)}
                          disabled={index === categories.length - 1}
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <span
                          className="grid size-9 place-items-center rounded-[10px]"
                          style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
                        >
                          <Icon size={18} />
                        </span>
                        <span className="font-bold">{category.name}</span>
                      </div>
                    </td>
                    <td style={{ color: total ? 'var(--ink-2)' : 'var(--faint)' }}>{total} ta</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button className="adm-icon-btn" onClick={() => setEditing(category)}>
                          <Pencil size={16} />
                        </button>
                        <button
                          className="adm-icon-btn"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => setRemoving(category)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {removing && (
        <Modal title="Kategoriyani o'chirish" onClose={() => setRemoving(null)}>
          {count(removing.name) > 0 && (
            <p
              className="rounded-[10px] px-3 py-2 text-sm font-semibold"
              style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}
            >
              Diqqat: bu kategoriyada {count(removing.name)} ta taom bor. Ular o'chmaydi, lekin
              kategoriyasiz qoladi va katalogda ko'rinmay qolishi mumkin.
            </p>
          )}
          <ConfirmBar
            text={`"${removing.name}" o'chiriladi.`}
            onCancel={() => setRemoving(null)}
            onConfirm={remove}
            busy={busy}
          />
        </Modal>
      )}

      {editing && (
        <CategoryModal
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function CategoryModal({ category, onClose }: { category: AdminCategory | null; onClose: () => void }) {
  const [name, setName] = useState(category?.name || '')
  const [icon, setIcon] = useState(category?.icon || 'utensils')
  const [busy, setBusy] = useState(false)

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) return toast('Nomni kiriting', 'error')

    setBusy(true)
    try {
      if (!category) {
        await createCategory(trimmed, icon)
        toast("Kategoriya qo'shildi")
      } else {
        if (trimmed !== category.name) {
          const moved = await renameCategory(category.id, category.name, trimmed)
          toast(moved ? `Nom o'zgardi, ${moved} ta taom yangilandi` : "Nom o'zgardi")
        }
        if (icon !== category.icon) await updateCategory(category.id, { icon })
      }
      onClose()
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={category ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya'}
      onClose={onClose}
      footer={
        <>
          <button className="adm-btn" onClick={onClose} disabled={busy}>
            Bekor
          </button>
          <button className="adm-btn primary" onClick={save} disabled={busy}>
            {busy ? <Spinner /> : null}
            Saqlash
          </button>
        </>
      }
    >
      <Field label="Nomi" hint="Nom o'zgarsa, ichidagi taomlar avtomatik ko'chadi">
        <input
          className="adm-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Milliy taomlar"
          autoFocus
        />
      </Field>

      <div>
        <span className="adm-label">Ikonka</span>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_ICON_LIST.map((item) => {
            const Icon = categoryIcon(item.id)
            const active = icon === item.id
            return (
              <button
                key={item.id}
                className="grid size-12 place-items-center rounded-[var(--r-sm)] border"
                style={{
                  borderColor: active ? 'var(--brand)' : 'var(--line)',
                  background: active ? 'var(--brand-soft)' : 'var(--surface-2)',
                  color: active ? 'var(--brand)' : 'var(--muted)',
                }}
                onClick={() => setIcon(item.id)}
                title={item.label}
              >
                <Icon size={20} />
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
