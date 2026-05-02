/**
 * CelebrationEngine — Psychological milestones for user engagement
 * Based on UX research: celebration moments build trust and retention
 * 
 * Milestones:
 * - First bill: Confetti + encouraging message
 * - 10th bill: Speed badge
 * - 50th bill: Pro status
 * - First offline bill: Trust reinforcement
 * - ₹1 lakh revenue: Golden celebration
 */

import { useState, useEffect, useCallback } from 'react'

const MILESTONES = {
    FIRST_BILL: { key: 'first_bill', emoji: '🎊', title: 'पहला बिल बन गया!', subtitle: 'First bill created!', message: 'देखा? इतना आसान है! (See? That easy!)', color: '#10b981' },
    TENTH_BILL: { key: 'tenth_bill', emoji: '🏅', title: '10 बिल पूरे!', subtitle: '10 bills completed!', message: 'आप तो एक्सपर्ट बन रहे हैं! (You\'re becoming an expert!)', color: '#f59e0b' },
    FIFTIETH_BILL: { key: 'fiftieth_bill', emoji: '⭐', title: '50 बिल — Pro Status!', subtitle: '50 bills — you\'re a pro!', message: 'अब तो आप प्रोफेशनल हो गए! (You\'re a professional now!)', color: '#8b5cf6' },
    FIRST_OFFLINE: { key: 'first_offline', emoji: '📡', title: 'ऑफ़लाइन भी चलता है!', subtitle: 'Works offline too!', message: 'इंटरनेट के बिना भी बिल बना! (Bill created without internet!)', color: '#3b82f6' },
    REVENUE_1L: { key: 'revenue_1l', emoji: '🥇', title: '₹1 लाख की बिक्री!', subtitle: '₹1 Lakh revenue milestone!', message: 'कड़ी मेहनत रंग ला रही है! (Hard work is paying off!)', color: '#eab308' },
    FIRST_WEEK: { key: 'first_week', emoji: '📊', title: 'पहला हफ्ता पूरा!', subtitle: 'First week completed!', message: 'आपकी पहली Weekly Report तैयार है! (Your first weekly report is ready!)', color: '#06b6d4' },
}

// Simple confetti particle system
function ConfettiCanvas({ active, color }) {
    const [particles, setParticles] = useState([])

    useEffect(() => {
        if (!active) return

        const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', color || '#10b981']
        const newParticles = Array.from({ length: 60 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: -10 - Math.random() * 20,
            size: 6 + Math.random() * 8,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            speedX: (Math.random() - 0.5) * 3,
            speedY: 1.5 + Math.random() * 3,
            rotSpeed: (Math.random() - 0.5) * 10,
            opacity: 1,
            shape: Math.random() > 0.5 ? 'square' : 'circle',
        }))
        setParticles(newParticles)

        const interval = setInterval(() => {
            setParticles(prev => {
                const updated = prev.map(p => ({
                    ...p,
                    x: p.x + p.speedX * 0.3,
                    y: p.y + p.speedY,
                    rotation: p.rotation + p.rotSpeed,
                    opacity: p.y > 80 ? Math.max(0, p.opacity - 0.03) : 1,
                })).filter(p => p.opacity > 0 && p.y < 110)
                if (updated.length === 0) clearInterval(interval)
                return updated
            })
        }, 30)

        return () => clearInterval(interval)
    }, [active, color])

    if (!active && particles.length === 0) return null

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: 10001, overflow: 'hidden'
        }}>
            {particles.map(p => (
                <div key={p.id} style={{
                    position: 'absolute',
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    width: p.size,
                    height: p.size,
                    backgroundColor: p.color,
                    borderRadius: p.shape === 'circle' ? '50%' : '2px',
                    transform: `rotate(${p.rotation}deg)`,
                    opacity: p.opacity,
                    transition: 'none',
                }} />
            ))}
        </div>
    )
}

// Sound effect (optional, degrades gracefully)
function playSuccessSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.connect(gain)
        gain.connect(audioCtx.destination)
        osc.frequency.value = 523.25 // C5
        gain.gain.value = 0.1
        osc.start()
        setTimeout(() => { osc.frequency.value = 659.25 }, 100) // E5
        setTimeout(() => { osc.frequency.value = 783.99 }, 200) // G5
        setTimeout(() => {
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5)
            setTimeout(() => osc.stop(), 500)
        }, 300)
    } catch (e) {
        // Audio not available — degrade gracefully
    }
}

