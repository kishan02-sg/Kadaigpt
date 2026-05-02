/**
 * KadaiGPT - Language Switcher Component
 * Allows users to switch between 6 Indian languages
 * Persists choice to localStorage via i18next
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '../i18n'
import { Globe, Check, ChevronDown } from 'lucide-react'

export default function LanguageSwitcher({ compact = false }) {
    const { i18n } = useTranslation()
    const [isOpen, setIsOpen] = useState(false)

    const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) || SUPPORTED_LANGUAGES[0]

    const handleChangeLanguage = (langCode) => {
        i18n.changeLanguage(langCode)
        localStorage.setItem('kadaigpt_language', langCode)
        setIsOpen(false)
    }

    return (
        <div className="language-switcher" style={{ position: 'relative' }}>
            <button
                className="language-trigger"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: compact ? '6px 10px' : '10px 16px',
                    background: 'var(--bg-card, #1e1e2e)',
                    border: '1px solid var(--border-color, #333)',
                    borderRadius: '10px', cursor: 'pointer',
                    color: 'var(--text-primary, #fff)',
                    fontSize: compact ? '13px' : '14px',
                    transition: 'all 0.2s ease',
                }}
            >
                <Globe size={compact ? 14 : 16} />
                <span>{currentLang.flag} {compact ? currentLang.code.toUpperCase() : currentLang.nativeName}</span>
                <ChevronDown size={12} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
            </button>

            {isOpen && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                        onClick={() => setIsOpen(false)}
                    />
                    <div
                        className="language-dropdown"
                        style={{
                            position: 'absolute', top: '100%', right: 0,
                            marginTop: '4px', minWidth: '200px', zIndex: 999,
                            background: 'var(--bg-card, #1e1e2e)',
                            border: '1px solid var(--border-color, #333)',
                            borderRadius: '12px', overflow: 'hidden',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                            animation: 'fadeInUp 0.2s ease',
                        }}
                    >
                        {SUPPORTED_LANGUAGES.map(lang => (
                            <button
                                key={lang.code}
                                onClick={() => handleChangeLanguage(lang.code)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    width: '100%', padding: '10px 16px',
                                    background: lang.code === i18n.language ? 'var(--primary-500, #6366f1)15' : 'transparent',
                                    border: 'none', cursor: 'pointer',
                                    color: lang.code === i18n.language ? 'var(--primary-500, #6366f1)' : 'var(--text-primary, #fff)',
                                    fontSize: '14px', textAlign: 'left',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => e.target.style.background = 'var(--bg-hover, #ffffff10)'}
                                onMouseLeave={e => e.target.style.background = lang.code === i18n.language ? 'var(--primary-500, #6366f1)15' : 'transparent'}
                            >
                                <span style={{ fontSize: '18px' }}>{lang.flag}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500 }}>{lang.nativeName}</div>
                                    <div style={{ fontSize: '12px', opacity: 0.6 }}>{lang.name}</div>
                                </div>
                                {lang.code === i18n.language && <Check size={16} />}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
