// Theme Context for Dark/Light Mode
import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('kadai_theme')
        return saved || 'dark'
    })

    useEffect(() => {
        // Apply theme to document
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('kadai_theme', theme)

        // Update meta theme-color
        const metaTheme = document.querySelector('meta[name="theme-color"]')
        if (metaTheme) {
            metaTheme.content = theme === 'dark' ? '#0a0a0a' : '#ffffff'
        }
    }, [theme])

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark')
    }

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}

export default ThemeContext
