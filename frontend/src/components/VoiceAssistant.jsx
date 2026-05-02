import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Volume2, VolumeX, Bot, X, MessageCircle, Loader2, Sparkles, Phone } from 'lucide-react'

// Voice commands configuration
const voiceCommands = {
    billing: {
        patterns: ['add', 'ऐड', 'சேர்', 'జోడించు'],
        handler: (item, qty) => ({ action: 'add_item', item, qty })
    },
    navigation: {
        patterns: ['go to', 'open', 'जाओ', 'திற'],
        pages: { 'dashboard': 'dashboard', 'billing': 'create-bill', 'bills': 'bills', 'inventory': 'products', 'customers': 'customers', 'analytics': 'analytics' }
    },
    enquiry: {
        patterns: ['stock', 'price', 'स्टॉक', 'விலை'],
    }
}

// Text-to-speech configuration
const speak = (text, lang = 'en-IN') => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 1
    utterance.pitch = 1
    speechSynthesis.speak(utterance)
}

export default function VoiceAssistant({ onCommand, onNavigate, products = [], addToast }) {
    const [isListening, setIsListening] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [transcript, setTranscript] = useState('')
    const [response, setResponse] = useState('')
    const [mode, setMode] = useState('chat') // chat, call
    const [conversation, setConversation] = useState([])
    const [isProcessing, setIsProcessing] = useState(false)
    const recognitionRef = useRef(null)

    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
            recognitionRef.current = new SpeechRecognition()
            recognitionRef.current.continuous = true
            recognitionRef.current.interimResults = true
            recognitionRef.current.lang = 'en-IN'

            recognitionRef.current.onresult = (event) => {
                const last = event.results.length - 1
                const text = event.results[last][0].transcript
                setTranscript(text)

                if (event.results[last].isFinal) {
                    processCommand(text)
                }
            }

            recognitionRef.current.onerror = (event) => {
                console.error('Speech recognition error:', event.error)
                setIsListening(false)
            }

            recognitionRef.current.onend = () => {
                if (isListening) {
                    recognitionRef.current.start()
                }
            }
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop()
            }
        }
    }, [isListening])

    const startListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.start()
            setIsListening(true)
            addToast?.('Voice assistant activated', 'info')
        }
    }

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop()
            setIsListening(false)
        }
    }

    const processCommand = async (text) => {
        const lowerText = text.toLowerCase()
        setIsProcessing(true)

        addToConversation('user', text)

        let responseText = ''

        // Navigation commands
        if (lowerText.includes('go to') || lowerText.includes('open')) {
            const pages = ['dashboard', 'billing', 'bills', 'inventory', 'products', 'customers', 'analytics', 'gst', 'settings']
            for (const page of pages) {
                if (lowerText.includes(page)) {
                    const mappedPage = voiceCommands.navigation.pages[page] || page
                    onNavigate?.(mappedPage)
                    responseText = `Opening ${page}...`
                    break
                }
            }
        }
        // Add item commands
        else if (lowerText.includes('add')) {
            const match = lowerText.match(/add (\d+)\s*(kg|kilogram|litre|piece|pcs)?\s*(of)?\s*(.+)/i)
            if (match) {
                const qty = parseInt(match[1]) || 1
                const productName = match[4]?.trim()

                // Find matching product
                const product = products.find(p =>
                    p.name.toLowerCase().includes(productName) ||
                    productName.includes(p.name.toLowerCase())
                )

                if (product) {
                    onCommand?.({ action: 'add_item', product, quantity: qty })
                    responseText = `Added ${qty} ${product.unit} of ${product.name} to cart`
                } else {
                    responseText = `Sorry, I couldn't find ${productName} in inventory`
                }
            } else {
                responseText = `Please say: Add [quantity] [product name]`
            }
        }
        // Stock enquiry
        else if (lowerText.includes('stock') || lowerText.includes('how much') || lowerText.includes('kitna')) {
            const productName = lowerText.replace(/stock|how much|kitna|of|है|left/gi, '').trim()
            const product = products.find(p =>
                p.name.toLowerCase().includes(productName) ||
                productName.includes(p.name.toLowerCase())
            )

            if (product) {
                responseText = `${product.name} has ${product.stock} ${product.unit} in stock`
                if (product.stock <= product.minStock) {
                    responseText += `. Warning: Stock is low!`
                }
            } else {
                responseText = `Sorry, I couldn't find that product`
            }
        }
        // Price enquiry
        else if (lowerText.includes('price') || lowerText.includes('cost') || lowerText.includes('कीमत') || lowerText.includes('விலை')) {
            const productName = lowerText.replace(/price|cost|of|is|what|कीमत|விலை/gi, '').trim()
            const product = products.find(p =>
                p.name.toLowerCase().includes(productName) ||
                productName.includes(p.name.toLowerCase())
            )

            if (product) {
                responseText = `${product.name} is ₹${product.price} per ${product.unit}`
            } else {
                responseText = `Sorry, I couldn't find that product`
            }
        }
        // Today's sales
        else if (lowerText.includes('sales') || lowerText.includes('today') || lowerText.includes('aaj')) {
            const demoSales = 24580
            responseText = `Today's total sales are ₹${demoSales.toLocaleString()}`
        }
        // Create bill
        else if (lowerText.includes('new bill') || lowerText.includes('create bill') || lowerText.includes('billing')) {
            onNavigate?.('create-bill')
            responseText = 'Opening billing page...'
        }
        // Help
        else if (lowerText.includes('help') || lowerText.includes('मदद')) {
            responseText = 'You can say: Add 2 kg rice, Check stock of sugar, What is price of dal, Today sales, or Go to dashboard'
        }
        // Default
        else {
            responseText = `I heard: ${text}. Say "help" for available commands.`
        }

        addToConversation('assistant', responseText)
        setResponse(responseText)

        if (isSpeaking) {
            speak(responseText)
        }

        setIsProcessing(false)
        setTranscript('')
    }

    const addToConversation = (role, text) => {
        setConversation(prev => [...prev.slice(-10), { role, text, time: new Date() }])
    }

    const startCallMode = () => {
        setMode('call')
        setIsOpen(true)
        startListening()
        speak('Hello! Welcome to KadaiGPT. How can I help you today?')
        addToConversation('assistant', 'Hello! Welcome to KadaiGPT. How can I help you today?')
    }

    const endCall = () => {
        stopListening()
        setMode('chat')
        speak('Thank you for using KadaiGPT. Goodbye!')
        setTimeout(() => setIsOpen(false), 2000)
    }

    return (
        <>
            {/* Floating Action Button */}
            <button
                className={`voice-fab ${isListening ? 'listening' : ''}`}
                onClick={() => setIsOpen(true)}
            >
                <Bot size={24} />
                {isListening && <span className="pulse-ring"></span>}
            </button>

            {/* Voice Assistant Panel */}
            {isOpen && (
                <div className="voice-panel">
                    <div className="voice-header">
                        <div className="voice-title">
                            <Bot size={20} />
                            <span>KadaiGPT Assistant</span>
                        </div>
                        <div className="voice-controls">
                            <button
                                className={`control-btn ${isSpeaking ? 'active' : ''}`}
                                onClick={() => setIsSpeaking(!isSpeaking)}
                                title={isSpeaking ? 'Mute' : 'Unmute'}
                            >
                                {isSpeaking ? <Volume2 size={18} /> : <VolumeX size={18} />}
                            </button>
                            <button className="control-btn close" onClick={() => { setIsOpen(false); stopListening(); }}>
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Mode Tabs */}
                    <div className="mode-tabs">
                        <button
                            className={`mode-tab ${mode === 'chat' ? 'active' : ''}`}
                            onClick={() => setMode('chat')}
                        >
                            <MessageCircle size={16} /> Chat
                        </button>
                        <button
                            className={`mode-tab ${mode === 'call' ? 'active' : ''}`}
                            onClick={startCallMode}
                        >
                            <Phone size={16} /> Call Mode
                        </button>
                    </div>

                    {/* Conversation */}
                    <div className="voice-conversation">
                        {conversation.length === 0 ? (
                            <div className="voice-empty">
                                <Sparkles size={32} />
                                <p>Hi! I'm your AI assistant.</p>
                                <span>Try saying: "Add 2 kg rice" or "Check stock of sugar"</span>
                            </div>
                        ) : (
                            conversation.map((msg, i) => (
                                <div key={i} className={`voice-message ${msg.role}`}>
                                    <div className="message-content">{msg.text}</div>
                                </div>
                            ))
                        )}
                        {isProcessing && (
                            <div className="voice-message assistant">
                                <Loader2 size={16} className="spin" />
                            </div>
                        )}
                    </div>

                    {/* Transcript Display */}
                    {transcript && (
                        <div className="voice-transcript">
                            <span className="label">Listening:</span>
                            <span className="text">{transcript}</span>
                        </div>
                    )}

                    {/* Controls */}
                    <div className="voice-actions">
                        {mode === 'call' ? (
                            <button className="btn btn-danger end-call-btn" onClick={endCall}>
                                <Phone size={18} /> End Call
                            </button>
                        ) : (
                            <button
                                className={`mic-btn ${isListening ? 'active' : ''}`}
                                onClick={isListening ? stopListening : startListening}
                            >
                                {isListening ? <MicOff size={24} /> : <Mic size={24} />}
                                <span>{isListening ? 'Stop' : 'Start'} Listening</span>
                            </button>
                        )}
                    </div>

                    {/* Quick Commands */}
                    <div className="quick-commands">
                        <span className="label">Quick commands:</span>
                        <div className="commands-list">
                            <button onClick={() => processCommand('Today sales')}>📊 Today's Sales</button>
                            <button onClick={() => processCommand('Help')}>❓ Help</button>
                            <button onClick={() => processCommand('Go to billing')}>🧾 New Bill</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .voice-fab {
          position: fixed;
          bottom: 100px;
          right: 20px;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          border: 3px solid rgba(255,255,255,0.2);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 32px rgba(249, 115, 22, 0.5), 0 0 0 4px rgba(249, 115, 22, 0.2);
          z-index: 1000;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .voice-fab::before {
          content: 'AI';
          position: absolute;
          top: -8px;
          right: -8px;
          background: #22c55e;
          color: white;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
        }
        .voice-fab:hover { 
          transform: scale(1.1) translateY(-4px); 
          box-shadow: 0 12px 40px rgba(249, 115, 22, 0.6), 0 0 0 6px rgba(249, 115, 22, 0.3);
        }
        .voice-fab.listening { 
          animation: pulse 1.5s infinite;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          box-shadow: 0 8px 32px rgba(34, 197, 94, 0.5);
        }
        .pulse-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border: 3px solid var(--primary-400);
          border-radius: 50%;
          animation: pulse-ring 1.5s infinite;
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
          50% { box-shadow: 0 0 0 20px rgba(34, 197, 94, 0); }
        }
        
        /* Mobile specific positioning */
        @media (max-width: 768px) {
          .voice-fab {
            bottom: 140px;
            right: 16px;
            width: 60px;
            height: 60px;
          }
        }
        @media (max-width: 480px) {
          .voice-fab {
            bottom: 150px;
            right: 12px;
            width: 56px;
            height: 56px;
          }
        }

        .voice-panel {
          position: fixed;
          bottom: 100px;
          right: 24px;
          width: 380px;
          max-height: 600px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-2xl);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
          z-index: 1001;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .voice-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: var(--gradient-primary);
          color: white;
        }
        .voice-title { display: flex; align-items: center; gap: 10px; font-weight: 600; }
        .voice-controls { display: flex; gap: 8px; }
        .control-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .control-btn.active { background: rgba(255,255,255,0.3); }
        .control-btn.close:hover { background: rgba(239, 68, 68, 0.8); }

        .mode-tabs { display: flex; border-bottom: 1px solid var(--border-subtle); }
        .mode-tab {
          flex: 1;
          padding: 12px;
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 500;
          transition: all var(--transition-fast);
        }
        .mode-tab:hover { background: var(--bg-tertiary); }
        .mode-tab.active { color: var(--primary-400); border-bottom: 2px solid var(--primary-400); }

        .voice-conversation {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 200px;
          max-height: 300px;
        }
        .voice-empty { text-align: center; color: var(--text-tertiary); padding: 32px; }
        .voice-empty p { margin: 12px 0 4px; font-weight: 500; color: var(--text-secondary); }
        .voice-empty span { font-size: 0.8125rem; }

        .voice-message { max-width: 85%; padding: 10px 14px; border-radius: var(--radius-lg); font-size: 0.9375rem; }
        .voice-message.user { background: var(--primary-400); color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
        .voice-message.assistant { background: var(--bg-tertiary); align-self: flex-start; border-bottom-left-radius: 4px; }

        .voice-transcript {
          padding: 12px 16px;
          background: var(--bg-tertiary);
          border-top: 1px solid var(--border-subtle);
          font-size: 0.875rem;
        }
        .voice-transcript .label { color: var(--text-tertiary); margin-right: 8px; }
        .voice-transcript .text { color: var(--primary-400); font-weight: 500; }

        .voice-actions { padding: 16px; display: flex; justify-content: center; }
        .mic-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 28px;
          background: var(--bg-tertiary);
          border: 2px solid var(--border-subtle);
          border-radius: var(--radius-xl);
          color: var(--text-primary);
          cursor: pointer;
          font-weight: 500;
          transition: all var(--transition-fast);
        }
        .mic-btn:hover { border-color: var(--primary-400); }
        .mic-btn.active { background: rgba(239, 68, 68, 0.1); border-color: var(--error); color: var(--error); }
        .end-call-btn { width: 100%; justify-content: center; }

        .quick-commands { padding: 12px 16px; border-top: 1px solid var(--border-subtle); }
        .quick-commands .label { font-size: 0.75rem; color: var(--text-tertiary); display: block; margin-bottom: 8px; }
        .commands-list { display: flex; gap: 8px; flex-wrap: wrap; }
        .commands-list button {
          padding: 6px 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          font-size: 0.8125rem;
          cursor: pointer;
          color: var(--text-secondary);
          transition: all var(--transition-fast);
        }
        .commands-list button:hover { border-color: var(--primary-400); color: var(--primary-400); }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
        </>
    )
}
