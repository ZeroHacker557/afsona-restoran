// Test yugurtgichi uchun: `.js` → `.ts` moslashtiruvchini ro'yxatdan o'tkazadi
import { register } from 'node:module'
register('./ts-resolver.mjs', import.meta.url)
