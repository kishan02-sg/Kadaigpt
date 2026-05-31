import { createContext, useContext, useState, useEffect } from 'react'

// Create Language Context
const LanguageContext = createContext()

// Language options
export const languages = {
    en: {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        flag: '🇬🇧',
        speechLang: 'en-IN'
    },
    hi: {
        code: 'hi',
        name: 'Hindi',
        nativeName: 'हिंदी',
        flag: '🇮🇳',
        speechLang: 'hi-IN'
    },
    ta: {
        code: 'ta',
        name: 'Tamil',
        nativeName: 'தமிழ்',
        flag: '🇮🇳',
        speechLang: 'ta-IN'
    },
    te: {
        code: 'te',
        name: 'Telugu',
        nativeName: 'తెలుగు',
        flag: '🇮🇳',
        speechLang: 'te-IN'
    },
    kn: {
        code: 'kn',
        name: 'Kannada',
        nativeName: 'ಕನ್ನಡ',
        flag: '🇮🇳',
        speechLang: 'kn-IN'
    },
    ml: {
        code: 'ml',
        name: 'Malayalam',
        nativeName: 'മലയാളം',
        flag: '🇮🇳',
        speechLang: 'ml-IN'
    }
}

// Common translations across the app
export const commonTranslations = {
    en: {
        // Navigation
        dashboard: "Dashboard",
        billing: "Billing",
        products: "Products",
        customers: "Customers",
        analytics: "Analytics",
        settings: "Settings",

        // Common Actions
        save: "Save",
        cancel: "Cancel",
        delete: "Delete",
        edit: "Edit",
        add: "Add",
        update: "Update",
        search: "Search",
        filter: "Filter",
        export: "Export",
        import: "Import",
        refresh: "Refresh",
        submit: "Submit",
        close: "Close",

        // Common Labels
        name: "Name",
        price: "Price",
        quantity: "Quantity",
        total: "Total",
        date: "Date",
        time: "Time",
        status: "Status",
        actions: "Actions",
        category: "Category",
        description: "Description",

        // Messages
        success: "Success!",
        error: "Error!",
        warning: "Warning!",
        info: "Info",
        loading: "Loading...",
        noData: "No data available",
        confirmDelete: "Are you sure you want to delete?",

        // AI Agent
        aiAssistant: "AI Assistant",
        askAnything: "Ask anything...",
        voiceCommand: "Voice Command",
        processing: "Processing...",

        // Common Units
        kg: "kg",
        ltr: "L",
        pcs: "pcs",
        dozen: "dozen"
    },
    hi: {
        // Navigation
        dashboard: "डैशबोर्ड",
        billing: "बिलिंग",
        products: "प्रोडक्ट्स",
        customers: "ग्राहक",
        analytics: "एनालिटिक्स",
        settings: "सेटिंग्स",

        // Common Actions
        save: "सेव करें",
        cancel: "रद्द करें",
        delete: "हटाएं",
        edit: "संपादित करें",
        add: "जोड़ें",
        update: "अपडेट करें",
        search: "खोजें",
        filter: "फ़िल्टर",
        export: "निर्यात",
        import: "आयात",
        refresh: "रिफ्रेश",
        submit: "सबमिट करें",
        close: "बंद करें",

        // Common Labels
        name: "नाम",
        price: "कीमत",
        quantity: "मात्रा",
        total: "कुल",
        date: "तारीख",
        time: "समय",
        status: "स्थिति",
        actions: "कार्रवाई",
        category: "श्रेणी",
        description: "विवरण",

        // Messages
        success: "सफल!",
        error: "त्रुटि!",
        warning: "चेतावनी!",
        info: "जानकारी",
        loading: "लोड हो रहा है...",
        noData: "कोई डेटा उपलब्ध नहीं",
        confirmDelete: "क्या आप वाकई हटाना चाहते हैं?",

        // AI Agent
        aiAssistant: "AI सहायक",
        askAnything: "कुछ भी पूछें...",
        voiceCommand: "वॉइस कमांड",
        processing: "प्रोसेसिंग...",

        // Common Units
        kg: "किलो",
        ltr: "लीटर",
        pcs: "पीस",
        dozen: "दर्जन"
    },
    ta: {
        // Navigation
        dashboard: "டாஷ்போர்ட்",
        billing: "பில்லிங்",
        products: "பொருட்கள்",
        customers: "வாடிக்கையாளர்கள்",
        analytics: "பகுப்பாய்வு",
        settings: "அமைப்புகள்",

        // Common Actions
        save: "சேமி",
        cancel: "ரத்து",
        delete: "நீக்கு",
        edit: "திருத்து",
        add: "சேர்",
        update: "புதுப்பி",
        search: "தேடு",
        filter: "வடிகட்டு",
        export: "ஏற்றுமதி",
        import: "இறக்குமதி",
        refresh: "புதுப்பி",
        submit: "சமர்ப்பி",
        close: "மூடு",

        // Common Labels
        name: "பெயர்",
        price: "விலை",
        quantity: "அளவு",
        total: "மொத்தம்",
        date: "தேதி",
        time: "நேரம்",
        status: "நிலை",
        actions: "செயல்கள்",
        category: "வகை",
        description: "விளக்கம்",

        // Messages
        success: "வெற்றி!",
        error: "பிழை!",
        warning: "எச்சரிக்கை!",
        info: "தகவல்",
        loading: "ஏற்றுகிறது...",
        noData: "தரவு இல்லை",
        confirmDelete: "நிச்சயமாக நீக்க விரும்புகிறீர்களா?",

        // AI Agent
        aiAssistant: "AI உதவியாளர்",
        askAnything: "எதையும் கேளுங்கள்...",
        voiceCommand: "குரல் கட்டளை",
        processing: "செயலாக்கம்...",

        // Common Units
        kg: "கிலோ",
        ltr: "லிட்டர்",
        pcs: "துண்டு",
        dozen: "டஜன்"
    },
    te: {
        // Navigation
        dashboard: "డాష్‌బోర్డ్",
        billing: "బిల్లింగ్",
        products: "ఉత్పత్తులు",
        customers: "కస్టమర్లు",
        analytics: "విశ్లేషణ",
        settings: "సెట్టింగ్‌లు",

        // Common Actions
        save: "సేవ్ చేయండి",
        cancel: "రద్దు చేయండి",
        delete: "తొలగించు",
        edit: "సవరించు",
        add: "జోడించు",
        update: "అప్‌డేట్ చేయండి",
        search: "వెతకండి",
        filter: "ఫిల్టర్",
        export: "ఎగుమతి",
        import: "దిగుమతి",
        refresh: "రిఫ్రెష్",
        submit: "సమర్పించు",
        close: "మూసివేయి",

        // Common Labels
        name: "పేరు",
        price: "ధర",
        quantity: "పరిమాణం",
        total: "మొత్తం",
        date: "తేదీ",
        time: "సమయం",
        status: "స్థితి",
        actions: "చర్యలు",
        category: "వర్గం",
        description: "వివరణ",

        // Messages
        success: "విజయం!",
        error: "లోపం!",
        warning: "హెచ్చరిక!",
        info: "సమాచారం",
        loading: "లోడ్ అవుతోంది...",
        noData: "డేటా అందుబాటులో లేదు",
        confirmDelete: "మీరు ఖచ్చితంగా తొలగించాలనుకుంటున్నారా?",

        // AI Agent
        aiAssistant: "AI సహాయకుడు",
        askAnything: "ఏదైనా అడగండి...",
        voiceCommand: "వాయిస్ కమాండ్",
        processing: "ప్రాసెస్ అవుతోంది...",

        // Common Units
        kg: "కిలో",
        ltr: "లీటర్",
        pcs: "ముక్కలు",
        dozen: "డజన్"
    },
    kn: {
        // Navigation
        dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
        billing: "ಬಿಲ್ಲಿಂಗ್",
        products: "ಉತ್ಪನ್ನಗಳು",
        customers: "ಗ್ರಾಹಕರು",
        analytics: "ವಿಶ್ಲೇಷಣೆ",
        settings: "ಸೆಟ್ಟಿಂಗ್‌ಗಳು",

        // Common Actions
        save: "ಉಳಿಸಿ",
        cancel: "ರದ್ದುಮಾಡಿ",
        delete: "ಅಳಿಸಿ",
        edit: "ಸಂಪಾದಿಸಿ",
        add: "ಸೇರಿಸಿ",
        update: "ಅಪ್‌ಡೇಟ್ ಮಾಡಿ",
        search: "ಹುಡುಕಿ",
        filter: "ಫಿಲ್ಟರ್",
        export: "ರಫ್ತು",
        import: "ಆಮದು",
        refresh: "ರಿಫ್ರೆಶ್",
        submit: "ಸಲ್ಲಿಸಿ",
        close: "ಮುಚ್ಚಿ",

        // Common Labels
        name: "ಹೆಸರು",
        price: "ಬೆಲೆ",
        quantity: "ಪ್ರಮಾಣ",
        total: "ಒಟ್ಟು",
        date: "ದಿನಾಂಕ",
        time: "ಸಮಯ",
        status: "ಸ್ಥಿತಿ",
        actions: "ಕ್ರಿಯೆಗಳು",
        category: "ವರ್ಗ",
        description: "ವಿವರಣೆ",

        // Messages
        success: "ಯಶಸ್ಸು!",
        error: "ದೋಷ!",
        warning: "ಎಚ್ಚರಿಕೆ!",
        info: "ಮಾಹಿತಿ",
        loading: "ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
        noData: "ಡೇಟಾ ಲಭ್ಯವಿಲ್ಲ",
        confirmDelete: "ನೀವು ಖಚಿತವಾಗಿ ಅಳಿಸಲು ಬಯಸುತ್ತೀರಾ?",

        // AI Agent
        aiAssistant: "AI ಸಹಾಯಕ",
        askAnything: "ಏನಾದರೂ ಕೇಳಿ...",
        voiceCommand: "ಧ್ವನಿ ಆಜ್ಞೆ",
        processing: "ಪ್ರಕ್ರಿಯೆ ನಡೆಯುತ್ತಿದೆ...",

        // Common Units
        kg: "ಕೆಜಿ",
        ltr: "ಲೀಟರ್",
        pcs: "ತುಂಡುಗಳು",
        dozen: "ಡಜನ್"
    },
    ml: {
        // Navigation
        dashboard: "ഡാഷ്‌ബോർഡ്",
        billing: "ബില്ലിംഗ്",
        products: "ഉൽപ്പന്നങ്ങൾ",
        customers: "ഉപഭോക്താക്കൾ",
        analytics: "അനലിറ്റിക്സ്",
        settings: "സെറ്റിംഗ്സ്",

        // Common Actions
        save: "സേവ് ചെയ്യുക",
        cancel: "റദ്ദാക്കുക",
        delete: "ഇല്ലാതാക്കുക",
        edit: "എഡിറ്റ് ചെയ്യുക",
        add: "ചേർക്കുക",
        update: "അപ്ഡേറ്റ് ചെയ്യുക",
        search: "തിരയുക",
        filter: "ഫിൽട്ടർ",
        export: "എക്സ്പോർട്ട്",
        import: "ഇംപോർട്ട്",
        refresh: "റിഫ്രഷ്",
        submit: "സമർപ്പിക്കുക",
        close: "അടയ്ക്കുക",

        // Common Labels
        name: "പേര്",
        price: "വില",
        quantity: "അളവ്",
        total: "ആകെ",
        date: "തീയതി",
        time: "സമയം",
        status: "നില",
        actions: "പ്രവർത്തനങ്ങൾ",
        category: "വിഭാഗം",
        description: "വിവരണം",

        // Messages
        success: "വിജയം!",
        error: "പിശക്!",
        warning: "മുന്നറിയിപ്പ്!",
        info: "വിവരം",
        loading: "ലോഡ് ചെയ്യുന്നു...",
        noData: "ഡാറ്റ ലഭ്യമല്ല",
        confirmDelete: "ഇല്ലാതാക്കണമെന്ന് ഉറപ്പാണോ?",

        // AI Agent
        aiAssistant: "AI സഹായി",
        askAnything: "എന്തും ചോദിക്കൂ...",
        voiceCommand: "വോയ്സ് കമാൻഡ്",
        processing: "പ്രോസസ്സ് ചെയ്യുന്നു...",

        // Common Units
        kg: "കിലോ",
        ltr: "ലിറ്റർ",
        pcs: "എണ്ണം",
        dozen: "ഡസൻ"
    }
}

