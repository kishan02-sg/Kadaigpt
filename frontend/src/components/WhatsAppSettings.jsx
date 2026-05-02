/**
 * WhatsApp Integration Settings Component
 * Allows users to configure CallMeBot, Green API, or Manual WhatsApp
 */

import { useState, useEffect } from 'react'
import { MessageSquare, Check, AlertCircle, Settings, Send, ExternalLink, Copy, Loader2 } from 'lucide-react'
import waIntegration from '../services/waIntegration'

export default function WhatsAppSettings({ addToast }) {
    const [config, setConfig] = useState({
        provider: 'manual',
        phone: '',
        apiKey: '',
        instanceId: ''
    })
    const [testing, setTesting] = useState(false)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        // Load existing config
        const currentConfig = waIntegration.getConfig()
        setConfig({
            provider: localStorage.getItem('kadai_wa_provider') || 'manual',
            phone: localStorage.getItem('kadai_owner_phone') || '',
            apiKey: localStorage.getItem('kadai_wa_api_key') || '',
            instanceId: localStorage.getItem('kadai_wa_instance_id') || ''
        })
    }, [])

    const handleSave = () => {
        waIntegration.setProvider(config.provider)
        waIntegration.setCredentials({
            phone: config.phone,
            apiKey: config.apiKey,
            instanceId: config.instanceId
        })
        setSaved(true)
        addToast?.('WhatsApp settings saved!', 'success')
        setTimeout(() => setSaved(false), 2000)
    }

    const handleTest = async () => {
        if (!config.phone) {
            addToast?.('Please enter your phone number first', 'error')
            return
        }

        setTesting(true)

        const testMessage = `✅ *KadaiGPT Test Message*

This is a test message from your KadaiGPT WhatsApp integration.

If you received this, your setup is working correctly! 🎉

_Sent at ${new Date().toLocaleTimeString('en-IN')}_`

        try {
            const result = await waIntegration.sendMessage(config.phone, testMessage)

            if (result.success) {
                if (result.provider === 'manual') {
                    addToast?.('WhatsApp opened! Send the message to complete test.', 'info')
                } else {
                    addToast?.('Test message sent successfully!', 'success')
                }
            } else {
                addToast?.(`Failed: ${result.error}`, 'error')
            }
        } catch (error) {
            addToast?.(`Error: ${error.message}`, 'error')
        } finally {
            setTesting(false)
        }
    }

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
        addToast?.('Copied to clipboard!', 'success')
    }

    const providers = [
        {
            id: 'manual',
            name: 'Manual (WhatsApp Web)',
            description: 'Opens WhatsApp Web with pre-filled message. You click send.',
            free: true,
            setup: 'No setup needed'
        },
        {
            id: 'callmebot',
            name: 'CallMeBot',
            description: 'Free unlimited WhatsApp API. Messages sent automatically.',
            free: true,
            setup: 'Send activation message to get API key'
        },
        {
            id: 'greenapi',
            name: 'Green API',
            description: '500 messages/month free. Professional API.',
            free: true,
            setup: 'Scan QR code to connect your WhatsApp'
        }
    ]

    return (
        <div className="wa-settings">
            <div className="wa-settings-header">
                <MessageSquare className="wa-icon" size={24} />
                <div>
                    <h3>WhatsApp Integration</h3>
                    <p>Configure automated WhatsApp notifications</p>
                </div>
            </div>

            {/* Provider Selection */}
            <div className="wa-section">
                <h4>Choose Provider</h4>
                <div className="provider-grid">
                    {providers.map(provider => (
                        <div
                            key={provider.id}
                            className={`provider-card ${config.provider === provider.id ? 'selected' : ''}`}
                            onClick={() => setConfig({ ...config, provider: provider.id })}
                        >
                            <div className="provider-header">
                                <span className="provider-name">{provider.name}</span>
                                {provider.free && <span className="free-badge">FREE</span>}
                            </div>
                            <p className="provider-desc">{provider.description}</p>
                            <small className="provider-setup">{provider.setup}</small>
                            {config.provider === provider.id && (
                                <Check className="selected-check" size={20} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Phone Number */}
            <div className="wa-section">
                <h4>Your WhatsApp Number</h4>
                <div className="input-group">
                    <span className="input-prefix">+91</span>
                    <input
                        type="tel"
                        placeholder="9876543210"
                        value={config.phone.replace(/^91/, '')}
                        onChange={(e) => setConfig({ ...config, phone: '91' + e.target.value.replace(/\D/g, '') })}
                        maxLength={10}
                    />
                </div>
                <small>This number will receive all notifications</small>
            </div>

            {/* CallMeBot Setup */}
            {config.provider === 'callmebot' && (
                <div className="wa-section setup-section">
                    <h4>CallMeBot Setup</h4>

                    <div className="setup-steps">
                        <div className="step">
                            <span className="step-num">1</span>
                            <div className="step-content">
                                <p>Save this number in your contacts:</p>
                                <div className="copy-box">
                                    <code>+34 644 71 80 04</code>
                                    <button onClick={() => copyToClipboard('+34644718004')}>
                                        <Copy size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="step">
                            <span className="step-num">2</span>
                            <div className="step-content">
                                <p>Send this message via WhatsApp:</p>
                                <div className="copy-box">
                                    <code>I allow callmebot to send me messages</code>
                                    <button onClick={() => copyToClipboard('I allow callmebot to send me messages')}>
                                        <Copy size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="step">
                            <span className="step-num">3</span>
                            <div className="step-content">
                                <p>Enter the API key you receive:</p>
                                <input
                                    type="text"
                                    placeholder="Your API Key (e.g., 1234567)"
                                    value={config.apiKey}
                                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Green API Setup */}
            {config.provider === 'greenapi' && (
                <div className="wa-section setup-section">
                    <h4>Green API Setup</h4>

                    <div className="setup-steps">
                        <div className="step">
                            <span className="step-num">1</span>
                            <div className="step-content">
                                <p>Create free account at Green API:</p>
                                <a href="https://green-api.com" target="_blank" rel="noopener noreferrer" className="external-link">
                                    green-api.com <ExternalLink size={14} />
                                </a>
                            </div>
                        </div>

                        <div className="step">
                            <span className="step-num">2</span>
                            <div className="step-content">
                                <p>Enter your Instance ID:</p>
                                <input
                                    type="text"
                                    placeholder="e.g., 1101234567"
                                    value={config.instanceId}
                                    onChange={(e) => setConfig({ ...config, instanceId: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="step">
                            <span className="step-num">3</span>
                            <div className="step-content">
                                <p>Enter your API Token:</p>
                                <input
                                    type="text"
                                    placeholder="Your apiTokenInstance"
                                    value={config.apiKey}
                                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="wa-actions">
                <button className="btn btn-secondary" onClick={handleTest} disabled={testing}>
                    {testing ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                    Test Connection
                </button>
                <button className="btn btn-primary" onClick={handleSave}>
                    {saved ? <Check size={18} /> : <Settings size={18} />}
                    {saved ? 'Saved!' : 'Save Settings'}
                </button>
            </div>

            <style>{`
                .wa-settings {
                    background: var(--bg-card);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-xl);
                    padding: 24px;
                }

                .wa-settings-header {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 24px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid var(--border-subtle);
                }

                .wa-settings-header .wa-icon {
                    color: #25D366;
                }

                .wa-settings-header h3 {
                    margin: 0;
                    font-size: 1.25rem;
                }

                .wa-settings-header p {
                    margin: 4px 0 0;
                    color: var(--text-tertiary);
                    font-size: 0.875rem;
                }

                .wa-section {
                    margin-bottom: 24px;
                }

                .wa-section h4 {
                    margin: 0 0 12px;
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .provider-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 12px;
                }

                .provider-card {
                    position: relative;
                    background: var(--bg-tertiary);
                    border: 2px solid var(--border-subtle);
                    border-radius: var(--radius-lg);
                    padding: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .provider-card:hover {
                    border-color: var(--border-default);
                }

                .provider-card.selected {
                    border-color: #25D366;
                    background: rgba(37, 211, 102, 0.05);
                }

                .provider-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 8px;
                }

                .provider-name {
                    font-weight: 600;
                }

                .free-badge {
                    background: #25D366;
                    color: white;
                    font-size: 0.625rem;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: 700;
                }

                .provider-desc {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    margin: 0 0 8px;
                }

                .provider-setup {
                    font-size: 0.75rem;
                    color: var(--text-tertiary);
                }

                .selected-check {
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    color: #25D366;
                }

                .input-group {
                    display: flex;
                    align-items: center;
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-default);
                    border-radius: var(--radius-md);
                    overflow: hidden;
                }

                .input-prefix {
                    padding: 12px 16px;
                    background: var(--bg-secondary);
                    color: var(--text-secondary);
                    font-weight: 500;
                }

                .input-group input {
                    flex: 1;
                    padding: 12px 16px;
                    border: none;
                    background: transparent;
                    color: var(--text-primary);
                    font-size: 1rem;
                }

                .wa-section small {
                    display: block;
                    margin-top: 8px;
                    color: var(--text-tertiary);
                    font-size: 0.75rem;
                }

                .setup-section {
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-lg);
                    padding: 20px;
                }

                .setup-steps {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .step {
                    display: flex;
                    gap: 16px;
                }

                .step-num {
                    width: 28px;
                    height: 28px;
                    background: #25D366;
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 0.875rem;
                    flex-shrink: 0;
                }

                .step-content {
                    flex: 1;
                }

                .step-content p {
                    margin: 0 0 8px;
                    font-size: 0.875rem;
                }

                .step-content input {
                    width: 100%;
                    padding: 10px 14px;
                    background: var(--bg-primary);
                    border: 1px solid var(--border-default);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.875rem;
                }

                .copy-box {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: var(--bg-primary);
                    padding: 8px 12px;
                    border-radius: var(--radius-md);
                    border: 1px solid var(--border-subtle);
                }

                .copy-box code {
                    flex: 1;
                    font-size: 0.875rem;
                }

                .copy-box button {
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 4px;
                }

                .copy-box button:hover {
                    color: var(--text-primary);
                }

                .external-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    color: #25D366;
                    text-decoration: none;
                    font-weight: 500;
                }

                .external-link:hover {
                    text-decoration: underline;
                }

                .wa-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 24px;
                    padding-top: 20px;
                    border-top: 1px solid var(--border-subtle);
                }

                .wa-actions .btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
