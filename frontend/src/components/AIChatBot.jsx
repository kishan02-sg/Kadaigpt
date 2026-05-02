import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Mic, MicOff, Bot, User, Sparkles, Loader2 } from 'lucide-react'

// Predefined responses for common queries
const knowledgeBase = {
    greetings: ['hello', 'hi', 'hey', 'namaste', 'good morning', 'good afternoon', 'good evening'],
    billing: ['bill', 'invoice', 'receipt', 'create bill', 'new bill', 'print', 'gst'],
    products: ['product', 'stock', 'inventory', 'add product', 'low stock', 'price'],
    customers: ['customer', 'loyalty', 'points', 'reward', 'member'],
    analytics: ['sales', 'revenue', 'analytics', 'report', 'profit', 'trend'],
    help: ['help', 'how to', 'guide', 'tutorial', 'support']
}

const responses = {
    greetings: [
        "Hello! 👋 I'm KadaiGPT AI assistant. How can I help you today?",
        "Namaste! Ready to assist with your store operations.",
        "Hi there! Ask me anything about billing, inventory, or analytics."
    ],
    billing: [
        "To create a new bill:\n1. Go to 'Create Bill' page\n2. Search or tap products to add\n3. Adjust quantity and apply discounts\n4. Select payment method\n5. Print or share via WhatsApp",
        "For GST invoices, make sure your GSTIN is configured in Settings. I'll automatically calculate CGST and SGST."
    ],
    products: [
        "To add a product:\n1. Go to Products page\n2. Click 'Add Product'\n3. Fill in name, price, stock, and category\n4. Set minimum stock for alerts",
        "I can show you low stock alerts! Currently tracking items below minimum levels."
    ],
    customers: [
        "Loyalty points are earned automatically - ₹1 spent = 1 point. Customers can redeem for discounts!",
        "To add loyalty points manually, go to Loyalty & Rewards → Add Points → Select customer"
    ],
    analytics: [
        "Your sales insights are available in the Analytics page. I track:\n• Daily/weekly/monthly trends\n• Top selling products\n• Peak hours\n• Customer patterns",
        "Quick tip: Saturday sees 32% higher sales - consider extended hours!"
    ],
    help: [
        "I can help you with:\n• Creating bills\n• Managing inventory\n• Customer loyalty\n• Analytics insights\n• WhatsApp integration\n• Voice commands\n\nJust ask!",
        "Need a quick action? Try voice commands like 'Create new bill' or 'Show low stock'"
    ],
    default: [
        "I'm still learning! For now, I can help with billing, inventory, customers, and analytics. What would you like to know?",
        "Hmm, I'm not sure about that. Try asking about bills, products, customers, or sales analytics."
    ]
}

// Simple NLP-like intent detection
function detectIntent(message) {
    const lowerMsg = message.toLowerCase()

    for (const [intent, keywords] of Object.entries(knowledgeBase)) {
        if (keywords.some(keyword => lowerMsg.includes(keyword))) {
            return intent
        }
    }
    return 'default'
}

function getResponse(intent) {
    const intentResponses = responses[intent] || responses.default
    return intentResponses[Math.floor(Math.random() * intentResponses.length)]
}

// Quick action suggestions
const quickActions = [
    { label: "How to create a bill?", icon: "📝" },
    { label: "Show low stock items", icon: "📦" },
    { label: "Today's sales summary", icon: "📊" },
    { label: "Add loyalty points", icon: "🎁" },
]

