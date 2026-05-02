import { useState, useEffect, useCallback, useRef } from 'react'
import { Mic, MicOff, Volume2, Loader2, X, Sparkles, MessageCircle, Send, Bot } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getSpeechCode } from '../i18n'
import realDataService from '../services/realDataService'

export default function VoiceCommandAgent({ addToast, setCurrentPage }) {
    const { t, i18n } = useTranslation()
    const [isListening, setIsListening] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [transcript, setTranscript] = useState('')
    const [response, setResponse] = useState(null)
    const [isOpen, setIsOpen] = useState(false)
    const [chatHistory, setChatHistory] = useState([])
    const [textInput, setTextInput] = useState('')
    const recognitionRef = useRef(null)
    const synthRef = useRef(null)

    // Get speech code based on current i18n language (ta-IN, hi-IN, te-IN, kn-IN, ml-IN, en-IN)
    const currentSpeechLang = getSpeechCode(i18n.language)

    useEffect(() => {
        // Initialize Speech Recognition
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
            recognitionRef.current = new SpeechRecognition()
            recognitionRef.current.continuous = false
            recognitionRef.current.interimResults = true
            recognitionRef.current.lang = currentSpeechLang

            recognitionRef.current.onresult = (event) => {
                const result = event.results[event.results.length - 1]
                setTranscript(result[0].transcript)

                if (result.isFinal) {
                    processCommand(result[0].transcript)
                }
            }

            recognitionRef.current.onend = () => {
                setIsListening(false)
            }

            recognitionRef.current.onerror = (event) => {
                console.error('Speech recognition error:', event.error)
                setIsListening(false)
            }
        }

        // Initialize Speech Synthesis
        synthRef.current = window.speechSynthesis

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort()
            }
        }
    }, [])

    const toggleListening = useCallback(() => {
        if (isListening) {
            recognitionRef.current?.stop()
            setIsListening(false)
        } else {
            setTranscript('')
            recognitionRef.current?.start()
            setIsListening(true)
        }
    }, [isListening])

    const speak = useCallback((text) => {
        if (synthRef.current) {
            const utterance = new SpeechSynthesisUtterance(text)
            utterance.lang = currentSpeechLang
            utterance.rate = 1
            utterance.pitch = 1
            synthRef.current.speak(utterance)
        }
    }, [])

    const processCommand = async (command) => {
        if (!command.trim()) return

        setIsProcessing(true)
        setChatHistory(prev => [...prev, { type: 'user', text: command }])

        try {
            const [bills, products, customers] = await Promise.all([
                realDataService.getBills(),
                realDataService.getProducts(),
                realDataService.getCustomers()
            ])

            const lowerCommand = command.toLowerCase()
            let responseText = ''
            let action = null

            // Sales/Revenue queries
            if (lowerCommand.includes('sales') || lowerCommand.includes('revenue') || lowerCommand.includes('earnings')) {
                const today = new Date()
                today.setHours(0, 0, 0, 0)

                const todayBills = bills.filter(b => {
                    const billDate = new Date(b.created_at || b.createdAt)
                    return billDate >= today
                })
                const todaySales = todayBills.reduce((sum, b) => sum + (b.total || 0), 0)
                const weeklyBills = bills.filter(b => {
                    const billDate = new Date(b.created_at || b.createdAt)
                    return billDate >= new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
                })
                const weeklySales = weeklyBills.reduce((sum, b) => sum + (b.total || 0), 0)

                responseText = `Today's sales are ${todaySales.toLocaleString()} rupees from ${todayBills.length} bills. This week's total is ${weeklySales.toLocaleString()} rupees.`
            }
            // Stock queries
            else if (lowerCommand.includes('stock') || lowerCommand.includes('inventory')) {
                const lowStock = products.filter(p => (p.stock || 0) <= (p.minStock || 5))
                const outOfStock = products.filter(p => (p.stock || 0) === 0)

                if (outOfStock.length > 0) {
                    responseText = `Alert! ${outOfStock.length} products are out of stock. ${lowStock.length} products are running low. Would you like me to show you the products page?`
                    action = 'products'
                } else if (lowStock.length > 0) {
                    responseText = `${lowStock.length} products are running low on stock: ${lowStock.slice(0, 3).map(p => p.name).join(', ')}. You should reorder soon.`
                } else {
                    responseText = `All ${products.length} products have healthy stock levels. No action needed!`
                }
            }
            // Customer queries
            else if (lowerCommand.includes('customer') || lowerCommand.includes('client')) {
                const activeCustomers = customers.filter(c => (c.visit_count || c.visits || 0) > 1)
                responseText = `You have ${customers.length} total customers, ${activeCustomers.length} are repeat customers. Your customer retention is ${customers.length > 0 ? Math.round((activeCustomers.length / customers.length) * 100) : 0}%.`
            }
            // Bill/Order queries
            else if (lowerCommand.includes('bill') || lowerCommand.includes('order') || lowerCommand.includes('transaction')) {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const todayBills = bills.filter(b => new Date(b.created_at || b.createdAt) >= today)

                responseText = `You've created ${todayBills.length} bills today. Total transactions for this month: ${bills.length}. Would you like to create a new bill?`
                action = 'create-bill'
            }
            // Create bill command
            else if (lowerCommand.includes('create') || lowerCommand.includes('new bill') || lowerCommand.includes('make a bill')) {
                responseText = `Opening the bill creation page for you.`
                action = 'create-bill'
            }
            // Analytics query
            else if (lowerCommand.includes('analytics') || lowerCommand.includes('report') || lowerCommand.includes('performance')) {
                const avgBill = bills.length > 0 ? bills.reduce((sum, b) => sum + (b.total || 0), 0) / bills.length : 0
                responseText = `Your average bill value is ${avgBill.toFixed(0)} rupees. Opening analytics for detailed insights.`
                action = 'analytics'
            }
            // Greeting
            else if (lowerCommand.includes('hello') || lowerCommand.includes('hi') || lowerCommand.includes('hey')) {
                const hour = new Date().getHours()
                const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
                responseText = `${greeting}! I'm your AI business assistant. How can I help you manage your store today?`
            }
            // Help
            else if (lowerCommand.includes('help') || lowerCommand.includes('what can you do')) {
                responseText = `I can help you with: checking sales and revenue, monitoring stock levels, viewing customer data, creating bills, and analyzing business performance. Just ask naturally!`
            }
            // Default
            else {
                responseText = `I understood: "${command}". I can help with sales, stock, customers, bills, and analytics. Try asking "What are my sales today?" or "Check stock levels".`
            }

            setResponse({ text: responseText, action })
            setChatHistory(prev => [...prev, { type: 'agent', text: responseText, action }])
            speak(responseText)

            // Execute action if any
            if (action && setCurrentPage) {
                setTimeout(() => {
                    setCurrentPage(action)
                }, 2000)
            }

        } catch (error) {
            console.error('Error processing command:', error)
            const errorResponse = "I had trouble understanding that. Please try again."
            setResponse({ text: errorResponse })
            setChatHistory(prev => [...prev, { type: 'agent', text: errorResponse }])
        } finally {
            setIsProcessing(false)
        }
    }

    const handleTextSubmit = (e) => {
        e.preventDefault()
        if (textInput.trim()) {
            processCommand(textInput.trim())
            setTextInput('')
        }
    }

    const hasVoiceSupport = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window

    return (
        <>
            <style>{voiceAgentStyles}</style>

            {/* Floating AI Button */}
            <button
                className={`ai-float-button ${isListening ? 'listening' : ''} ${isProcessing ? 'processing' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <Bot size={24} />
                {isListening && <span className="listening-indicator"></span>}
            </button>

            {/* AI Agent Panel */}
            {isOpen && (
                <div className="voice-agent-panel">
                    <div className="agent-header">
                        <div className="agent-title">
                            <Sparkles size={20} />
                            <span>AI Agent</span>
                        </div>
                        <button className="close-btn" onClick={() => setIsOpen(false)}>
                            <X size={18} />
                        </button>
                    </div>

                    {/* Chat History */}
                    <div className="agent-chat">
                        {chatHistory.length === 0 ? (
                            <div className="agent-welcome">
                                <Bot size={48} />
                                <h4>Hello! I'm your AI Agent</h4>
                                <p>Ask me anything about your business - sales, stock, customers, or give me commands!</p>
                                <div className="example-queries">
                                    <button onClick={() => processCommand("What are my sales today?")}>
                                        💰 Today's sales
                                    </button>
                                    <button onClick={() => processCommand("Check stock levels")}>
                                        📦 Check stock
                                    </button>
                                    <button onClick={() => processCommand("Show me analytics")}>
                                        📊 Analytics
                                    </button>
                                </div>
                            </div>
                        ) : (
                            chatHistory.map((msg, i) => (
                                <div key={i} className={`chat-message ${msg.type}`}>
                                    {msg.type === 'agent' && <Bot size={16} className="agent-icon" />}
                                    <div className="message-content">
                                        <p>{msg.text}</p>
                                        {msg.action && (
                                            <button
                                                className="action-btn"
                                                onClick={() => setCurrentPage?.(msg.action)}
                                            >
                                                Go to {msg.action}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        {isProcessing && (
                            <div className="chat-message agent processing">
                                <Bot size={16} className="agent-icon" />
                                <div className="message-content">
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Thinking...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Voice Status */}
                    {isListening && (
                        <div className="voice-status">
                            <div className="voice-wave"></div>
                            <p>{transcript || 'Listening...'}</p>
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="agent-input">
                        <form onSubmit={handleTextSubmit}>
                            <input
                                type="text"
                                placeholder="Ask me anything..."
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                disabled={isProcessing}
                            />
                            <button type="submit" disabled={!textInput.trim() || isProcessing}>
                                <Send size={18} />
                            </button>
                        </form>

                        {hasVoiceSupport && (
                            <button
                                className={`voice-btn ${isListening ? 'active' : ''}`}
                                onClick={toggleListening}
                                disabled={isProcessing}
                            >
                                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}

const voiceAgentStyles = `
    /* Floating AI Button */
    .ai-float-button {
        position: fixed;
        bottom: 90px;
        right: 20px;
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #7c3aed, #6366f1);
        color: white;
        border: none;
        border-radius: 50%;
        box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4);
        cursor: pointer;
        z-index: 1000;
        transition: all 0.3s;
    }

    .ai-float-button:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 30px rgba(124, 58, 237, 0.5);
    }

    .ai-float-button.listening {
        animation: pulse-glow 1.5s infinite;
    }

    .ai-float-button.processing {
        animation: rotate-pulse 2s linear infinite;
    }

    @keyframes pulse-glow {
        0%, 100% { box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4); }
        50% { box-shadow: 0 4px 40px rgba(124, 58, 237, 0.8); }
    }

    @keyframes rotate-pulse {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .listening-indicator {
        position: absolute;
        top: -4px;
        right: -4px;
        width: 12px;
        height: 12px;
        background: #ef4444;
        border-radius: 50%;
        animation: blink 0.5s infinite;
    }

    @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
    }

    /* Voice Agent Panel */
    .voice-agent-panel {
        position: fixed;
        bottom: 160px;
        right: 20px;
        width: 380px;
        max-height: 500px;
        background: var(--bg-card);
        border: 1px solid var(--border-default);
        border-radius: 20px;
        box-shadow: var(--shadow-xl);
        z-index: 1001;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .agent-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(99, 102, 241, 0.1));
        border-bottom: 1px solid var(--border-subtle);
    }

    .agent-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        color: #7c3aed;
    }

    .close-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.1);
        border: none;
        border-radius: 8px;
        color: var(--text-secondary);
        cursor: pointer;
    }

    /* Chat Area */
    .agent-chat {
        flex: 1;
        padding: 16px;
        overflow-y: auto;
        max-height: 300px;
    }

    .agent-welcome {
        text-align: center;
        padding: 20px 10px;
    }

    .agent-welcome svg {
        color: #7c3aed;
        margin-bottom: 12px;
    }

    .agent-welcome h4 {
        margin: 0 0 8px;
        font-size: 1.125rem;
    }

    .agent-welcome p {
        font-size: 0.8125rem;
        color: var(--text-secondary);
        margin: 0 0 16px;
    }

    .example-queries {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
    }

    .example-queries button {
        padding: 8px 12px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-subtle);
        border-radius: 100px;
        font-size: 0.75rem;
        color: var(--text-primary);
        cursor: pointer;
        transition: all 0.2s;
    }

    .example-queries button:hover {
        background: var(--primary-500);
        color: white;
        border-color: transparent;
    }

    /* Chat Messages */
    .chat-message {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
    }

    .chat-message.user {
        justify-content: flex-end;
    }

    .chat-message.user .message-content {
        background: linear-gradient(135deg, #7c3aed, #6366f1);
        color: white;
        border-radius: 16px 16px 4px 16px;
    }

    .chat-message.agent .message-content {
        background: var(--bg-tertiary);
        border-radius: 16px 16px 16px 4px;
    }

    .agent-icon {
        color: #7c3aed;
        flex-shrink: 0;
        margin-top: 4px;
    }

    .message-content {
        padding: 10px 14px;
        max-width: 80%;
    }

    .message-content p {
        margin: 0;
        font-size: 0.875rem;
        line-height: 1.5;
        color: inherit;
    }

    .message-content .action-btn {
        margin-top: 8px;
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        border-radius: 6px;
        font-size: 0.75rem;
        color: currentColor;
        cursor: pointer;
    }

    .chat-message.processing .message-content {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .animate-spin {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    /* Voice Status */
    .voice-status {
        padding: 12px 16px;
        background: rgba(239, 68, 68, 0.1);
        border-top: 1px solid var(--border-subtle);
        text-align: center;
    }

    .voice-wave {
        height: 4px;
        background: linear-gradient(90deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #7c3aed);
        border-radius: 2px;
        animation: wave 1s ease-in-out infinite;
    }

    @keyframes wave {
        0%, 100% { transform: scaleX(1); }
        50% { transform: scaleX(0.8); }
    }

    .voice-status p {
        margin: 8px 0 0;
        font-size: 0.8125rem;
        color: #ef4444;
    }

    /* Input Area */
    .agent-input {
        display: flex;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid var(--border-subtle);
        background: var(--bg-secondary);
    }

    .agent-input form {
        flex: 1;
        display: flex;
        gap: 8px;
    }

    .agent-input input {
        flex: 1;
        padding: 10px 14px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
        color: var(--text-primary);
        font-size: 0.875rem;
    }

    .agent-input input:focus {
        outline: none;
        border-color: #7c3aed;
    }

    .agent-input button[type="submit"],
    .voice-btn {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #7c3aed;
        border: none;
        border-radius: 10px;
        color: white;
        cursor: pointer;
        transition: all 0.2s;
    }

    .agent-input button[type="submit"]:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .voice-btn.active {
        background: #ef4444;
        animation: pulse 1s infinite;
    }

    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }

    /* Mobile */
    @media (max-width: 480px) {
        .voice-agent-panel {
            right: 10px;
            left: 10px;
            width: auto;
            bottom: 140px;
        }

        .ai-float-button {
            bottom: 80px;
            right: 16px;
        }
    }
`
