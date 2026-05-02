import { useState, useEffect, useRef } from 'react'
import {
    Search, Home, FileText, Package, Users, BarChart3, Settings,
    Plus, Camera, Gift, TrendingUp, Wallet, MessageSquare,
    Truck, FileBarChart, Layers, ArrowRight, Command, Zap
} from 'lucide-react'

const commands = [
    // Navigation
    { id: 'dashboard', label: 'Go to Dashboard', icon: Home, type: 'page', keywords: ['home', 'main'] },
    { id: 'create-bill', label: 'Create New Bill', icon: Plus, type: 'page', keywords: ['invoice', 'sale', 'new'] },
    { id: 'bills', label: 'View Bills', icon: FileText, type: 'page', keywords: ['invoices', 'history', 'sales'] },
    { id: 'products', label: 'Manage Products', icon: Package, type: 'page', keywords: ['inventory', 'stock', 'items'] },
    { id: 'customers', label: 'Customer Management', icon: Users, type: 'page', keywords: ['clients', 'credit', 'people'] },
    { id: 'suppliers', label: 'Supplier Management', icon: Truck, type: 'page', keywords: ['vendors', 'purchases'] },
    { id: 'analytics', label: 'View Analytics', icon: BarChart3, type: 'page', keywords: ['reports', 'charts', 'insights'] },
    { id: 'loyalty', label: 'Loyalty Program', icon: Gift, type: 'page', keywords: ['rewards', 'points'] },
    { id: 'expenses', label: 'Expense Tracker', icon: Wallet, type: 'page', keywords: ['costs', 'spending'] },
    { id: 'gst', label: 'GST Reports', icon: FileBarChart, type: 'page', keywords: ['tax', 'returns'] },
    { id: 'bulk-operations', label: 'Bulk Operations', icon: Layers, type: 'page', keywords: ['import', 'export', 'batch'] },
    { id: 'ocr', label: 'Smart Scan (OCR)', icon: Camera, type: 'page', keywords: ['capture', 'photo', 'scan'] },
    { id: 'ai-insights', label: 'AI Insights', icon: Zap, type: 'page', keywords: ['predictions', 'smart'] },
    { id: 'whatsapp', label: 'WhatsApp Integration', icon: MessageSquare, type: 'page', keywords: ['message', 'chat'] },
    { id: 'daily-summary', label: 'Daily Summary', icon: TrendingUp, type: 'page', keywords: ['today', 'report'] },
    { id: 'settings', label: 'Settings', icon: Settings, type: 'page', keywords: ['preferences', 'config'] },

    // Actions
    { id: 'action:new-product', label: 'Add New Product', icon: Plus, type: 'action', action: 'products', keywords: ['create item'] },
    { id: 'action:new-customer', label: 'Add New Customer', icon: Plus, type: 'action', action: 'customers', keywords: ['create client'] },
    { id: 'action:quick-bill', label: 'Quick Bill', icon: Zap, type: 'action', action: 'create-bill', keywords: ['fast sale'] },
]

