import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight, X, Clock } from 'lucide-react'

// Multi-language support
const translations = {
    en: {
        today: "Today",
        yesterday: "Yesterday",
        last7Days: "Last 7 Days",
        last30Days: "Last 30 Days",
        thisMonth: "This Month",
        lastMonth: "Last Month",
        thisQuarter: "This Quarter",
        thisYear: "This Year",
        custom: "Custom Range",
        apply: "Apply",
        cancel: "Cancel",
        from: "From",
        to: "To",
        months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    },
    hi: {
        today: "आज",
        yesterday: "कल",
        last7Days: "पिछले 7 दिन",
        last30Days: "पिछले 30 दिन",
        thisMonth: "इस महीने",
        lastMonth: "पिछला महीना",
        thisQuarter: "इस तिमाही",
        thisYear: "इस साल",
        custom: "कस्टम रेंज",
        apply: "लागू करें",
        cancel: "रद्द करें",
        from: "से",
        to: "तक",
        months: ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"],
        shortMonths: ["जन", "फ़र", "मार्च", "अप्रै", "मई", "जून", "जुल", "अग", "सित", "अक्टू", "नव", "दिस"],
        days: ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"]
    },
    ta: {
        today: "இன்று",
        yesterday: "நேற்று",
        last7Days: "கடந்த 7 நாட்கள்",
        last30Days: "கடந்த 30 நாட்கள்",
        thisMonth: "இந்த மாதம்",
        lastMonth: "கடந்த மாதம்",
        thisQuarter: "இந்த காலாண்டு",
        thisYear: "இந்த ஆண்டு",
        custom: "தனிப்பயன்",
        apply: "பயன்படுத்து",
        cancel: "ரத்து",
        from: "இருந்து",
        to: "வரை",
        months: ["ஜனவரி", "பிப்ரவரி", "மார்ச்", "ஏப்ரல்", "மே", "ஜூன்", "ஜூலை", "ஆகஸ்ட்", "செப்டம்பர்", "அக்டோபர்", "நவம்பர்", "டிசம்பர்"],
        shortMonths: ["ஜன", "பிப்", "மார்", "ஏப்", "மே", "ஜூன்", "ஜூலை", "ஆக", "செப்", "அக்", "நவ", "டிச"],
        days: ["ஞா", "தி", "செ", "பு", "வி", "வெ", "ச"]
    }
}

// Quick presets that calculate date ranges
const getPresetRange = (preset) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const startOfDay = (date) => {
        const d = new Date(date)
        d.setHours(0, 0, 0, 0)
        return d
    }

    switch (preset) {
        case 'today':
            return { start: today, end: today }
        case 'yesterday': {
            const yesterday = new Date(today)
            yesterday.setDate(yesterday.getDate() - 1)
            return { start: yesterday, end: yesterday }
        }
        case 'last7':
            return {
                start: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000),
                end: today
            }
        case 'last30':
            return {
                start: new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000),
                end: today
            }
        case 'thisMonth': {
            const start = new Date(today.getFullYear(), today.getMonth(), 1)
            return { start, end: today }
        }
        case 'lastMonth': {
            const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
            const end = new Date(today.getFullYear(), today.getMonth(), 0)
            return { start, end }
        }
        case 'thisQuarter': {
            const quarter = Math.floor(today.getMonth() / 3)
            const start = new Date(today.getFullYear(), quarter * 3, 1)
            return { start, end: today }
        }
        case 'thisYear': {
            const start = new Date(today.getFullYear(), 0, 1)
            return { start, end: today }
        }
        default:
            return { start: today, end: today }
    }
}