export default function AIChatBot({ addToast, setCurrentPage }) {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState([
        {
            id: 1,
            type: 'bot',
            text: "Hello! 👋 I'm KadaiGPT AI assistant. How can I help you manage your store today?",
            timestamp: new Date()
        }
    ])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const [isListening, setIsListening] = useState(false)
    const messagesEndRef = useRef(null)
    const recognitionRef = useRef(null)

    // Auto scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Initialize speech recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
            recognitionRef.current = new SpeechRecognition()
            recognitionRef.current.continuous = false
            recognitionRef.current.interimResults = false
            recognitionRef.current.lang = 'en-IN'

            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript
                setInput(transcript)
                setIsListening(false)
            }

            recognitionRef.current.onerror = () => {
                setIsListening(false)
            }

            recognitionRef.current.onend = () => {
                setIsListening(false)
            }
        }
    }, [])

    const handleSend = async () => {
        if (!input.trim()) return

        const userMessage = {
            id: Date.now(),
            type: 'user',
            text: input,
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')
        setIsTyping(true)

        // Simulate AI processing
        setTimeout(() => {
            const intent = detectIntent(userMessage.text)
            const response = getResponse(intent)

            // Check for navigation commands
            if (userMessage.text.toLowerCase().includes('go to') || userMessage.text.toLowerCase().includes('open')) {
                handleNavigationCommand(userMessage.text)
            }

            const botMessage = {
                id: Date.now() + 1,
                type: 'bot',
                text: response,
                timestamp: new Date()
            }

            setMessages(prev => [...prev, botMessage])
            setIsTyping(false)
        }, 500 + Math.random() * 1000)
    }

    const handleNavigationCommand = (text) => {
        const pages = {
            'dashboard': 'dashboard',
            'bill': 'create-bill',
            'billing': 'create-bill',
            'product': 'products',
            'inventory': 'products',
            'customer': 'customers',
            'analytics': 'analytics',
            'setting': 'settings',
            'supplier': 'suppliers',
            'loyalty': 'loyalty',
            'gst': 'gst-reports',
            'whatsapp': 'whatsapp'
        }

        for (const [keyword, page] of Object.entries(pages)) {
            if (text.toLowerCase().includes(keyword)) {
                setCurrentPage?.(page)
                addToast?.(`Navigating to ${page}`, 'info')
                break
            }
        }
    }

    const handleQuickAction = (action) => {
        setInput(action.label)
        setTimeout(handleSend, 100)
    }

    const toggleVoice = () => {
        if (isListening) {
            recognitionRef.current?.stop()
        } else {
            recognitionRef.current?.start()
            setIsListening(true)
        }
    }

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <>
            {/* Chat Button */}
            <button
                className={`ai-chat-fab ${isOpen ? 'hidden' : ''}`}
                onClick={() => setIsOpen(true)}
                aria-label="Open AI Chat"
            >
                <Bot size={24} />
                <span className="fab-badge">AI</span>
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="ai-chat-window">
                    {/* Header */}
                    <div className="chat-header">
                        <div className="chat-title">
                            <div className="chat-avatar">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <h3>KadaiGPT AI</h3>
                                <span className="status">Online • Ready to help</span>
                            </div>
                        </div>
                        <button className="close-btn" onClick={() => setIsOpen(false)}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="chat-messages">
                        {messages.map(msg => (
                            <div key={msg.id} className={`message ${msg.type}`}>
                                <div className="message-avatar">
                                    {msg.type === 'bot' ? <Bot size={16} /> : <User size={16} />}
                                </div>
                                <div className="message-content">
                                    <p>{msg.text}</p>
                                    <span className="message-time">
                                        {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {isTyping && (
                            <div className="message bot">
                                <div className="message-avatar"><Bot size={16} /></div>
                                <div className="message-content typing">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Actions */}
                    {messages.length < 3 && (
                        <div className="quick-actions">
                            {quickActions.map((action, i) => (
                                <button
                                    key={i}
                                    className="quick-action-btn"
                                    onClick={() => handleQuickAction(action)}
                                >
                                    <span>{action.icon}</span> {action.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="chat-input-area">
                        <div className="input-container">
                            <input
                                type="text"
                                className="chat-input"
                                placeholder="Ask anything..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                            />
                            <button
                                className={`voice-btn ${isListening ? 'listening' : ''}`}
                                onClick={toggleVoice}
                            >
                                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                            </button>
                            <button
                                className="send-btn"
                                onClick={handleSend}
                                disabled={!input.trim()}
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .ai-chat-fab {
                    position: fixed;
                    bottom: 90px;
                    right: 90px;
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                    border: none;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
                    z-index: 997;
                    transition: all 0.3s ease;
                }
                .ai-chat-fab:hover { transform: scale(1.1); box-shadow: 0 6px 30px rgba(139, 92, 246, 0.5); }
                .ai-chat-fab.hidden { display: none; }
                .ai-chat-fab .fab-badge {
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    background: #22c55e;
                    color: white;
                    font-size: 0.625rem;
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-weight: 700;
                }

                .ai-chat-window {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    width: 380px;
                    height: 550px;
                    background: var(--bg-card);
                    border-radius: var(--radius-xl);
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    display: flex;
                    flex-direction: column;
                    z-index: 1000;
                    overflow: hidden;
                    border: 1px solid var(--border-subtle);
                    animation: slideUp 0.3s ease;
                }

                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .chat-header {
                    padding: 16px;
                    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                    color: white;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .chat-title { display: flex; align-items: center; gap: 12px; }
                .chat-avatar {
                    width: 40px; height: 40px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                }
                .chat-title h3 { margin: 0; font-size: 1rem; }
                .chat-title .status { font-size: 0.75rem; opacity: 0.8; }
                .close-btn {
                    background: rgba(255,255,255,0.2);
                    border: none; color: white;
                    width: 32px; height: 32px; border-radius: 50%;
                    cursor: pointer; display: flex; align-items: center; justify-content: center;
                }
                .close-btn:hover { background: rgba(255,255,255,0.3); }

                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .message {
                    display: flex;
                    gap: 8px;
                    max-width: 85%;
                }
                .message.user { align-self: flex-end; flex-direction: row-reverse; }
                .message.bot { align-self: flex-start; }

                .message-avatar {
                    width: 28px; height: 28px;
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                }
                .message.bot .message-avatar { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; }
                .message.user .message-avatar { background: var(--primary-500); color: white; }

                .message-content {
                    padding: 10px 14px;
                    border-radius: 16px;
                    font-size: 0.875rem;
                    line-height: 1.4;
                }
                .message.bot .message-content {
                    background: var(--bg-secondary);
                    border-bottom-left-radius: 4px;
                }
                .message.user .message-content {
                    background: var(--primary-500);
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                .message-content p { margin: 0; white-space: pre-line; }
                .message-time {
                    display: block;
                    font-size: 0.625rem;
                    opacity: 0.6;
                    margin-top: 4px;
                }

                .message-content.typing {
                    display: flex;
                    gap: 4px;
                    padding: 14px 18px;
                }
                .message-content.typing span {
                    width: 8px; height: 8px;
                    background: var(--text-tertiary);
                    border-radius: 50%;
                    animation: typing 1.4s infinite;
                }
                .message-content.typing span:nth-child(2) { animation-delay: 0.2s; }
                .message-content.typing span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes typing {
                    0%, 60%, 100% { transform: translateY(0); }
                    30% { transform: translateY(-6px); }
                }

                .quick-actions {
                    padding: 8px 16px;
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    border-top: 1px solid var(--border-subtle);
                }
                .quick-action-btn {
                    padding: 6px 12px;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-subtle);
                    border-radius: 20px;
                    font-size: 0.75rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .quick-action-btn:hover {
                    background: var(--primary-500);
                    color: white;
                    border-color: var(--primary-500);
                }

                .chat-input-area {
                    padding: 12px 16px;
                    border-top: 1px solid var(--border-subtle);
                    background: var(--bg-secondary);
                }
                .input-container {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                .chat-input {
                    flex: 1;
                    padding: 10px 14px;
                    border: 1px solid var(--border-subtle);
                    border-radius: 24px;
                    background: var(--bg-card);
                    font-size: 0.875rem;
                    outline: none;
                }
                .chat-input:focus { border-color: var(--primary-400); }

                .voice-btn, .send-btn {
                    width: 36px; height: 36px;
                    border-radius: 50%;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .voice-btn {
                    background: var(--bg-tertiary);
                    color: var(--text-secondary);
                }
                .voice-btn:hover { background: var(--primary-500); color: white; }
                .voice-btn.listening {
                    background: #ef4444;
                    color: white;
                    animation: pulse 1s infinite;
                }
                .send-btn {
                    background: var(--primary-500);
                    color: white;
                }
                .send-btn:hover { background: var(--primary-600); }
                .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                @keyframes pulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                    50% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                }

                /* Mobile Responsive */
                @media (max-width: 480px) {
                    .ai-chat-fab { bottom: 160px; right: 16px; }
                    .ai-chat-window {
                        bottom: 0; right: 0; left: 0;
                        width: 100%; height: 100%;
                        border-radius: 0;
                    }
                }
            `}</style>
        </>
    )
}