export default function CommandPalette({ onClose, onNavigate, addToast }) {
    const [search, setSearch] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef(null)
    const listRef = useRef(null)

    // Filter commands based on search
    const filteredCommands = commands.filter(cmd => {
        const searchLower = search.toLowerCase()
        return (
            cmd.label.toLowerCase().includes(searchLower) ||
            cmd.keywords.some(k => k.includes(searchLower))
        )
    })

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    useEffect(() => {
        setSelectedIndex(0)
    }, [search])

    // Scroll selected item into view
    useEffect(() => {
        const selectedElement = listRef.current?.children[selectedIndex]
        if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'nearest' })
        }
    }, [selectedIndex])

    const handleKeyDown = (e) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setSelectedIndex(prev =>
                    prev < filteredCommands.length - 1 ? prev + 1 : 0
                )
                break
            case 'ArrowUp':
                e.preventDefault()
                setSelectedIndex(prev =>
                    prev > 0 ? prev - 1 : filteredCommands.length - 1
                )
                break
            case 'Enter':
                e.preventDefault()
                if (filteredCommands[selectedIndex]) {
                    executeCommand(filteredCommands[selectedIndex])
                }
                break
            case 'Escape':
                onClose()
                break
        }
    }

    const executeCommand = (command) => {
        if (command.type === 'page') {
            onNavigate(command.id)
        } else if (command.type === 'action') {
            onNavigate(command.action)
            addToast?.(`Opening ${command.label}...`, 'info')
        }
    }

    return (
        <div className="command-overlay" onClick={onClose}>
            <div className="command-modal" onClick={e => e.stopPropagation()}>
                <div className="command-search">
                    <Search size={20} />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Type a command or search..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <kbd className="command-shortcut">ESC</kbd>
                </div>

                <div className="command-list" ref={listRef}>
                    {filteredCommands.length === 0 ? (
                        <div className="command-empty">
                            <p>No commands found for "{search}"</p>
                        </div>
                    ) : (
                        filteredCommands.map((cmd, index) => (
                            <button
                                key={cmd.id}
                                className={`command-item ${index === selectedIndex ? 'selected' : ''}`}
                                onClick={() => executeCommand(cmd)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <div className="command-item-icon">
                                    <cmd.icon size={18} />
                                </div>
                                <span className="command-item-label">{cmd.label}</span>
                                <span className="command-item-type">
                                    {cmd.type === 'page' ? 'Navigate' : 'Action'}
                                </span>
                                <ArrowRight size={14} className="command-item-arrow" />
                            </button>
                        ))
                    )}
                </div>

                <div className="command-footer">
                    <div className="command-hint">
                        <kbd>↑</kbd><kbd>↓</kbd> to navigate
                    </div>
                    <div className="command-hint">
                        <kbd>↵</kbd> to select
                    </div>
                    <div className="command-hint">
                        <kbd>esc</kbd> to close
                    </div>
                </div>
            </div>

            <style>{`
                .command-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px);
                    display: flex; align-items: flex-start; justify-content: center;
                    padding-top: 15vh; z-index: 9999;
                    animation: fadeIn 0.15s ease-out;
                }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                
                .command-modal {
                    background: var(--bg-secondary); border-radius: var(--radius-xl);
                    width: 100%; max-width: 580px; overflow: hidden;
                    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--border-subtle);
                    animation: slideDown 0.2s ease-out;
                }
                @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                
                .command-search {
                    display: flex; align-items: center; gap: 12px;
                    padding: 16px 20px; border-bottom: 1px solid var(--border-subtle);
                }
                .command-search svg { color: var(--text-tertiary); flex-shrink: 0; }
                .command-search input {
                    flex: 1; background: transparent; border: none; outline: none;
                    font-size: 1.125rem; color: var(--text-primary);
                }
                .command-search input::placeholder { color: var(--text-tertiary); }
                
                .command-shortcut {
                    background: var(--bg-tertiary); padding: 4px 8px;
                    border-radius: 4px; font-size: 0.75rem; color: var(--text-tertiary);
                    font-family: inherit;
                }
                
                .command-list {
                    max-height: 400px; overflow-y: auto; padding: 8px;
                }
                
                .command-empty {
                    padding: 32px; text-align: center; color: var(--text-tertiary);
                }
                
                .command-item {
                    display: flex; align-items: center; gap: 12px;
                    width: 100%; padding: 12px 16px; background: transparent;
                    border: none; border-radius: var(--radius-md); cursor: pointer;
                    color: var(--text-primary); text-align: left;
                    transition: all 0.1s ease;
                }
                .command-item:hover, .command-item.selected {
                    background: var(--bg-tertiary);
                }
                .command-item.selected {
                    background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
                    color: white;
                }
                .command-item.selected .command-item-type,
                .command-item.selected .command-item-arrow { color: rgba(255,255,255,0.7); }
                
                .command-item-icon {
                    width: 36px; height: 36px; background: var(--bg-primary);
                    border-radius: var(--radius-md); display: flex;
                    align-items: center; justify-content: center;
                }
                .command-item.selected .command-item-icon { background: rgba(255,255,255,0.15); }
                
                .command-item-label { flex: 1; font-weight: 500; }
                
                .command-item-type {
                    font-size: 0.75rem; color: var(--text-tertiary);
                    text-transform: uppercase; letter-spacing: 0.5px;
                }
                
                .command-item-arrow { color: var(--text-tertiary); }
                
                .command-footer {
                    display: flex; gap: 16px; padding: 12px 20px;
                    border-top: 1px solid var(--border-subtle);
                    background: var(--bg-tertiary);
                }
                
                .command-hint {
                    display: flex; align-items: center; gap: 6px;
                    font-size: 0.75rem; color: var(--text-tertiary);
                }
                .command-hint kbd {
                    background: var(--bg-primary); padding: 2px 6px;
                    border-radius: 4px; font-size: 0.6875rem;
                    font-family: inherit; border: 1px solid var(--border-subtle);
                }
            `}</style>
        </div>
    )
}
