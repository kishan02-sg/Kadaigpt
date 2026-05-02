import { useState } from 'react'
import { X, Keyboard, Command, ArrowUp, ArrowDown, CornerDownLeft } from 'lucide-react'

const shortcuts = [
    {
        category: 'Navigation', items: [
            { keys: ['Ctrl/⌘', 'K'], description: 'Open Command Palette' },
            { keys: ['F1'], description: 'Go to Dashboard' },
            { keys: ['F2'], description: 'Create New Bill' },
            { keys: ['F3'], description: 'View All Bills' },
            { keys: ['F4'], description: 'Products & Inventory' },
        ]
    },
    {
        category: 'Actions', items: [
            { keys: ['Ctrl/⌘', 'N'], description: 'New Bill' },
            { keys: ['Ctrl/⌘', 'B'], description: 'View Bills' },
            { keys: ['Ctrl/⌘', 'D'], description: 'Dashboard' },
            { keys: ['Ctrl/⌘', 'S'], description: 'Smart Scan (OCR)' },
        ]
    },
    {
        category: 'Command Palette', items: [
            { keys: ['↑', '↓'], description: 'Navigate items' },
            { keys: ['Enter'], description: 'Select item' },
            { keys: ['Esc'], description: 'Close palette' },
        ]
    },
    {
        category: 'General', items: [
            { keys: ['Esc'], description: 'Close modals & dialogs' },
            { keys: ['Tab'], description: 'Navigate form fields' },
            { keys: ['Shift', 'Tab'], description: 'Navigate backwards' },
        ]
    },
]

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
    if (!isOpen) return null

    return (
        <div className="shortcuts-overlay" onClick={onClose}>
            <div className="shortcuts-modal" onClick={e => e.stopPropagation()}>
                <div className="shortcuts-header">
                    <div className="shortcuts-title">
                        <Keyboard size={24} />
                        <h2>Keyboard Shortcuts</h2>
                    </div>
                    <button className="shortcuts-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="shortcuts-content">
                    {shortcuts.map((category, i) => (
                        <div key={i} className="shortcut-category">
                            <h3>{category.category}</h3>
                            <div className="shortcut-list">
                                {category.items.map((item, j) => (
                                    <div key={j} className="shortcut-item">
                                        <div className="shortcut-keys">
                                            {item.keys.map((key, k) => (
                                                <span key={k}>
                                                    <kbd>{key}</kbd>
                                                    {k < item.keys.length - 1 && <span className="plus">+</span>}
                                                </span>
                                            ))}
                                        </div>
                                        <span className="shortcut-desc">{item.description}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="shortcuts-footer">
                    <p>💡 Press <kbd>Ctrl/⌘</kbd> + <kbd>K</kbd> anytime to open Command Palette</p>
                </div>
            </div>

            <style>{`
                .shortcuts-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    padding: 20px;
                    animation: fadeIn 0.15s ease-out;
                }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                
                .shortcuts-modal {
                    background: var(--bg-secondary);
                    border-radius: var(--radius-2xl);
                    max-width: 700px;
                    width: 100%;
                    max-height: 80vh;
                    overflow: hidden;
                    animation: slideUp 0.2s ease-out;
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                
                .shortcuts-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px;
                    border-bottom: 1px solid var(--border-subtle);
                }
                .shortcuts-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .shortcuts-title h2 {
                    margin: 0;
                    font-size: 1.25rem;
                }
                .shortcuts-close {
                    background: var(--bg-tertiary);
                    border: none;
                    border-radius: 50%;
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .shortcuts-close:hover {
                    background: var(--error);
                    color: white;
                }
                
                .shortcuts-content {
                    padding: 24px;
                    max-height: 50vh;
                    overflow-y: auto;
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 24px;
                }
                @media (max-width: 600px) {
                    .shortcuts-content { grid-template-columns: 1fr; }
                }
                
                .shortcut-category h3 {
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--text-tertiary);
                    margin-bottom: 12px;
                }
                
                .shortcut-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                
                .shortcut-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 8px 12px;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-md);
                }
                
                .shortcut-keys {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .shortcut-keys kbd {
                    background: var(--bg-primary);
                    border: 1px solid var(--border-subtle);
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    font-family: inherit;
                    min-width: 28px;
                    text-align: center;
                }
                .shortcut-keys .plus {
                    color: var(--text-tertiary);
                    font-size: 0.75rem;
                    margin: 0 2px;
                }
                
                .shortcut-desc {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }
                
                .shortcuts-footer {
                    padding: 16px 24px;
                    background: var(--bg-tertiary);
                    border-top: 1px solid var(--border-subtle);
                    text-align: center;
                }
                .shortcuts-footer p {
                    margin: 0;
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }
                .shortcuts-footer kbd {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-subtle);
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    font-family: inherit;
                }
            `}</style>
        </div>
    )
}
