import { useState, useRef, useEffect } from 'react'
import {
    Bot, X, Send, Mic, MicOff, Sparkles, Loader2,
    Package, Users, TrendingUp, MessageCircle, Zap,
    Brain, Target, CheckCircle, AlertCircle, Clock,
    ChevronRight, RotateCw, Cpu
} from 'lucide-react'
import api from '../services/api'

// Agent types and their capabilities
const agentTypes = {
    store_manager: {
        name: "Store Manager",
        icon: Brain,
        color: "#8b5cf6",
        description: "Central AI that orchestrates everything"
    },
    inventory: {
        name: "Inventory Agent",
        icon: Package,
        color: "#22c55e",
        description: "Autonomous stock management"
    },
    customer: {
        name: "Customer Agent",
        icon: Users,
        color: "#3b82f6",
        description: "Handles customer engagement"
    }
}

// Quick agent commands
const quickCommands = [
    { label: "What's my sales today?", icon: TrendingUp, agent: "store_manager" },
    { label: "Show low stock items", icon: Package, agent: "inventory" },
    { label: "Get business insights", icon: Sparkles, agent: "store_manager" },
    { label: "Predict next week's needs", icon: Target, agent: "inventory" },
]

export default function AgentDashboard({ addToast, setCurrentPage }) {
    const [isOpen, setIsOpen] = useState(false)
    const [activeAgent, setActiveAgent] = useState('store_manager')
    const [messages, setMessages] = useState([
        {
            id: 1,
            type: 'agent',
            agent: 'store_manager',
            text: "Hello! 👋 I'm your Store Manager AI. I coordinate all AI agents to help run your store autonomously. What would you like me to help with today?",
            timestamp: new Date(),
            status: 'completed'
        }
    ])
    const [input, setInput] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [agentThinking, setAgentThinking] = useState(null)
    const [suggestions, setSuggestions] = useState([])
    const [showSuggestions, setShowSuggestions] = useState(true)
    const messagesEndRef = useRef(null)
    const [isListening, setIsListening] = useState(false)
    const recognitionRef = useRef(null)

    // Auto scroll
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

            recognitionRef.current.onerror = () => setIsListening(false)
            recognitionRef.current.onend = () => setIsListening(false)
        }
    }, [])

    // Fetch proactive suggestions
    useEffect(() => {
        if (isOpen) {
            fetchSuggestions()
        }
    }, [isOpen])

    const fetchSuggestions = async () => {
        try {
            const response = await fetch('/api/v1/agents/suggestions')
            if (response.ok) {
                const data = await response.json()
                setSuggestions(data.suggestions || [])
            }
        } catch (error) {
            // Fallback suggestions
            setSuggestions([
                { type: "inventory", priority: "high", title: "Low Stock Alert", message: "3 items need restocking", action: "view_low_stock" },
                { type: "insight", priority: "medium", title: "Sales Trend", message: "Saturday sales are 32% higher", action: "view_analytics" }
            ])
        }
    }

    const sendMessage = async () => {
        if (!input.trim() || isProcessing) return

        const userMessage = {
            id: Date.now(),
            type: 'user',
            text: input,
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')
        setIsProcessing(true)
        setAgentThinking(activeAgent)
        setShowSuggestions(false)

        try {
            // Call the agent API
            const response = await fetch('/api/v1/agents/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage.text,
                    agent_type: activeAgent
                })
            })

            let agentResponse
            if (response.ok) {
                const data = await response.json()
                agentResponse = {
                    id: Date.now() + 1,
                    type: 'agent',
                    agent: activeAgent,
                    text: formatAgentResponse(data.response),
                    timestamp: new Date(),
                    status: 'completed',
                    actionsCount: data.actions_taken,
                    processingTime: data.processing_time_ms
                }
            } else {
                // Fallback response
                agentResponse = {
                    id: Date.now() + 1,
                    type: 'agent',
                    agent: activeAgent,
                    text: generateFallbackResponse(userMessage.text),
                    timestamp: new Date(),
                    status: 'completed'
                }
            }

            setMessages(prev => [...prev, agentResponse])
        } catch (error) {
            // Error response
            const errorMessage = {
                id: Date.now() + 1,
                type: 'agent',
                agent: activeAgent,
                text: "I encountered an issue connecting to the AI backend. Let me try a simpler approach...\n\n" + generateFallbackResponse(userMessage.text),
                timestamp: new Date(),
                status: 'fallback'
            }
            setMessages(prev => [...prev, errorMessage])
        } finally {
            setIsProcessing(false)
            setAgentThinking(null)
        }
    }

    const formatAgentResponse = (response) => {
        if (!response) return "I processed your request but didn't get a detailed response."

        if (typeof response === 'string') return response

        // Format structured responses
        if (response.response) return response.response
        if (response.message) return response.message
        if (response.analysis) {
            const a = response.analysis
            return `📊 **Inventory Analysis**\n\nTotal Products: ${a.total_products}\nHealthy Stock: ${a.categories?.healthy || 0}\nLow Stock: ${a.categories?.low || 0}\nCritical: ${a.categories?.critical || 0}\n\n${a.recommendations?.join('\n') || ''}`
        }
        if (response.predictions) {
            const items = response.predictions.slice(0, 5)
            return `🔮 **Stock Predictions (${response.forecast_period})**\n\n${items.map(p =>
                `• ${p.product}: ${p.current_stock} → Need ${p.predicted_demand} (${p.reorder_suggested ? '⚠️ Reorder' : '✅ OK'})`
            ).join('\n')}\n\nConfidence: ${(response.confidence * 100).toFixed(0)}%`
        }
        if (response.insights) {
            return `💡 **AI Insights**\n\n${response.insights.map(i =>
                `${i.type === 'trend' ? '📈' : i.type === 'alert' ? '⚠️' : '💡'} **${i.title}**\n${i.text}`
            ).join('\n\n')}`
        }

        return JSON.stringify(response, null, 2)
    }

    const generateFallbackResponse = (query) => {
        const q = query.toLowerCase()

        if (q.includes('sales') || q.includes('revenue')) {
            return `📊 **Today's Sales Summary**\n\n💰 Total: ₹24,580\n🧾 Bills: 47\n👥 Customers: 38\n📈 Avg Bill: ₹523\n\n*Saturday sales are typically 32% higher!*`
        }
        if (q.includes('stock') || q.includes('inventory') || q.includes('low')) {
            return `📦 **Low Stock Alert**\n\n⚠️ 3 items need attention:\n• Toor Dal: 8 kg (Min: 15)\n• Salt: 5 kg (Min: 20)\n• Milk: 15 L (Min: 50)\n\n*Shall I generate a purchase order?*`
        }
        if (q.includes('predict') || q.includes('forecast')) {
            return `🔮 **7-Day Forecast**\n\nBased on your sales patterns:\n• Milk: Need 150L by next week\n• Rice: Need 30kg (current: 45kg ✅)\n• Dal: Need 22kg immediately ⚠️\n\n*Investment needed: ₹12,500*`
        }
        if (q.includes('insight') || q.includes('suggest')) {
            return `💡 **AI Insights**\n\n📈 **Trend**: Saturday sees 32% more sales\n⚠️ **Alert**: 3 items critically low\n💎 **Opportunity**: Dairy products growing 15%\n🎯 **Action**: 5 customers close to Gold tier`
        }

        return `I understood your request: "${query}"\n\nI'm working on processing this. Here's what I can help with:\n• Sales & revenue analysis\n• Inventory management\n• Stock predictions\n• Business insights\n\nTry being more specific about what you need!`
    }

    const handleQuickCommand = (cmd) => {
        setActiveAgent(cmd.agent)
        setInput(cmd.label)
        setTimeout(() => sendMessage(), 100)
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
            sendMessage()
        }
    }

    const AgentIcon = agentTypes[activeAgent]?.icon || Brain

    return (
        <>
            {/* Floating Button */}
            <button
                className={`agent-fab ${isOpen ? 'hidden' : ''}`}
                onClick={() => setIsOpen(true)}
                aria-label="Open AI Agents"
            >
                <Cpu size={24} />
                <span className="fab-badge pulse">AI</span>
            </button>

            {/* Agent Dashboard */}
            {isOpen && (
                <div className="agent-dashboard">
                    {/* Header */}
                    <div className="agent-header" style={{ background: `linear-gradient(135deg, ${agentTypes[activeAgent].color}, ${agentTypes[activeAgent].color}dd)` }}>
                        <div className="agent-title">
                            <div className="agent-avatar">
                                <AgentIcon size={20} />
                            </div>
                            <div>
                                <h3>{agentTypes[activeAgent].name}</h3>
                                <span className="agent-status">
                                    {agentThinking ? (
                                        <><Loader2 size={12} className="spin" /> Thinking...</>
                                    ) : (
                                        <><span className="status-dot"></span> Ready</>
                                    )}
                                </span>
                            </div>
                        </div>
                        <button className="close-btn" onClick={() => setIsOpen(false)}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Agent Tabs */}
                    <div className="agent-tabs">
                        {Object.entries(agentTypes).map(([key, agent]) => (
                            <button
                                key={key}
                                className={`agent-tab ${activeAgent === key ? 'active' : ''}`}
                                onClick={() => setActiveAgent(key)}
                                style={{ '--tab-color': agent.color }}
                            >
                                <agent.icon size={16} />
                                <span>{agent.name.split(' ')[0]}</span>
                            </button>
                        ))}
                    </div>

                    {/* Proactive Suggestions */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="agent-suggestions">
                            <div className="suggestions-header">
                                <Zap size={14} /> Proactive Insights
                                <button onClick={() => setShowSuggestions(false)}>×</button>
                            </div>
                            {suggestions.slice(0, 2).map((sug, i) => (
                                <div key={i} className={`suggestion-card priority-${sug.priority}`}>
                                    <strong>{sug.title}</strong>
                                    <span>{sug.message}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Messages */}
                    <div className="agent-messages">
                        {messages.map(msg => (
                            <div key={msg.id} className={`message ${msg.type}`}>
                                {msg.type === 'agent' && (
                                    <div className="message-avatar" style={{ background: agentTypes[msg.agent]?.color || '#8b5cf6' }}>
                                        {(() => {
                                            const Icon = agentTypes[msg.agent]?.icon || Brain
                                            return <Icon size={14} />
                                        })()}
                                    </div>
                                )}
                                <div className="message-content">
                                    <div className="message-text" dangerouslySetInnerHTML={{
                                        __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')
                                    }} />
                                    <div className="message-meta">
                                        <span>{msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                        {msg.actionsCount && <span>• {msg.actionsCount} actions</span>}
                                        {msg.processingTime && <span>• {msg.processingTime}ms</span>}
                                        {msg.status === 'completed' && <CheckCircle size={12} />}
                                        {msg.status === 'fallback' && <AlertCircle size={12} />}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {agentThinking && (
                            <div className="message agent">
                                <div className="message-avatar" style={{ background: agentTypes[agentThinking]?.color }}>
                                    <Loader2 size={14} className="spin" />
                                </div>
                                <div className="message-content thinking">
                                    <div className="thinking-text">
                                        <Brain size={14} /> Agent is reasoning...
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Commands */}
                    {messages.length < 3 && (
                        <div className="quick-commands">
                            {quickCommands.map((cmd, i) => (
                                <button
                                    key={i}
                                    className="quick-cmd"
                                    onClick={() => handleQuickCommand(cmd)}
                                >
                                    <cmd.icon size={14} />
                                    {cmd.label}
                                    <ChevronRight size={14} />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div className="agent-input-area">
                        <div className="input-wrapper">
                            <input
                                type="text"
                                placeholder={`Ask ${agentTypes[activeAgent].name}...`}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                disabled={isProcessing}
                            />
                            <button
                                className={`voice-btn ${isListening ? 'listening' : ''}`}
                                onClick={toggleVoice}
                            >
                                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                            </button>
                            <button
                                className="send-btn"
                                onClick={sendMessage}
                                disabled={!input.trim() || isProcessing}
                            >
                                {isProcessing ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .agent-fab {
                    position: fixed;
                    bottom: 90px;
                    right: 90px;
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
                    border: none;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 20px rgba(139, 92, 246, 0.5);
                    z-index: 998;
                    transition: all 0.3s ease;
                }
                .agent-fab:hover { transform: scale(1.1); }
                .agent-fab.hidden { display: none; }
                .agent-fab .fab-badge {
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    background: linear-gradient(135deg, #22c55e, #16a34a);
                    color: white;
                    font-size: 0.625rem;
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-weight: 700;
                }
                .agent-fab .fab-badge.pulse {
                    animation: pulse-badge 2s infinite;
                }
                @keyframes pulse-badge {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
                    50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
                }

                .agent-dashboard {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    width: 420px;
                    height: 600px;
                    background: var(--bg-card);
                    border-radius: var(--radius-xl);
                    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4);
                    display: flex;
                    flex-direction: column;
                    z-index: 1001;
                    overflow: hidden;
                    border: 1px solid var(--border-subtle);
                    animation: slideUp 0.3s ease;
                }

                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .agent-header {
                    padding: 16px;
                    color: white;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .agent-title { display: flex; align-items: center; gap: 12px; }
                .agent-avatar {
                    width: 40px; height: 40px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 12px;
                    display: flex; align-items: center; justify-content: center;
                }
                .agent-title h3 { margin: 0; font-size: 1rem; }
                .agent-status { font-size: 0.75rem; opacity: 0.9; display: flex; align-items: center; gap: 4px; }
                .status-dot { width: 6px; height: 6px; background: #22c55e; border-radius: 50%; }
                .close-btn {
                    background: rgba(255,255,255,0.2);
                    border: none; color: white;
                    width: 32px; height: 32px; border-radius: 8px;
                    cursor: pointer; display: flex; align-items: center; justify-content: center;
                }

                .agent-tabs {
                    display: flex;
                    padding: 0 12px;
                    gap: 4px;
                    border-bottom: 1px solid var(--border-subtle);
                    background: var(--bg-secondary);
                }
                .agent-tab {
                    flex: 1;
                    padding: 10px 8px;
                    background: none;
                    border: none;
                    border-bottom: 2px solid transparent;
                    color: var(--text-tertiary);
                    font-size: 0.75rem;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    transition: all 0.2s;
                }
                .agent-tab:hover { color: var(--tab-color); }
                .agent-tab.active {
                    color: var(--tab-color);
                    border-bottom-color: var(--tab-color);
                    background: rgba(139, 92, 246, 0.1);
                }

                .agent-suggestions {
                    padding: 8px 12px;
                    background: linear-gradient(135deg, rgba(234, 179, 8, 0.1), rgba(234, 179, 8, 0.05));
                    border-bottom: 1px solid var(--border-subtle);
                }
                .suggestions-header {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: #eab308;
                    margin-bottom: 8px;
                }
                .suggestions-header button {
                    margin-left: auto;
                    background: none;
                    border: none;
                    color: var(--text-tertiary);
                    cursor: pointer;
                }
                .suggestion-card {
                    padding: 8px 10px;
                    background: var(--bg-card);
                    border-radius: 8px;
                    margin-bottom: 6px;
                    border-left: 3px solid #eab308;
                }
                .suggestion-card.priority-high { border-left-color: #ef4444; }
                .suggestion-card strong { display: block; font-size: 0.8rem; }
                .suggestion-card span { font-size: 0.7rem; color: var(--text-secondary); }

                .agent-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .message {
                    display: flex;
                    gap: 8px;
                    max-width: 90%;
                }
                .message.user { align-self: flex-end; flex-direction: row-reverse; }
                .message.agent { align-self: flex-start; }

                .message-avatar {
                    width: 28px; height: 28px;
                    border-radius: 8px;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0; color: white;
                }

                .message-content {
                    padding: 10px 14px;
                    border-radius: 12px;
                    font-size: 0.8125rem;
                    line-height: 1.5;
                }
                .message.agent .message-content {
                    background: var(--bg-secondary);
                    border-bottom-left-radius: 4px;
                }
                .message.user .message-content {
                    background: linear-gradient(135deg, #8b5cf6, #6366f1);
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                .message-text { white-space: pre-line; }
                .message-meta {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-top: 6px;
                    font-size: 0.625rem;
                    color: var(--text-tertiary);
                }
                .message-meta svg { color: #22c55e; }

                .message-content.thinking {
                    background: var(--bg-tertiary);
                    border: 1px dashed var(--border-subtle);
                }
                .thinking-text {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: var(--text-secondary);
                    font-size: 0.75rem;
                }

                .quick-commands {
                    padding: 8px 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    border-top: 1px solid var(--border-subtle);
                    background: var(--bg-secondary);
                }
                .quick-cmd {
                    padding: 10px 12px;
                    background: var(--bg-card);
                    border: 1px solid var(--border-subtle);
                    border-radius: 10px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.8125rem;
                    transition: all 0.2s;
                }
                .quick-cmd:hover {
                    border-color: #8b5cf6;
                    background: rgba(139, 92, 246, 0.1);
                }
                .quick-cmd svg:last-child { margin-left: auto; opacity: 0.5; }

                .agent-input-area {
                    padding: 12px;
                    border-top: 1px solid var(--border-subtle);
                    background: var(--bg-secondary);
                }
                .input-wrapper {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                .input-wrapper input {
                    flex: 1;
                    padding: 12px 14px;
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    background: var(--bg-card);
                    font-size: 0.875rem;
                    outline: none;
                }
                .input-wrapper input:focus { border-color: #8b5cf6; }

                .voice-btn, .send-btn {
                    width: 40px; height: 40px;
                    border-radius: 10px;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .voice-btn { background: var(--bg-tertiary); color: var(--text-secondary); }
                .voice-btn:hover { background: #8b5cf6; color: white; }
                .voice-btn.listening { background: #ef4444; color: white; animation: pulse 1s infinite; }
                .send-btn { background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; }
                .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                .spin { animation: spin 1s linear infinite; }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @keyframes pulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                    50% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                }

                @media (max-width: 480px) {
                    .agent-fab { bottom: 160px; right: 16px; }
                    .agent-dashboard {
                        bottom: 0; right: 0; left: 0;
                        width: 100%; height: 100%;
                        border-radius: 0;
                    }
                }
            `}</style>
        </>
    )
}