export default function CelebrationEngine({ children }) {
    const [currentCelebration, setCurrentCelebration] = useState(null)
    const [showConfetti, setShowConfetti] = useState(false)

    const celebrate = useCallback((milestoneKey) => {
        const milestone = Object.values(MILESTONES).find(m => m.key === milestoneKey)
        if (!milestone) return

        // Check if already celebrated
        const celebrated = JSON.parse(localStorage.getItem('kadai_celebrations') || '{}')
        if (celebrated[milestoneKey]) return

        // Mark as celebrated
        celebrated[milestoneKey] = new Date().toISOString()
        localStorage.setItem('kadai_celebrations', JSON.stringify(celebrated))

        // Show celebration
        setCurrentCelebration(milestone)
        setShowConfetti(true)
        playSuccessSound()

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            setShowConfetti(false)
            setTimeout(() => setCurrentCelebration(null), 500)
        }, 5000)
    }, [])

    // Expose celebrate function globally
    useEffect(() => {
        window.__kadaiCelebrate = celebrate
        return () => { delete window.__kadaiCelebrate }
    }, [celebrate])

    // Track bill count milestones  
    useEffect(() => {
        const checkMilestones = () => {
            const billCount = parseInt(localStorage.getItem('kadai_bill_count') || '0')
            const isOffline = !navigator.onLine
            const celebrated = JSON.parse(localStorage.getItem('kadai_celebrations') || '{}')

            if (billCount >= 1 && !celebrated.first_bill) celebrate('first_bill')
            else if (billCount >= 10 && !celebrated.tenth_bill) celebrate('tenth_bill')
            else if (billCount >= 50 && !celebrated.fiftieth_bill) celebrate('fiftieth_bill')
        }

        // Listen for bill creation events
        const handler = () => {
            const count = parseInt(localStorage.getItem('kadai_bill_count') || '0') + 1
            localStorage.setItem('kadai_bill_count', count.toString())
            setTimeout(checkMilestones, 500)
        }

        window.addEventListener('kadai:bill_created', handler)
        return () => window.removeEventListener('kadai:bill_created', handler)
    }, [celebrate])

    const dismiss = () => {
        setShowConfetti(false)
        setTimeout(() => setCurrentCelebration(null), 300)
    }

    return (
        <>
            {children}

            <ConfettiCanvas active={showConfetti} color={currentCelebration?.color} />

            {currentCelebration && (
                <div
                    className="celebration-modal"
                    onClick={dismiss}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000,
                        animation: 'fadeIn 0.3s ease',
                        cursor: 'pointer',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'white', borderRadius: '20px', padding: '40px 32px',
                            textAlign: 'center', maxWidth: '340px', width: '90%',
                            boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                            animation: 'bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        }}
                    >
                        <div style={{ fontSize: '64px', marginBottom: '16px', lineHeight: 1 }}>
                            {currentCelebration.emoji}
                        </div>
                        <h2 style={{
                            fontSize: '22px', fontWeight: 800, color: '#1a1a2e',
                            margin: '0 0 4px 0', lineHeight: 1.3,
                        }}>
                            {currentCelebration.title}
                        </h2>
                        <p style={{
                            fontSize: '14px', color: '#64748b', margin: '0 0 12px 0',
                            fontWeight: 500,
                        }}>
                            {currentCelebration.subtitle}
                        </p>
                        <p style={{
                            fontSize: '16px', color: currentCelebration.color,
                            fontWeight: 600, margin: '0 0 24px 0',
                        }}>
                            {currentCelebration.message}
                        </p>
                        <button
                            onClick={dismiss}
                            style={{
                                background: currentCelebration.color, color: 'white',
                                border: 'none', borderRadius: '12px', padding: '14px 28px',
                                fontSize: '16px', fontWeight: 700, cursor: 'pointer',
                                minHeight: '48px', minWidth: '160px',
                            }}
                        >
                            बहुत बढ़िया! ✨
                        </button>
                    </div>
                </div>
            )}

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
        </>
    )
}

// Helper to trigger celebration from anywhere
export function triggerCelebration(milestone) {
    if (window.__kadaiCelebrate) {
        window.__kadaiCelebrate(milestone)
    }
}

// Helper to track bill creation
export function trackBillCreated() {
    window.dispatchEvent(new Event('kadai:bill_created'))
}
