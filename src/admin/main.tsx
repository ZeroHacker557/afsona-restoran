import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles.css'
import './admin.css'
import AdminApp from './AdminApp'
import { applyTheme, getStoredTheme } from '../utils/theme'

// Tema birinchi bo'yoqdan oldin qo'llanadi — chaqnash bo'lmaydi
applyTheme(getStoredTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
)