export default function DateRangeFilter({
    onChange,
    initialPreset = 'last7',
    language = 'en',
    showPresets = true,
    compact = false
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [selectedPreset, setSelectedPreset] = useState(initialPreset)
    const [dateRange, setDateRange] = useState(getPresetRange(initialPreset))
    const [showCalendar, setShowCalendar] = useState(false)
    const [calendarMonth, setCalendarMonth] = useState(new Date())
    const [selectingStart, setSelectingStart] = useState(true)
    const [tempRange, setTempRange] = useState({ start: null, end: null })
    const panelRef = useRef(null)

    const t = translations[language] || translations.en

    const presets = [
        { key: 'today', label: t.today },
        { key: 'yesterday', label: t.yesterday },
        { key: 'last7', label: t.last7Days },
        { key: 'last30', label: t.last30Days },
        { key: 'thisMonth', label: t.thisMonth },
        { key: 'lastMonth', label: t.lastMonth },
        { key: 'thisQuarter', label: t.thisQuarter },
        { key: 'thisYear', label: t.thisYear },
    ]

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handlePresetClick = (preset) => {
        const range = getPresetRange(preset)
        setSelectedPreset(preset)
        setDateRange(range)
        onChange?.(range, preset)
        setIsOpen(false)
        setShowCalendar(false)
    }

    const formatDate = (date) => {
        if (!date) return ''
        const d = new Date(date)
        return `${d.getDate()} ${t.shortMonths[d.getMonth()]} ${d.getFullYear()}`
    }

    const getDisplayText = () => {
        if (selectedPreset !== 'custom') {
            const preset = presets.find(p => p.key === selectedPreset)
            return preset?.label || t.last7Days
        }
        return `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`
    }

    // Calendar logic
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay()

    const renderCalendar = () => {
        const year = calendarMonth.getFullYear()
        const month = calendarMonth.getMonth()
        const daysInMonth = getDaysInMonth(year, month)
        const firstDay = getFirstDayOfMonth(year, month)
        const days = []

        // Empty cells before first day
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>)
        }

        // Days of month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day)
            const isStart = tempRange.start && date.toDateString() === new Date(tempRange.start).toDateString()
            const isEnd = tempRange.end && date.toDateString() === new Date(tempRange.end).toDateString()
            const isInRange = tempRange.start && tempRange.end && date >= new Date(tempRange.start) && date <= new Date(tempRange.end)
            const isToday = date.toDateString() === new Date().toDateString()

            days.push(
                <button
                    key={day}
                    className={`calendar-day 
                        ${isStart ? 'start' : ''} 
                        ${isEnd ? 'end' : ''} 
                        ${isInRange && !isStart && !isEnd ? 'in-range' : ''} 
                        ${isToday ? 'today' : ''}`}
                    onClick={() => handleDayClick(date)}
                >
                    {day}
                </button>
            )
        }

        return days
    }

    const handleDayClick = (date) => {
        if (selectingStart) {
            setTempRange({ start: date, end: null })
            setSelectingStart(false)
        } else {
            if (date < tempRange.start) {
                setTempRange({ start: date, end: tempRange.start })
            } else {
                setTempRange({ ...tempRange, end: date })
            }
            setSelectingStart(true)
        }
    }

    const applyCustomRange = () => {
        if (tempRange.start && tempRange.end) {
            setDateRange(tempRange)
            setSelectedPreset('custom')
            onChange?.(tempRange, 'custom')
            setShowCalendar(false)
            setIsOpen(false)
        }
    }

    const navigateMonth = (direction) => {
        const newMonth = new Date(calendarMonth)
        newMonth.setMonth(newMonth.getMonth() + direction)
        setCalendarMonth(newMonth)
    }

    return (
        <div className="date-range-filter" ref={panelRef}>
            <button
                className={`date-trigger ${compact ? 'compact' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <Calendar size={compact ? 14 : 16} />
                <span>{getDisplayText()}</span>
                <ChevronRight size={14} className={`chevron ${isOpen ? 'open' : ''}`} />
            </button>

            {isOpen && (
                <div className="date-dropdown">
                    {showPresets && !showCalendar && (
                        <div className="presets-panel">
                            <div className="presets-grid">
                                {presets.map(preset => (
                                    <button
                                        key={preset.key}
                                        className={`preset-btn ${selectedPreset === preset.key ? 'active' : ''}`}
                                        onClick={() => handlePresetClick(preset.key)}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                            <div className="preset-divider">
                                <span>{t.custom}</span>
                            </div>
                            <button
                                className="custom-range-btn"
                                onClick={() => {
                                    setShowCalendar(true)
                                    setTempRange(dateRange)
                                }}
                            >
                                <Calendar size={16} />
                                {t.custom}
                            </button>
                        </div>
                    )}

                    {showCalendar && (
                        <div className="calendar-panel">
                            <div className="calendar-header">
                                <button className="nav-btn" onClick={() => navigateMonth(-1)}>
                                    <ChevronLeft size={18} />
                                </button>
                                <span className="month-year">
                                    {t.months[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                                </span>
                                <button className="nav-btn" onClick={() => navigateMonth(1)}>
                                    <ChevronRight size={18} />
                                </button>
                            </div>

                            <div className="calendar-weekdays">
                                {t.days.map(day => (
                                    <span key={day}>{day}</span>
                                ))}
                            </div>

                            <div className="calendar-days">
                                {renderCalendar()}
                            </div>

                            <div className="selected-range">
                                <div className="range-input">
                                    <span>{t.from}:</span>
                                    <input
                                        type="text"
                                        value={formatDate(tempRange.start)}
                                        readOnly
                                        placeholder="Select start"
                                    />
                                </div>
                                <div className="range-input">
                                    <span>{t.to}:</span>
                                    <input
                                        type="text"
                                        value={formatDate(tempRange.end)}
                                        readOnly
                                        placeholder="Select end"
                                    />
                                </div>
                            </div>

                            <div className="calendar-actions">
                                <button className="btn-cancel" onClick={() => setShowCalendar(false)}>
                                    {t.cancel}
                                </button>
                                <button
                                    className="btn-apply"
                                    onClick={applyCustomRange}
                                    disabled={!tempRange.start || !tempRange.end}
                                >
                                    {t.apply}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <style>{`
                .date-range-filter {
                    position: relative;
                    display: inline-block;
                }

                .date-trigger {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 14px;
                    background: var(--bg-card);
                    border: 1px solid var(--border-subtle);
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 0.85rem;
                    color: var(--text-primary);
                    transition: all 0.2s;
                }

                .date-trigger.compact {
                    padding: 6px 10px;
                    font-size: 0.75rem;
                }

                .date-trigger:hover {
                    border-color: var(--primary-500);
                }

                .date-trigger .chevron {
                    transition: transform 0.2s;
                }

                .date-trigger .chevron.open {
                    transform: rotate(90deg);
                }

                .date-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    margin-top: 6px;
                    background: var(--bg-primary);
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
                    z-index: 1000;
                    overflow: hidden;
                    animation: dropIn 0.2s ease;
                }

                @keyframes dropIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .presets-panel {
                    padding: 12px;
                    min-width: 220px;
                }

                .presets-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 6px;
                }

                .preset-btn {
                    padding: 10px 12px;
                    background: var(--bg-secondary);
                    border: 1px solid transparent;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    cursor: pointer;
                    text-align: left;
                    transition: all 0.15s;
                    color: var(--text-primary);
                }

                .preset-btn:hover {
                    background: var(--bg-tertiary);
                    border-color: var(--primary-500);
                }

                .preset-btn.active {
                    background: var(--primary-500);
                    color: white;
                    border-color: var(--primary-500);
                }

                .preset-divider {
                    display: flex;
                    align-items: center;
                    margin: 14px 0 10px;
                    color: var(--text-tertiary);
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .preset-divider::before,
                .preset-divider::after {
                    content: '';
                    flex: 1;
                    height: 1px;
                    background: var(--border-subtle);
                }

                .preset-divider span {
                    margin: 0 10px;
                }

                .custom-range-btn {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 12px;
                    background: transparent;
                    border: 1px dashed var(--border-subtle);
                    border-radius: 8px;
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-size: 0.85rem;
                    transition: all 0.15s;
                }

                .custom-range-btn:hover {
                    border-color: var(--primary-500);
                    color: var(--primary-500);
                }

                /* Calendar */
                .calendar-panel {
                    padding: 16px;
                    min-width: 300px;
                }

                .calendar-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 16px;
                }

                .month-year {
                    font-weight: 600;
                    font-size: 0.95rem;
                }

                .nav-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    border: 1px solid var(--border-subtle);
                    background: var(--bg-card);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-secondary);
                    transition: all 0.15s;
                }

                .nav-btn:hover {
                    background: var(--bg-secondary);
                    color: var(--primary-500);
                }

                .calendar-weekdays {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 2px;
                    margin-bottom: 8px;
                }

                .calendar-weekdays span {
                    text-align: center;
                    font-size: 0.7rem;
                    color: var(--text-tertiary);
                    padding: 6px;
                    font-weight: 600;
                }

                .calendar-days {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 2px;
                }

                .calendar-day {
                    aspect-ratio: 1;
                    border: none;
                    background: transparent;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: all 0.15s;
                    color: var(--text-primary);
                }

                .calendar-day:hover:not(.empty) {
                    background: var(--bg-secondary);
                }

                .calendar-day.today {
                    border: 1px solid var(--primary-500);
                }

                .calendar-day.start,
                .calendar-day.end {
                    background: var(--primary-500);
                    color: white;
                }

                .calendar-day.in-range {
                    background: rgba(249, 115, 22, 0.15);
                }

                .calendar-day.empty {
                    cursor: default;
                }

                .selected-range {
                    display: flex;
                    gap: 12px;
                    margin-top: 16px;
                }

                .range-input {
                    flex: 1;
                }

                .range-input span {
                    display: block;
                    font-size: 0.7rem;
                    color: var(--text-tertiary);
                    margin-bottom: 4px;
                }

                .range-input input {
                    width: 100%;
                    padding: 8px 10px;
                    border: 1px solid var(--border-subtle);
                    border-radius: 6px;
                    background: var(--bg-card);
                    font-size: 0.8rem;
                    color: var(--text-primary);
                }

                .calendar-actions {
                    display: flex;
                    gap: 8px;
                    margin-top: 16px;
                }

                .btn-cancel,
                .btn-apply {
                    flex: 1;
                    padding: 10px;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .btn-cancel {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-subtle);
                    color: var(--text-primary);
                }

                .btn-cancel:hover {
                    background: var(--bg-tertiary);
                }

                .btn-apply {
                    background: var(--primary-500);
                    border: none;
                    color: white;
                }

                .btn-apply:hover:not(:disabled) {
                    background: var(--primary-600);
                }

                .btn-apply:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                @media (max-width: 768px) {
                    .date-dropdown {
                        position: fixed;
                        left: 16px;
                        right: 16px;
                        top: auto;
                        bottom: 80px;
                        width: auto;
                    }
                }
            `}</style>
        </div>
    )
}

// Export presets for use elsewhere
export { getPresetRange }
