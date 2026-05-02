import { useState, useRef, useEffect } from 'react'
import {
    Brain, Bot, Cpu, Zap, TrendingUp, Package, Users,
    Mic, MicOff, Send, X, ChevronRight, Settings,
    BarChart3, Workflow, MessageSquare, Sparkles,
    RefreshCw, CheckCircle, AlertCircle, Clock,
    Volume2, VolumeX, Loader2, Target, Lightbulb,
    Activity, GitBranch, GraduationCap, Globe
} from 'lucide-react'

// Agent definitions with capabilities
const agents = {
    store_manager: {
        id: "store_manager",
        name: "Store Manager",
        shortName: "Manager",
        icon: Brain,
        color: "#8b5cf6",
        gradient: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
        description: "Central AI orchestrator",
        capabilities: ["Natural language queries", "Goal decomposition", "Agent coordination"]
    },
    inventory: {
        id: "inventory",
        name: "Inventory Agent",
        shortName: "Inventory",
        icon: Package,
        color: "#22c55e",
        gradient: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
        description: "Autonomous stock management",
        capabilities: ["Stock predictions", "Reorder automation", "Anomaly detection"]
    },
    analytics: {
        id: "analytics",
        name: "Analytics Agent",
        shortName: "Analytics",
        icon: BarChart3,
        color: "#f59e0b",
        gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        description: "ML-powered insights",
        capabilities: ["Sales forecast", "Trend analysis", "What-if scenarios"]
    },
    customer: {
        id: "customer",
        name: "Customer Agent",
        shortName: "Customer",
        icon: Users,
        color: "#3b82f6",
        gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
        description: "WhatsApp automation",
        capabilities: ["Auto-response", "Campaigns", "Complaint handling"]
    },
    voice: {
        id: "voice",
        name: "Voice Agent",
        shortName: "Voice",
        icon: Mic,
        color: "#ec4899",
        gradient: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
        description: "Multi-lingual voice",
        capabilities: ["Hindi/Tamil/Telugu", "Hands-free billing", "Voice commands"]
    },
    learning: {
        id: "learning",
        name: "Learning Agent",
        shortName: "Learning",
        icon: GraduationCap,
        color: "#14b8a6",
        gradient: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
        description: "Continuous improvement",
        capabilities: ["Learn from feedback", "Preference adaptation", "Pattern recognition"]
    }
}

// Quick actions for each agent
const quickActions = {
    store_manager: [
        "What's my sales today?",
        "Give me a store overview",
        "What needs my attention?"
    ],
    inventory: [
        "Show low stock items",
        "Predict next week's needs",
        "Generate reorder list"
    ],
    analytics: [
        "Forecast next 7 days",
        "Find trends in my data",
        "Run what-if: 20% discount"
    ],
    customer: [
        "Send offers to loyal customers",
        "How's customer engagement?",
        "Check inactive customers"
    ],
    voice: [
        "Start voice billing (Hindi)",
        "चावल 2 किलो add करो",
        "What's the total?"
    ],
    learning: [
        "What have you learned?",
        "Show behavior patterns",
        "Personalized suggestions"
    ]
}

