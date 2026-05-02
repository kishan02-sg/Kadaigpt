/**
 * KadaiGPT - i18n Configuration
 * Multi-language support for 6 Indian languages
 * 
 * Supported: English, Tamil, Hindi, Telugu, Kannada, Malayalam
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import ta from './locales/ta.json'
import hi from './locales/hi.json'
import te from './locales/te.json'
import kn from './locales/kn.json'
import ml from './locales/ml.json'

// Language metadata for UI display
export const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', speechCode: 'en-IN' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', speechCode: 'ta-IN' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', speechCode: 'hi-IN' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳', speechCode: 'te-IN' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳', speechCode: 'kn-IN' },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳', speechCode: 'ml-IN' },
]

// Get speech recognition code for current language
export function getSpeechCode(langCode) {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === langCode)
    return lang ? lang.speechCode : 'en-IN'
}

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            ta: { translation: ta },
            hi: { translation: hi },
            te: { translation: te },
            kn: { translation: kn },
            ml: { translation: ml },
        },
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // React already escapes
        },
        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'kadaigpt_language',
            caches: ['localStorage'],
        },
    })

export default i18n
