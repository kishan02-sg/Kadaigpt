import { useState, useEffect } from 'react'

/**
 * KadaiGPT Premium Loading Screen
 * Animated splash with branding, status messages, and progress
 */
export default function LoadingScreen({ status = 'loading', message = '' }) {
    const [dots, setDots] = useState('')
    const [tipIndex, setTipIndex] = useState(0)

    const tips = [
        'Connecting to your store...',
        'Loading your inventory...',
        'Preparing dashboard analytics...',
        'Setting up voice commands...',
        'KadaiGPT is almost ready!',
    ]

    useEffect(() => {
        const dotTimer = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.')
        }, 400)

        const tipTimer = setInterval(() => {
            setTipIndex(prev => (prev + 1) % tips.length)
        }, 2500)

        return () => {
            clearInterval(dotTimer)
            clearInterval(tipTimer)
        }
    }, [])

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Animated background orbs */}
            <div style={{
                position: 'absolute',
                width: '400px',
                height: '400px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
                top: '-100px',
                right: '-100px',
                animation: 'float 6s ease-in-out infinite',
            }} />
            <div style={{
                position: 'absolute',
                width: '300px',
                height: '300px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(249, 115, 22, 0.1) 0%, transparent 70%)',
                bottom: '-50px',
                left: '-50px',
                animation: 'float 8s ease-in-out infinite reverse',
            }} />

            {/* Logo */}
            <div style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                marginBottom: '24px',
                boxShadow: '0 20px 50px rgba(249, 115, 22, 0.3)',
                animation: 'pulse 2s ease-in-out infinite',
            }}>
                🛒
            </div>

            {/* Brand */}
            <h1 style={{
                fontSize: '2rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #f97316, #fb923c)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '4px',
            }}>
                KadaiGPT
            </h1>

            <p style={{
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '0.875rem',
                marginBottom: '32px',
                fontStyle: 'italic',
            }}>
                கடை சிறியது, கனவுகள் பெரியது
            </p>

            {/* Loading spinner */}
            <div style={{
                width: '48px',
                height: '48px',
                border: '3px solid rgba(255, 255, 255, 0.1)',
                borderTop: '3px solid #f97316',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                marginBottom: '24px',
            }} />

            {/* Status message */}
            <p style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '0.875rem',
                minHeight: '20px',
                transition: 'opacity 0.3s ease',
            }}>
                {message || tips[tipIndex]}{dots}
            </p>

            {/* Progress bar */}
            <div style={{
                width: '200px',
                height: '3px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                marginTop: '16px',
                overflow: 'hidden',
            }}>
                <div style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #f97316, #6366f1)',
                    borderRadius: '10px',
                    animation: 'progressIndeterminate 1.5s ease-in-out infinite',
                }} />
            </div>

            <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(20px, -20px); }
        }
        @keyframes progressIndeterminate {
          0% { width: 0%; margin-left: 0; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
        </div>
    )
}
