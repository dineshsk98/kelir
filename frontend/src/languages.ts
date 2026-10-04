import { useEffect } from 'react'
import './languages.css'

/**
 * The languages a message can be written in (spec.md > Message languages and fonts).
 * Each sets the message's `lang` attribute and a handwritten font made for its script.
 * The codes match the API's list.
 */
export const MESSAGE_LANGS = [
  { code: 'en', name: 'English', htmlLang: 'en' },
  { code: 'ko', name: '한국어 · Korean', htmlLang: 'ko' },
  { code: 'zh', name: '中文 · Chinese', htmlLang: 'zh-Hans' },
  { code: 'ja', name: '日本語 · Japanese', htmlLang: 'ja' },
  { code: 'es', name: 'Español · Spanish', htmlLang: 'es' },
  { code: 'ta', name: 'தமிழ் · Tamil', htmlLang: 'ta' },
  { code: 'hi', name: 'हिन्दी · Hindi', htmlLang: 'hi' },
  { code: 'fr', name: 'Français · French', htmlLang: 'fr' },
  { code: 'it', name: 'Italiano · Italian', htmlLang: 'it' },
  { code: 'de', name: 'Deutsch · German', htmlLang: 'de' },
] as const

export type MessageLang = (typeof MESSAGE_LANGS)[number]['code']

/** The message box's hint in each language, so the sender sees the script's font right away */
export const MESSAGE_PLACEHOLDER: Record<MessageLang, (name: string) => string> = {
  en: (n) => `Happy birthday, ${n}!`,
  ko: (n) => `${n}, 생일 축하해!`,
  zh: (n) => `${n}，生日快乐！`,
  ja: (n) => `${n}、お誕生日おめでとう！`,
  es: (n) => `¡Feliz cumpleaños, ${n}!`,
  ta: (n) => `இனிய பிறந்தநாள் வாழ்த்துகள், ${n}!`,
  hi: (n) => `जन्मदिन मुबारक हो, ${n}!`,
  fr: (n) => `Joyeux anniversaire, ${n} !`,
  it: (n) => `Buon compleanno, ${n}!`,
  de: (n) => `Alles Gute zum Geburtstag, ${n}!`,
}

/** The email's subject line, for the editor's Preview. The same words as the API's
 *  backend/app/delivery/email_copy.py, which is what is actually sent. */
export const EMAIL_SUBJECT: Record<MessageLang, (sender: string) => string> = {
  en: (s) => `${s} has sent you a surprise for your special day.`,
  ko: (s) => `${s}님이 특별한 날을 위한 깜짝 선물을 보냈어요.`,
  zh: (s) => `${s} 为你的特别日子送来了一份惊喜。`,
  ja: (s) => `${s}さんから、特別な日のためのサプライズが届きました。`,
  es: (s) => `${s} te ha enviado una sorpresa para tu día especial.`,
  ta: (s) => `${s} உங்கள் சிறப்பு நாளுக்காக ஒரு ஆச்சரியத்தை அனுப்பியுள்ளார்.`,
  hi: (s) => `${s} ने आपके ख़ास दिन के लिए एक सरप्राइज़ भेजा है।`,
  fr: (s) => `${s} t’a envoyé une surprise pour ton jour spécial.`,
  it: (s) => `${s} ti ha mandato una sorpresa per il tuo giorno speciale.`,
  de: (s) => `${s} hat dir eine Überraschung für deinen besonderen Tag geschickt.`,
}

// The scripts' fonts load only when a message in that language is shown: together the
// Korean, Chinese and Japanese ones are about 260 KB of CSS. Each is split by Unicode
// range, so the browser then downloads only the characters the message uses.
// Latin languages use Caveat, which the app always loads.
const FONT_CSS: Partial<Record<MessageLang, () => Promise<unknown>>> = {
  ko: () => import('@fontsource/nanum-pen-script/400.css'),
  zh: () => import('@fontsource/ma-shan-zheng/400.css'),
  ja: () => import('@fontsource/yomogi/400.css'),
  ta: () => import('@fontsource/kavivanar/400.css'),
  hi: () => import('@fontsource/kalam/400.css'),
}

const known = (lang: string | undefined): MessageLang =>
  MESSAGE_LANGS.some((l) => l.code === lang) ? (lang as MessageLang) : 'en'

/** Loads the language's font (once) and returns the attributes for the message element */
export function useMessageLang(lang: string | undefined) {
  const code = known(lang)
  useEffect(() => {
    FONT_CSS[code]?.().catch(() => {}) // without it the message falls back to Caveat
  }, [code])
  return messageLangProps(code)
}

/** `lang` (line breaking, screen-reader voice) and the hook for the script's font in CSS */
export function messageLangProps(lang: string | undefined) {
  const code = known(lang)
  const htmlLang = MESSAGE_LANGS.find((l) => l.code === code)!.htmlLang
  return { lang: htmlLang, 'data-msg-lang': code }
}