// Language Provider Component
export function LanguageProvider({ children }) {
    const [language, setLanguage] = useState(() => {
        // Check localStorage for saved preference
        const saved = localStorage.getItem('kadai_language')
        return saved || 'en'
    })

    useEffect(() => {
        // Save to localStorage when language changes
        localStorage.setItem('kadai_language', language)

        // Update document lang attribute
        document.documentElement.lang = language
    }, [language])

    // Get translation helper
    const t = (key) => {
        const keys = key.split('.')
        let translation = commonTranslations[language]

        for (const k of keys) {
            if (translation && translation[k]) {
                translation = translation[k]
            } else {
                // Fallback to English
                translation = commonTranslations.en
                for (const fallbackKey of keys) {
                    if (translation && translation[fallbackKey]) {
                        translation = translation[fallbackKey]
                    } else {
                        return key // Return key if no translation found
                    }
                }
                break
            }
        }

        return translation
    }

    const value = {
        language,
        setLanguage,
        t,
        languageInfo: languages[language],
        availableLanguages: Object.values(languages),
        speechLang: languages[language]?.speechLang || 'en-IN'
    }

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    )
}

// Custom hook to use language
export function useLanguage() {
    const context = useContext(LanguageContext)
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider')
    }
    return context
}

// Language Selector Component
export function LanguageSelector({ compact = false }) {
    const { language, setLanguage, availableLanguages } = useLanguage()
    const [isOpen, setIsOpen] = useState(false)

    const currentLang = languages[language]

    return (
        <div className="language-selector" style={{ position: 'relative' }}>
            <button
                className="lang-trigger"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: compact ? '6px 10px' : '8px 14px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: compact ? '8px' : '10px',
                    cursor: 'pointer',
                    fontSize: compact ? '0.75rem' : '0.85rem',
                    color: 'var(--text-primary)'
                }}
            >
                <span>{currentLang?.flag}</span>
                {!compact && <span>{currentLang?.nativeName}</span>}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ opacity: 0.6 }}>
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
            </button>

            {isOpen && (
                <>
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 99
                        }}
                        onClick={() => setIsOpen(false)}
                    />
                    <div
                        className="lang-dropdown"
                        style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '4px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '10px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                            overflow: 'hidden',
                            minWidth: '160px',
                            zIndex: 100
                        }}
                    >
                        {availableLanguages.map(lang => (
                            <button
                                key={lang.code}
                                onClick={() => {
                                    setLanguage(lang.code)
                                    setIsOpen(false)
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '12px 16px',
                                    background: language === lang.code ? 'var(--bg-secondary)' : 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-primary)',
                                    textAlign: 'left'
                                }}
                            >
                                <span>{lang.flag}</span>
                                <span>{lang.nativeName}</span>
                                {language === lang.code && (
                                    <span style={{ marginLeft: 'auto', color: 'var(--primary-500)' }}>✓</span>
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

export default LanguageContext