export default function AIAgentControlCenter({ addToast, setCurrentPage }) {
    const [isOpen, setIsOpen] = useState(false)
    const [activeAgent, setActiveAgent] = useState('store_manager')
    const [input, setInput] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [messages, setMessages] = useState([])
    const [isListening, setIsListening] = useState(false)
    const [voiceEnabled, setVoiceEnabled] = useState(true)
    const [agentStatuses, setAgentStatuses] = useState({})
    const [workflows, setWorkflows] = useState([])
    const [insights, setInsights] = useState([])
    const [showWorkflows, setShowWorkflows] = useState(false)
    const [learningStats, setLearningStats] = useState(null)

    const messagesEndRef = useRef(null)
    const recognitionRef = useRef(null)
    const wsRef = useRef(null)

    // Initialize
    useEffect(() => {
        if (isOpen) {
            fetchAgentStatuses()
            fetchInsights()
            fetchWorkflows()
            initWebSocket()
            initSpeechRecognition()

            // Add welcome message
            if (messages.length === 0) {
                setMessages([{
                    id: Date.now(),
                    type: 'agent',
                    agent: 'store_manager',
                    text: "🧠 **Welcome to AI Agent Control Center**\n\nI'm your Store Manager AI, coordinating 6 specialized agents:\n\n• 📦 Inventory Agent\n• 📊 Analytics Agent\n• 👥 Customer Agent\n• 🎤 Voice Agent\n• 🎓 Learning Agent\n\nAsk me anything or select an agent to talk directly!",
                    timestamp: new Date()
                }])
            }
        }

        return () => wsRef.current?.close()
    }, [isOpen])

    // Auto scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const initWebSocket = () => {
        try {
            const ws = new WebSocket('ws://localhost:8000/api/v1/agents/ws/1')

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data)
                handleWebSocketMessage(data)
            }

            wsRef.current = ws
        } catch (e) {
            console.log('WebSocket not available')
        }
    }

    const handleWebSocketMessage = (data) => {
        if (data.type === 'response') {
            addAgentMessage(data.data)
        } else if (data.type === 'suggestions') {
            setInsights(data.data || [])
        }
    }

    const initSpeechRecognition = () => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
            recognitionRef.current = new SpeechRecognition()
            recognitionRef.current.continuous = false
            recognitionRef.current.interimResults = false
            recognitionRef.current.lang = activeAgent === 'voice' ? 'hi-IN' : 'en-IN'

            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript
                setInput(transcript)
                setIsListening(false)
                // Auto-send voice input
                setTimeout(() => sendMessage(transcript), 300)
            }

            recognitionRef.current.onerror = () => setIsListening(false)
            recognitionRef.current.onend = () => setIsListening(false)
        }
    }

    const fetchAgentStatuses = async () => {
        try {
            const res = await fetch('/api/v1/agents/status')
            if (res.ok) {
                const data = await res.json()
                setAgentStatuses(data.agents || {})
            }
        } catch (e) {
            console.log('Agent status fetch failed')
        }
    }

    const fetchInsights = async () => {
        try {
            const res = await fetch('/api/v1/agents/suggestions')
            if (res.ok) {
                const data = await res.json()
                setInsights(data.suggestions || [])
            }
        } catch (e) {
            // Use demo insights
            setInsights([
                { type: "inventory", priority: "high", title: "Low Stock Alert", message: "3 items need restocking" },
                { type: "trend", priority: "medium", title: "Sales Trend", message: "Saturday sales 32% higher" }
            ])
        }
    }

    const fetchWorkflows = async () => {
        try {
            const res = await fetch('/api/v1/agents/workflows')
            if (res.ok) {
                const data = await res.json()
                setWorkflows(data.workflows || [])
            }
        } catch (e) {
            // Demo workflows
            setWorkflows([
                { id: "daily_report", name: "Daily Morning Report", enabled: true, run_count: 28 },
                { id: "low_stock_alert", name: "Low Stock Auto-Alert", enabled: true, run_count: 15 },
                { id: "eod_auto_close", name: "End of Day Auto-Close", enabled: true, run_count: 30 }
            ])
        }
    }

    const sendMessage = async (overrideText = null) => {
        const messageText = overrideText || input
        if (!messageText.trim() || isProcessing) return

        // Add user message
        const userMsg = {
            id: Date.now(),
            type: 'user',
            text: messageText,
            timestamp: new Date()
        }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setIsProcessing(true)

        try {
            let endpoint = '/api/v1/agents/query'
            let body = { message: messageText, agent_type: activeAgent }

            // Special handling for voice agent
            if (activeAgent === 'voice') {
                endpoint = '/api/v1/agents/voice/command'
                body = { text: messageText, language: 'hi' }
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            let responseData
            if (res.ok) {
                responseData = await res.json()
            } else {
                responseData = generateFallbackResponse(messageText, activeAgent)
            }

            addAgentMessage(responseData)

            // Text-to-speech for voice agent
            if (activeAgent === 'voice' && voiceEnabled && responseData.response?.spoken_response) {
                speak(responseData.response.spoken_response)
            }

        } catch (e) {
            addAgentMessage(generateFallbackResponse(messageText, activeAgent))
        } finally {
            setIsProcessing(false)
        }
    }

    const addAgentMessage = (data) => {
        const text = formatResponse(data)

        setMessages(prev => [...prev, {
            id: Date.now(),
            type: 'agent',
            agent: activeAgent,
            text,
            data,
            timestamp: new Date()
        }])
    }

    const formatResponse = (data) => {
        if (!data) return "I processed your request."
        if (typeof data === 'string') return data

        // Handle different response structures
        if (data.response?.spoken_response) return data.response.spoken_response
        if (data.response?.message) return data.response.message
        if (data.response?.response) return data.response.response

        // Analytics responses
        if (data.response?.insights) {
            return `💡 **AI Insights**\n\n${data.response.insights.map(i =>
                `${i.category === 'trend' ? '📈' : i.category === 'risk' ? '⚠️' : '💎'} **${i.title}**\n${i.description}`
            ).join('\n\n')}`
        }

        if (data.response?.predictions) {
            const preds = data.response.predictions.slice(0, 5)
            return `🔮 **Predictions**\n\n${preds.map(p =>
                `• ${p.product || p.day}: ₹${p.predicted_sales?.toLocaleString('en-IN') || p.predicted_demand}`
            ).join('\n')}`
        }

        if (data.response?.summary) {
            return `📊 **Summary**\n\n${JSON.stringify(data.response.summary, null, 2)}`
        }

        // Fallback
        return JSON.stringify(data.response || data, null, 2).substring(0, 500)
    }

    const generateFallbackResponse = (query, agent) => {
        const q = query.toLowerCase()
        const responses = {
            store_manager: {
                sales: "📊 **Today's Performance**\n\n💰 Sales: ₹24,580\n🧾 Bills: 47\n👥 Customers: 38\n📈 Avg Bill: ₹523",
                stock: "📦 **Inventory Status**\n\n⚠️ 3 items low\n✅ 120 healthy\n🔮 Predictions available",
                default: "I'm your Store Manager AI. I can help with sales, inventory, analytics, and more!"
            },
            inventory: {
                low: "⚠️ **Low Stock Items**\n\n• Toor Dal: 8kg (Min: 15)\n• Salt: 5kg (Min: 20)\n• Milk: 15L (Min: 50)",
                predict: "🔮 **7-Day Forecast**\n\n• Milk: Need 150L\n• Rice: Need 30kg\n• Dal: Need 22kg",
                default: "I manage your inventory autonomously. Ask about stock, predictions, or reorders!"
            },
            analytics: {
                forecast: "📈 **Sales Forecast**\n\nNext 7 days: ₹1,85,000\nConfidence: 87%\nBest day: Saturday",
                trend: "📊 **Trends**\n\n• Saturday +32%\n• Dairy growing 18%\n• Morning slow (-40%)",
                default: "I provide ML-powered insights. Ask for forecasts, trends, or what-if analysis!"
            },
            customer: {
                engagement: "👥 **Engagement Stats**\n\n• Messages today: 45\n• Automation: 92%\n• Satisfaction: 4.5/5",
                default: "I handle customer interactions on WhatsApp. Ask about engagement or campaigns!"
            },
            voice: {
                default: "🎤 I understand Hindi, Tamil, Telugu, and English.\n\nTry: 'चावल 2 किलो add करो' or 'What's the total?'"
            },
            learning: {
                learned: "🎓 **Learning Stats**\n\n• Patterns learned: 15\n• Accuracy: 92%\n• Improvement: +14% this week",
                default: "I learn from your corrections and feedback to improve over time!"
            }
        }

        const agentResponses = responses[agent] || responses.store_manager

        for (const [key, response] of Object.entries(agentResponses)) {
            if (key !== 'default' && q.includes(key)) {
                return { response: { message: response } }
            }
        }

        return { response: { message: agentResponses.default } }
    }

    const speak = (text) => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text)
            utterance.lang = 'hi-IN'
            utterance.rate = 1
            window.speechSynthesis.speak(utterance)
        }
    }

    const toggleVoice = () => {
        if (isListening) {
            recognitionRef.current?.stop()
        } else {
            recognitionRef.current.lang = activeAgent === 'voice' ? 'hi-IN' : 'en-IN'
            recognitionRef.current?.start()
            setIsListening(true)
        }
    }

    const handleQuickAction = (action) => {
        setInput(action)
        setTimeout(() => sendMessage(action), 100)
    }

    const AgentIcon = agents[activeAgent]?.icon || Brain

    return (
        <>
            {/* Floating Button */}
            <button
                className={`agent-control-fab ${isOpen ? 'hidden' : ''}`}
                onClick={() => setIsOpen(true)}
                aria-label="Open AI Agent Control Center"
            >
                <Cpu size={24} />
                <span className="fab-label">AI Agents</span>
                {insights.length > 0 && (
                    <span className="fab-notification">{insights.length}</span>
                )}
            </button>

            {/* Control Center */}
            {isOpen && (
                <div className="agent-control-center">
                    {/* Header */}
                    <div className="acc-header" style={{ background: agents[activeAgent].gradient }}>
                        <div className="acc-title">
                            <div className="acc-avatar">
                                <AgentIcon size={22} />
                            </div>
                            <div>
                                <h3>{agents[activeAgent].name}</h3>
                                <span className="acc-subtitle">{agents[activeAgent].description}</span>
                            </div>
                        </div>
                        <div className="acc-header-actions">
                            <button
                                className={`icon-btn ${showWorkflows ? 'active' : ''}`}
                                onClick={() => setShowWorkflows(!showWorkflows)}
                                title="Workflows"
                            >
                                <Workflow size={16} />
                            </button>
                            <button className="icon-btn close" onClick={() => setIsOpen(false)}>
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Agent Selector */}
                    <div className="acc-agents">
                        {Object.values(agents).map(agent => (
                            <button
                                key={agent.id}
                                className={`agent-chip ${activeAgent === agent.id ? 'active' : ''}`}
                                onClick={() => setActiveAgent(agent.id)}
                                style={{ '--agent-color': agent.color }}
                                title={agent.description}
                            >
                                <agent.icon size={14} />
                                <span>{agent.shortName}</span>
                            </button>
                        ))}
                    </div>

                    {/* Workflow Panel */}
                    {showWorkflows && (
                        <div className="acc-workflows">
                            <div className="workflows-header">
                                <GitBranch size={14} />
                                Automated Workflows
                            </div>
                            {workflows.slice(0, 4).map(wf => (
                                <div key={wf.id} className="workflow-item">
                                    <span className={`wf-status ${wf.enabled ? 'active' : ''}`}></span>
                                    <span className="wf-name">{wf.name}</span>
                                    <span className="wf-runs">{wf.run_count}×</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Proactive Insights */}
                    {insights.length > 0 && !showWorkflows && messages.length <= 1 && (
                        <div className="acc-insights">
                            <div className="insights-header">
                                <Zap size={14} /> Live Insights
                            </div>
                            {insights.slice(0, 2).map((insight, i) => (
                                <div key={i} className={`insight-card ${insight.priority}`}>
                                    <strong>{insight.title}</strong>
                                    <span>{insight.message}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Messages */}
                    <div className="acc-messages">
                        {messages.map(msg => (
                            <div key={msg.id} className={`acc-message ${msg.type}`}>
                                {msg.type === 'agent' && (
                                    <div
                                        className="msg-avatar"
                                        style={{ background: agents[msg.agent]?.gradient || agents.store_manager.gradient }}
                                    >
                                        {(() => {
                                            const Icon = agents[msg.agent]?.icon || Brain
                                            return <Icon size={12} />
                                        })()}
                                    </div>
                                )}
                                <div className="msg-content">
                                    <div
                                        className="msg-text"
                                        dangerouslySetInnerHTML={{
                                            __html: msg.text
                                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                                .replace(/\n/g, '<br>')
                                        }}
                                    />
                                    <div className="msg-time">
                                        {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isProcessing && (
                            <div className="acc-message agent">
                                <div className="msg-avatar thinking" style={{ background: agents[activeAgent].gradient }}>
                                    <Loader2 size={12} className="spin" />
                                </div>
                                <div className="msg-content thinking">
                                    <Activity size={14} className="pulse" />
                                    <span>Agent reasoning...</span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Actions */}
                    {messages.length <= 2 && (
                        <div className="acc-quick-actions">
                            {quickActions[activeAgent]?.map((action, i) => (
                                <button
                                    key={i}
                                    className="quick-action-btn"
                                    onClick={() => handleQuickAction(action)}
                                >
                                    {action}
                                    <ChevronRight size={14} />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="acc-input-area">
                        <div className="acc-input-wrapper">
                            <input
                                type="text"
                                placeholder={`Ask ${agents[activeAgent].shortName}...`}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                disabled={isProcessing}
                            />

                            {activeAgent === 'voice' && (
                                <button
                                    className={`input-btn ${voiceEnabled ? 'active' : ''}`}
                                    onClick={() => setVoiceEnabled(!voiceEnabled)}
                                    title="Toggle voice responses"
                                >
                                    {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                                </button>
                            )}

                            <button
                                className={`input-btn voice ${isListening ? 'listening' : ''}`}
                                onClick={toggleVoice}
                                title="Voice input"
                            >
                                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                            </button>

                            <button
                                className="input-btn send"
                                onClick={() => sendMessage()}
                                disabled={!input.trim() || isProcessing}
                                style={{ background: agents[activeAgent].gradient }}
                            >
                                {isProcessing ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                            </button>
                        </div>

                        {/* Agent capabilities */}
                        <div className="acc-capabilities">
                            {agents[activeAgent].capabilities.map((cap, i) => (
                                <span key={i} className="capability-tag">{cap}</span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .agent-control-fab {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    padding: 14px 20px;
                    border-radius: 50px;
                    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
                    border: none;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    box-shadow: 0 8px 30px rgba(139, 92, 246, 0.4);
                    z-index: 999;
                    transition: all 0.3s ease;
                    font-weight: 600;
                    font-size: 0.875rem;
                }
                .agent-control-fab:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(139, 92, 246, 0.5); }
                .agent-control-fab.hidden { display: none; }
                .agent-control-fab .fab-notification {
                    position: absolute;
                    top: -6px;
                    right: -6px;
                    width: 20px;
                    height: 20px;
                    background: #ef4444;
                    border-radius: 50%;
                    font-size: 0.7rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: pulse 2s infinite;
                }

                .agent-control-center {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    width: 440px;
                    height: 650px;
                    background: var(--bg-primary);
                    border-radius: 20px;
                    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5);
                    display: flex;
                    flex-direction: column;
                    z-index: 1001;
                    overflow: hidden;
                    border: 1px solid var(--border-subtle);
                    animation: slideUp 0.35s cubic-bezier(0.4, 0, 0.2, 1);
                }

                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(30px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                .acc-header {
                    padding: 18px;
                    color: white;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .acc-title { display: flex; align-items: center; gap: 12px; }
                .acc-avatar {
                    width: 44px; height: 44px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 14px;
                    display: flex; align-items: center; justify-content: center;
                    backdrop-filter: blur(10px);
                }
                .acc-title h3 { margin: 0; font-size: 1.1rem; font-weight: 700; }
                .acc-subtitle { font-size: 0.75rem; opacity: 0.85; }
                
                .acc-header-actions { display: flex; gap: 8px; }
                .icon-btn {
                    width: 32px; height: 32px;
                    background: rgba(255,255,255,0.15);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                }
                .icon-btn:hover, .icon-btn.active { background: rgba(255,255,255,0.3); }

                .acc-agents {
                    display: flex;
                    gap: 6px;
                    padding: 10px 12px;
                    border-bottom: 1px solid var(--border-subtle);
                    overflow-x: auto;
                    background: var(--bg-secondary);
                }
                .acc-agents::-webkit-scrollbar { height: 0; }
                
                .agent-chip {
                    padding: 7px 12px;
                    border-radius: 20px;
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-subtle);
                    color: var(--text-secondary);
                    font-size: 0.75rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    white-space: nowrap;
                    transition: all 0.2s;
                }
                .agent-chip:hover { border-color: var(--agent-color); color: var(--agent-color); }
                .agent-chip.active {
                    background: var(--agent-color);
                    border-color: var(--agent-color);
                    color: white;
                }

                .acc-workflows {
                    padding: 10px 12px;
                    background: var(--bg-tertiary);
                    border-bottom: 1px solid var(--border-subtle);
                }
                .workflows-header {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: var(--text-tertiary);
                    margin-bottom: 8px;
                }
                .workflow-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 0;
                    font-size: 0.8rem;
                }
                .wf-status { width: 6px; height: 6px; border-radius: 50%; background: #ef4444; }
                .wf-status.active { background: #22c55e; }
                .wf-name { flex: 1; }
                .wf-runs { font-size: 0.7rem; color: var(--text-tertiary); }

                .acc-insights {
                    padding: 10px 12px;
                    background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05));
                    border-bottom: 1px solid var(--border-subtle);
                }
                .insights-header {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: #f59e0b;
                    margin-bottom: 8px;
                }
                .insight-card {
                    padding: 8px 10px;
                    background: var(--bg-card);
                    border-radius: 8px;
                    margin-bottom: 6px;
                    border-left: 3px solid #f59e0b;
                }
                .insight-card.high { border-left-color: #ef4444; }
                .insight-card strong { display: block; font-size: 0.8rem; }
                .insight-card span { font-size: 0.7rem; color: var(--text-secondary); }

                .acc-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .acc-message {
                    display: flex;
                    gap: 8px;
                    max-width: 92%;
                }
                .acc-message.user { align-self: flex-end; flex-direction: row-reverse; }
                .acc-message.agent { align-self: flex-start; }

                .msg-avatar {
                    width: 26px; height: 26px;
                    border-radius: 8px;
                    display: flex; align-items: center; justify-content: center;
                    color: white;
                    flex-shrink: 0;
                }
                .msg-avatar.thinking { animation: thinking-pulse 1.5s ease infinite; }
                @keyframes thinking-pulse {
                    0%, 100% { opacity: 0.7; }
                    50% { opacity: 1; }
                }

                .msg-content {
                    padding: 10px 14px;
                    border-radius: 14px;
                    font-size: 0.8125rem;
                    line-height: 1.5;
                }
                .acc-message.agent .msg-content {
                    background: var(--bg-secondary);
                    border-bottom-left-radius: 4px;
                }
                .acc-message.user .msg-content {
                    background: linear-gradient(135deg, #8b5cf6, #6366f1);
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                .msg-content.thinking {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: var(--bg-tertiary);
                    color: var(--text-secondary);
                }
                .msg-time { font-size: 0.625rem; color: var(--text-tertiary); margin-top: 4px; }

                .acc-quick-actions {
                    padding: 8px 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    border-top: 1px solid var(--border-subtle);
                    background: var(--bg-secondary);
                    max-height: 140px;
                    overflow-y: auto;
                }
                .quick-action-btn {
                    padding: 10px 12px;
                    background: var(--bg-card);
                    border: 1px solid var(--border-subtle);
                    border-radius: 10px;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 0.8125rem;
                    transition: all 0.2s;
                    text-align: left;
                }
                .quick-action-btn:hover {
                    border-color: #8b5cf6;
                    background: rgba(139, 92, 246, 0.1);
                }

                .acc-input-area {
                    padding: 12px;
                    border-top: 1px solid var(--border-subtle);
                    background: var(--bg-secondary);
                }
                .acc-input-wrapper {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                .acc-input-wrapper input {
                    flex: 1;
                    padding: 12px 14px;
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    background: var(--bg-card);
                    font-size: 0.875rem;
                    outline: none;
                }
                .acc-input-wrapper input:focus { border-color: #8b5cf6; }

                .input-btn {
                    width: 38px; height: 38px;
                    border-radius: 10px;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    background: var(--bg-tertiary);
                    color: var(--text-secondary);
                }
                .input-btn:hover { background: var(--bg-hover); }
                .input-btn.active { color: #8b5cf6; }
                .input-btn.voice.listening { 
                    background: #ef4444; 
                    color: white;
                    animation: pulse 1s infinite;
                }
                .input-btn.send {
                    color: white;
                }
                .input-btn.send:disabled { opacity: 0.5; cursor: not-allowed; }

                .acc-capabilities {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin-top: 10px;
                }
                .capability-tag {
                    padding: 3px 8px;
                    background: var(--bg-tertiary);
                    border-radius: 12px;
                    font-size: 0.65rem;
                    color: var(--text-tertiary);
                }

                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                .pulse { animation: pulse 2s ease infinite; }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }

                @media (max-width: 480px) {
                    .agent-control-fab { bottom: 80px; right: 16px; padding: 12px 16px; }
                    .agent-control-fab .fab-label { display: none; }
                    .agent-control-center {
                        bottom: 0; right: 0; left: 0;
                        width: 100%; height: 100%;
                        border-radius: 0;
                    }
                }
            `}</style>
        </>
    )
}
