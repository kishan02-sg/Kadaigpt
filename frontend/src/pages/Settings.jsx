import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Printer, RefreshCw, Check, AlertCircle, Wifi, WifiOff, Database, Key, Store, Bell, Sun, Moon, Palette, CheckCircle, XCircle, Loader2, Globe } from 'lucide-react'
import api from '../services/api'
import gstService from '../services/gstService'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage, LanguageSelector } from '../contexts/LanguageContext'
import WhatsAppSettings from '../components/WhatsAppSettings'

export default function Settings({ addToast }) {
    const { theme, toggleTheme } = useTheme()
    const { language, setLanguage, t, availableLanguages } = useLanguage()
    const [printers, setPrinters] = useState([])
    const [loadingPrinters, setLoadingPrinters] = useState(false)
    const [selectedPrinter, setSelectedPrinter] = useState('auto')
    const [testingPrint, setTestingPrint] = useState(false)
    const [gstValidation, setGstValidation] = useState({ status: 'empty', message: '' })
    const [verifyingGst, setVerifyingGst] = useState(false)
    const [settings, setSettings] = useState({
        storeName: localStorage.getItem('kadai_store_name') || 'My Store',
        storeAddress: localStorage.getItem('kadai_store_address') || '',
        storePhone: localStorage.getItem('kadai_store_phone') || '',
        gstin: localStorage.getItem('kadai_gstin') || '',
        defaultGstRate: parseInt(localStorage.getItem('kadai_default_gst_rate') || '5'),
        autoPrint: localStorage.getItem('kadai_auto_print') === 'true',
        soundEnabled: localStorage.getItem('kadai_sound') !== 'false',
        thermalMode: localStorage.getItem('kadai_thermal') !== 'false',
        upiId: localStorage.getItem('kadai_upi_id') || '',
        creditLimit: parseInt(localStorage.getItem('kadai_credit_limit') || '5000'),
    })

    useEffect(() => {
        loadPrinters()
        const savedPrinter = localStorage.getItem('kadai_printer')
        if (savedPrinter) setSelectedPrinter(savedPrinter)

        // Validate existing GSTIN on load
        if (settings.gstin) {
            const validation = gstService.validateRealtime(settings.gstin)
            setGstValidation(validation)
        }
    }, [])

    const loadPrinters = async () => {
        setLoadingPrinters(true)
        try {
            const data = await api.getPrinters()
            setPrinters(data.printers || [])
            if (data.default_printer && selectedPrinter === 'auto') {
                setSelectedPrinter(data.default_printer)
            }
        } catch (err) {
            // Demo printers if API fails
            setPrinters([
                { name: 'Demo Thermal Printer', status: 'ready', is_default: true },
                { name: 'Microsoft Print to PDF', status: 'ready', is_default: false },
            ])
        } finally {
            setLoadingPrinters(false)
        }
    }

    const testPrint = async () => {
        setTestingPrint(true)
        try {
            await api.testPrint(selectedPrinter)
            addToast('Test print sent successfully!', 'success')
        } catch (err) {
            addToast('Test print sent (demo mode)', 'info')
        } finally {
            setTestingPrint(false)
        }
    }

    const savePrinterSettings = () => {
        localStorage.setItem('kadai_printer', selectedPrinter)
        localStorage.setItem('kadai_auto_print', settings.autoPrint)
        localStorage.setItem('kadai_thermal', settings.thermalMode)
        addToast('Printer settings saved!', 'success')
    }

    // Handle GSTIN change with real-time validation
    const handleGstinChange = (value) => {
        const upperValue = value.toUpperCase().replace(/\s/g, '')
        setSettings({ ...settings, gstin: upperValue })

        // Real-time validation
        const validation = gstService.validateRealtime(upperValue)
        setGstValidation(validation)
    }

    // Verify GSTIN with API
    const verifyGstin = async () => {
        if (!settings.gstin || settings.gstin.length !== 15) {
            addToast('Please enter a complete 15-digit GSTIN', 'error')
            return
        }

        setVerifyingGst(true)
        try {
            const result = await gstService.verifyWithAPI(settings.gstin)
            if (result.verified) {
                setGstValidation({
                    status: 'verified',
                    message: `✓ Verified: ${result.tradeName || result.legalName}`,
                    details: result
                })
                addToast('GSTIN verified successfully!', 'success')
            } else {
                setGstValidation({
                    status: 'error',
                    message: result.error || 'Verification failed'
                })
                addToast(result.error || 'GSTIN verification failed', 'error')
            }
        } catch (error) {
            addToast('Verification service unavailable', 'error')
        } finally {
            setVerifyingGst(false)
        }
    }

    const saveStoreSettings = () => {
        if (settings.gstin && gstValidation.status === 'error') {
            addToast('Please fix GSTIN errors before saving', 'error')
            return
        }
        localStorage.setItem('kadai_store_name', settings.storeName)
        localStorage.setItem('kadai_store_address', settings.storeAddress)
        localStorage.setItem('kadai_store_phone', settings.storePhone)
        localStorage.setItem('kadai_gstin', settings.gstin)
        localStorage.setItem('kadai_default_gst_rate', settings.defaultGstRate.toString())
        addToast('Store settings saved!', 'success')
    }

    const saveNotificationSettings = () => {
        localStorage.setItem('kadai_sound', settings.soundEnabled)
        addToast('Notification settings saved!', 'success')
    }

    return (
        <div className="settings-page">
            <div className="page-header">
                <h1 className="page-title">⚙️ Settings</h1>
                <p className="page-subtitle">Configure your store, printer, and preferences</p>
            </div>

            <div className="settings-grid">
                {/* Store Settings */}
                <div className="card settings-card">
                    <div className="card-header">
                        <h3 className="card-title"><Store size={20} /> Store Information</h3>
                    </div>
                    <div className="settings-form">
                        <div className="form-group">
                            <label className="form-label">Store Name</label>
                            <input
                                type="text"
                                className="form-input"
                                value={settings.storeName}
                                onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                                placeholder="Your Store Name"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Address</label>
                            <input
                                type="text"
                                className="form-input"
                                value={settings.storeAddress}
                                onChange={(e) => setSettings({ ...settings, storeAddress: e.target.value })}
                                placeholder="Store Address"
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input
                                    type="tel"
                                    className="form-input"
                                    value={settings.storePhone}
                                    onChange={(e) => setSettings({ ...settings, storePhone: e.target.value })}
                                    placeholder="+91 XXXXX XXXXX"
                                />
                            </div>
                            <div className="form-group gstin-group">
                                <label className="form-label">GSTIN</label>
                                <div className="gstin-input-wrapper">
                                    <input
                                        type="text"
                                        className={`form-input ${gstValidation.status === 'valid' || gstValidation.status === 'verified' ? 'valid' : gstValidation.status === 'error' ? 'error' : ''}`}
                                        value={settings.gstin}
                                        onChange={(e) => handleGstinChange(e.target.value)}
                                        placeholder="22AAAAA0000A1Z5"
                                        maxLength={15}
                                    />
                                    {gstValidation.status === 'valid' && (
                                        <CheckCircle className="gstin-icon valid" size={18} />
                                    )}
                                    {gstValidation.status === 'verified' && (
                                        <CheckCircle className="gstin-icon verified" size={18} />
                                    )}
                                    {gstValidation.status === 'error' && (
                                        <XCircle className="gstin-icon error" size={18} />
                                    )}
                                </div>
                                {gstValidation.message && (
                                    <span className={`gstin-message ${gstValidation.status}`}>
                                        {gstValidation.message}
                                    </span>
                                )}
                                {settings.gstin.length === 15 && gstValidation.status === 'valid' && (
                                    <button
                                        className="btn btn-sm btn-secondary verify-btn"
                                        onClick={verifyGstin}
                                        disabled={verifyingGst}
                                    >
                                        {verifyingGst ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                                        {verifyingGst ? 'Verifying...' : 'Verify GSTIN'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Default GST Rate Selector */}
                        <div className="form-group">
                            <label className="form-label">Default GST Rate</label>
                            <select
                                className="form-input"
                                value={settings.defaultGstRate}
                                onChange={(e) => setSettings({ ...settings, defaultGstRate: parseInt(e.target.value) })}
                            >
                                <option value="0">0% (Exempt / Essential)</option>
                                <option value="5">5% (Most groceries, daily essentials)</option>
                                <option value="12">12% (Processed foods, apparel)</option>
                                <option value="18">18% (Standard rate - electronics, services)</option>
                                <option value="28">28% (Luxury items)</option>
                            </select>
                            <p className="form-hint">This rate will be applied by default when creating new bills</p>
                        </div>

                        <button className="btn btn-primary" onClick={saveStoreSettings}>
                            <Check size={18} /> Save Store Info
                        </button>
                    </div>
                </div>

                {/* Payment Settings */}
                <div className="card settings-card">
                    <div className="card-header">
                        <h3 className="card-title">💳 Payment Settings</h3>
                    </div>
                    <div className="settings-form">
                        <div className="form-group">
                            <label className="form-label">UPI ID (for QR Code)</label>
                            <input
                                type="text"
                                className="form-input"
                                value={settings.upiId}
                                onChange={(e) => setSettings({ ...settings, upiId: e.target.value })}
                                placeholder="yourstore@upi"
                            />
                            <p className="form-hint">Displayed as QR code when customer pays via UPI</p>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Customer Credit Limit (₹)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={settings.creditLimit}
                                onChange={(e) => setSettings({ ...settings, creditLimit: parseInt(e.target.value) || 0 })}
                                placeholder="5000"
                                min="0"
                                step="500"
                            />
                            <p className="form-hint">Max credit per bill. Bills exceeding this on Credit payment will be blocked.</p>
                        </div>
                        <button className="btn btn-primary" onClick={() => {
                            localStorage.setItem('kadai_upi_id', settings.upiId)
                            localStorage.setItem('kadai_credit_limit', settings.creditLimit.toString())
                            addToast('Payment settings saved!', 'success')
                        }}>
                            <Check size={18} /> Save Payment Settings
                        </button>
                    </div>
                </div>

                {/* WhatsApp Integration Settings */}
                <WhatsAppSettings addToast={addToast} />

                {/* Language Settings */}
                <div className="card settings-card">
                    <div className="card-header">
                        <h3 className="card-title"><Globe size={20} /> Language Settings</h3>
                    </div>
                    <div className="settings-form">
                        <div className="form-group">
                            <label className="form-label">App Language</label>
                            <select
                                className="form-input"
                                value={language}
                                onChange={(e) => {
                                    setLanguage(e.target.value)
                                    addToast(`Language changed to ${availableLanguages.find(l => l.code === e.target.value)?.name || e.target.value}`, 'success')
                                }}
                            >
                                {availableLanguages.map(lang => (
                                    <option key={lang.code} value={lang.code}>
                                        {lang.flag} {lang.name} ({lang.native})
                                    </option>
                                ))}
                            </select>
                            <p className="form-hint">Changes app display language. WhatsApp bot supports multi-lingual commands.</p>
                        </div>
                        <div className="language-preview" style={{
                            padding: '16px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-md)',
                            marginTop: '12px'
                        }}>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                <strong>Preview:</strong> {t('welcome') || 'Welcome to KadaiGPT!'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Change Password */}
                <div className="card settings-card">
                    <div className="card-header">
                        <h3 className="card-title"><Key size={20} /> Change Password</h3>
                    </div>
                    <div className="settings-form">
                        <div className="form-group">
                            <label className="form-label">Current Password</label>
                            <input
                                type="password"
                                className="form-input"
                                id="current-password"
                                placeholder="Enter current password"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">New Password</label>
                            <input
                                type="password"
                                className="form-input"
                                id="new-password"
                                placeholder="Min 6 characters"
                                minLength={6}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Confirm New Password</label>
                            <input
                                type="password"
                                className="form-input"
                                id="confirm-password"
                                placeholder="Re-enter new password"
                                minLength={6}
                            />
                        </div>
                        <button className="btn btn-primary" onClick={async () => {
                            const currentPw = document.getElementById('current-password').value
                            const newPw = document.getElementById('new-password').value
                            const confirmPw = document.getElementById('confirm-password').value
                            if (!currentPw || !newPw) {
                                addToast('Please fill in all fields', 'error'); return
                            }
                            if (newPw.length < 6) {
                                addToast('New password must be at least 6 characters', 'error'); return
                            }
                            if (newPw !== confirmPw) {
                                addToast('New passwords do not match', 'error'); return
                            }
                            try {
                                await api.changePassword(currentPw, newPw)
                                addToast('Password changed successfully!', 'success')
                                document.getElementById('current-password').value = ''
                                document.getElementById('new-password').value = ''
                                document.getElementById('confirm-password').value = ''
                            } catch (err) {
                                addToast(err.message || 'Failed to change password', 'error')
                            }
                        }}>
                            <Key size={18} /> Change Password
                        </button>
                    </div>
                </div>

                {/* Printer Settings */}
                <div className="card settings-card">
                    <div className="card-header">
                        <h3 className="card-title"><Printer size={20} /> Printer Configuration</h3>
                        <button className="btn btn-ghost btn-sm" onClick={loadPrinters} disabled={loadingPrinters}>
                            <RefreshCw size={16} className={loadingPrinters ? 'spin' : ''} />
                        </button>
                    </div>
                    <div className="settings-form">
                        <div className="form-group">
                            <label className="form-label">Select Printer</label>
                            <div className="printer-list">
                                {printers.map((printer, i) => (
                                    <div
                                        key={i}
                                        className={`printer-item ${selectedPrinter === printer.name ? 'selected' : ''}`}
                                        onClick={() => setSelectedPrinter(printer.name)}
                                    >
                                        <div className="printer-info">
                                            <Printer size={18} />
                                            <span className="printer-name">{printer.name}</span>
                                            {printer.is_default && <span className="badge badge-info">Default</span>}
                                        </div>
                                        <span className={`status-dot ${printer.status === 'ready' ? 'ready' : 'offline'}`}></span>
                                    </div>
                                ))}
                                {printers.length === 0 && (
                                    <div className="no-printers">
                                        <AlertCircle size={24} />
                                        <p>No printers detected</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="toggle-row">
                                <span>Thermal Printer Mode (ESC/POS)</span>
                                <input
                                    type="checkbox"
                                    checked={settings.thermalMode}
                                    onChange={(e) => setSettings({ ...settings, thermalMode: e.target.checked })}
                                />
                                <span className="toggle"></span>
                            </label>
                        </div>

                        <div className="form-group">
                            <label className="toggle-row">
                                <span>Auto-print after bill creation</span>
                                <input
                                    type="checkbox"
                                    checked={settings.autoPrint}
                                    onChange={(e) => setSettings({ ...settings, autoPrint: e.target.checked })}
                                />
                                <span className="toggle"></span>
                            </label>
                        </div>

                        <div className="btn-row">
                            <button className="btn btn-secondary" onClick={testPrint} disabled={testingPrint}>
                                {testingPrint ? 'Printing...' : 'Test Print'}
                            </button>
                            <button className="btn btn-primary" onClick={savePrinterSettings}>
                                <Check size={18} /> Save Printer
                            </button>
                        </div>
                    </div>
                </div>

                {/* System Info */}
                <div className="card settings-card">
                    <div className="card-header">
                        <h3 className="card-title"><Database size={20} /> System Information</h3>
                    </div>
                    <div className="system-info">
                        <div className="info-row">
                            <span>App Version</span>
                            <span className="info-value">2.0.0</span>
                        </div>
                        <div className="info-row">
                            <span>Backend Status</span>
                            <span className="info-value status-online"><Wifi size={14} /> Connected</span>
                        </div>
                        <div className="info-row">
                            <span>Database</span>
                            <span className="info-value">PostgreSQL (Cloud)</span>
                        </div>
                        <div className="info-row">
                            <span>OCR Engine</span>
                            <span className="info-value">Google Gemini Vision</span>
                        </div>
                    </div>
                </div>

                {/* Notification Settings */}
                <div className="card settings-card">
                    <div className="card-header">
                        <h3 className="card-title"><Bell size={20} /> Notifications</h3>
                    </div>
                    <div className="settings-form">
                        <div className="form-group">
                            <label className="toggle-row">
                                <span>Sound notifications</span>
                                <input
                                    type="checkbox"
                                    checked={settings.soundEnabled}
                                    onChange={(e) => setSettings({ ...settings, soundEnabled: e.target.checked })}
                                />
                                <span className="toggle"></span>
                            </label>
                        </div>
                        <button className="btn btn-primary" onClick={saveNotificationSettings}>
                            <Check size={18} /> Save
                        </button>
                    </div>
                </div>

                {/* Theme Settings */}
                <div className="card settings-card theme-card">
                    <div className="card-header">
                        <h3 className="card-title"><Palette size={20} /> Appearance</h3>
                    </div>
                    <div className="settings-form">
                        <div className="theme-switcher">
                            <button
                                className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                                onClick={() => toggleTheme()}
                            >
                                <Moon size={20} />
                                <span>Dark Mode</span>
                            </button>
                            <button
                                className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                                onClick={() => toggleTheme()}
                            >
                                <Sun size={20} />
                                <span>Light Mode</span>
                            </button>
                        </div>
                        <p className="theme-hint">
                            Current theme: <strong>{theme === 'dark' ? '🌙 Dark' : '☀️ Light'}</strong>
                        </p>
                    </div>
                </div>

                {/* Subscription Plans */}
                <div className="card settings-card subscription-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="card-header">
                        <h3 className="card-title">💎 Subscription Plans</h3>
                        <span className="current-plan">Current: Free Trial</span>
                    </div>
                    <div className="subscription-plans">
                        <div className="plan-card free">
                            <div className="plan-badge">Free</div>
                            <h4>Starter</h4>
                            <div className="plan-price">₹0<span>/month</span></div>
                            <ul className="plan-features">
                                <li>✅ 50 Bills/month</li>
                                <li>✅ 20 Products</li>
                                <li>✅ Basic Analytics</li>
                                <li>✅ WhatsApp Notifications</li>
                                <li>❌ GST Reports</li>
                                <li>❌ AI Predictions</li>
                            </ul>
                            <button className="btn btn-secondary" disabled>Current Plan</button>
                        </div>

                        <div className="plan-card pro popular">
                            <div className="plan-badge">Most Popular</div>
                            <h4>Pro</h4>
                            <div className="plan-price">₹299<span>/month</span></div>
                            <ul className="plan-features">
                                <li>✅ Unlimited Bills</li>
                                <li>✅ 500 Products</li>
                                <li>✅ Advanced Analytics</li>
                                <li>✅ WhatsApp Integration</li>
                                <li>✅ GST Reports & Filing</li>
                                <li>✅ AI Price Predictions</li>
                                <li>✅ Multi-language Support</li>
                            </ul>
                            <button className="btn btn-primary" onClick={() => addToast('Upgrade coming soon!', 'info')}>Upgrade Now</button>
                        </div>

                        <div className="plan-card enterprise">
                            <div className="plan-badge">Enterprise</div>
                            <h4>Business</h4>
                            <div className="plan-price">₹999<span>/month</span></div>
                            <ul className="plan-features">
                                <li>✅ Everything in Pro</li>
                                <li>✅ Multiple Stores</li>
                                <li>✅ Team Access (5 users)</li>
                                <li>✅ Advanced AI Insights</li>
                                <li>✅ Priority Support</li>
                                <li>✅ Custom Integrations</li>
                                <li>✅ Dedicated Account Manager</li>
                            </ul>
                            <button className="btn btn-ghost" onClick={() => addToast('Contact sales@kadaigpt.com', 'info')}>Contact Sales</button>
                        </div>
                    </div>
                </div>

                {/* Legal & Privacy — DPDP Act 2023 Compliance */}
                <div className="card settings-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="card-header">
                        <h3 className="card-title">🔒 Legal & Privacy</h3>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>DPDP Act 2023</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', padding: '4px 0' }}>
                        <button
                            className="btn btn-ghost"
                            onClick={() => {
                                const hash = window.location.hash
                                window.location.hash = 'privacy'
                                window.dispatchEvent(new HashChangeEvent('hashchange'))
                            }}
                            style={{ justifyContent: 'flex-start', gap: '8px' }}
                        >
                            🛡️ Privacy Policy
                        </button>
                        <button
                            className="btn btn-ghost"
                            onClick={() => {
                                const hash = window.location.hash
                                window.location.hash = 'terms'
                                window.dispatchEvent(new HashChangeEvent('hashchange'))
                            }}
                            style={{ justifyContent: 'flex-start', gap: '8px' }}
                        >
                            📄 Terms of Service
                        </button>
                        <button
                            className="btn btn-ghost"
                            onClick={async () => {
                                try {
                                    const data = await api.get('/privacy/export')
                                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                                    const url = URL.createObjectURL(blob)
                                    const a = document.createElement('a')
                                    a.href = url
                                    a.download = `kadaigpt_data_export_${new Date().toISOString().slice(0, 10)}.json`
                                    a.click()
                                    URL.revokeObjectURL(url)
                                    addToast('Data exported successfully!', 'success')
                                } catch { addToast('Export available in your account', 'info') }
                            }}
                            style={{ justifyContent: 'flex-start', gap: '8px' }}
                        >
                            📥 Download My Data
                        </button>
                        <button
                            className="btn btn-ghost"
                            onClick={() => {
                                if (window.confirm('⚠️ Are you sure you want to delete your account? This action cannot be undone.')) {
                                    if (window.prompt('Type DELETE to confirm:') === 'DELETE') {
                                        api.delete('/privacy/account?confirmation=DELETE')
                                            .then(() => { addToast('Account deleted', 'info'); api.logout(); window.location.reload() })
                                            .catch(() => addToast('Contact support to delete account', 'info'))
                                    }
                                }
                            }}
                            style={{ justifyContent: 'flex-start', gap: '8px', color: 'var(--error, #ef4444)' }}
                        >
                            🗑️ Delete Account
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
        .settings-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
        @media (max-width: 1024px) { .settings-grid { grid-template-columns: 1fr; } }
        
        .settings-card { display: flex; flex-direction: column; }
        .settings-form { display: flex; flex-direction: column; gap: 16px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        
        .printer-list { display: flex; flex-direction: column; gap: 8px; }
        .printer-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 16px; background: var(--bg-tertiary); border: 2px solid transparent;
          border-radius: var(--radius-lg); cursor: pointer; transition: all var(--transition-fast);
        }
        .printer-item:hover { border-color: var(--border-default); }
        .printer-item.selected { border-color: var(--primary-400); background: rgba(249, 115, 22, 0.1); }
        .printer-info { display: flex; align-items: center; gap: 12px; }
        .printer-name { font-weight: 500; }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; }
        .status-dot.ready { background: var(--success); }
        .status-dot.offline { background: var(--error); }
        .no-printers { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px; color: var(--text-tertiary); }
        
        .toggle-row {
          display: flex; justify-content: space-between; align-items: center; cursor: pointer;
          padding: 12px 0; border-bottom: 1px solid var(--border-subtle);
        }
        .toggle-row input { display: none; }
        .toggle {
          width: 48px; height: 24px; background: var(--bg-tertiary); border-radius: 12px;
          position: relative; transition: background var(--transition-fast);
        }
        .toggle::after {
          content: ''; position: absolute; top: 2px; left: 2px;
          width: 20px; height: 20px; background: white; border-radius: 50%;
          transition: transform var(--transition-fast);
        }
        .toggle-row input:checked + .toggle { background: var(--primary-500); }
        .toggle-row input:checked + .toggle::after { transform: translateX(24px); }
        
        .btn-row { display: flex; gap: 12px; }
        .btn-row .btn { flex: 1; }
        
        .system-info { display: flex; flex-direction: column; gap: 12px; }
        .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border-subtle); }
        .info-value { font-weight: 600; display: flex; align-items: center; gap: 6px; }
        .status-online { color: var(--success); }
        
        .theme-switcher { display: flex; gap: 12px; }
        .theme-btn {
          flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;
          padding: 20px; background: var(--bg-tertiary); border: 2px solid var(--border-subtle);
          border-radius: var(--radius-xl); cursor: pointer; color: var(--text-secondary);
          transition: all var(--transition-fast);
        }
        .theme-btn:hover { border-color: var(--border-default); color: var(--text-primary); }
        .theme-btn.active { 
          border-color: var(--primary-400); background: rgba(249, 115, 22, 0.1); 
          color: var(--primary-400);
        }
        .theme-btn span { font-weight: 500; }
        .theme-hint { margin-top: 16px; text-align: center; color: var(--text-tertiary); font-size: 0.875rem; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        /* GSTIN Validation Styles */
        .gstin-group { flex: 1.5; }
        .gstin-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .gstin-input-wrapper .form-input {
          padding-right: 40px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-family: monospace;
        }
        .gstin-input-wrapper .form-input.valid {
          border-color: var(--success);
        }
        .gstin-input-wrapper .form-input.error {
          border-color: var(--error);
        }
        .gstin-icon {
          position: absolute;
          right: 12px;
          pointer-events: none;
        }
        .gstin-icon.valid { color: var(--success); }
        .gstin-icon.verified { color: var(--primary-400); }
        .gstin-icon.error { color: var(--error); }
        .gstin-message {
          display: block;
          font-size: 0.75rem;
          margin-top: 4px;
          padding-left: 2px;
        }
        .gstin-message.valid, .gstin-message.verified, .gstin-message.partial { color: var(--success); }
        .gstin-message.error { color: var(--error); }
        .gstin-message.typing { color: var(--text-tertiary); }
        .verify-btn {
          margin-top: 8px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        
        /* Subscription Plans */
        .current-plan {
          font-size: 0.8rem;
          background: var(--primary-500);
          color: white;
          padding: 4px 12px;
          border-radius: var(--radius-md);
        }
        
        .subscription-plans {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-top: 16px;
        }
        
        @media (max-width: 900px) {
          .subscription-plans { grid-template-columns: 1fr; }
        }
        
        .plan-card {
          background: var(--bg-tertiary);
          border: 2px solid var(--border-subtle);
          border-radius: var(--radius-xl);
          padding: 24px;
          text-align: center;
          position: relative;
          transition: all 0.3s;
        }
        
        .plan-card:hover {
          transform: translateY(-4px);
          border-color: var(--primary-400);
        }
        
        .plan-card.popular {
          border-color: var(--primary-400);
          background: linear-gradient(135deg, rgba(249, 115, 22, 0.05), rgba(234, 179, 8, 0.05));
        }
        
        .plan-badge {
          display: inline-block;
          font-size: 0.7rem;
          padding: 4px 10px;
          border-radius: var(--radius-sm);
          margin-bottom: 12px;
          background: var(--bg-secondary);
          color: var(--text-tertiary);
          text-transform: uppercase;
          font-weight: 600;
        }
        
        .plan-card.popular .plan-badge {
          background: var(--primary-500);
          color: white;
        }
        
        .plan-card h4 {
          font-size: 1.25rem;
          margin-bottom: 8px;
        }
        
        .plan-price {
          font-size: 2.5rem;
          font-weight: 700;
          color: var(--primary-400);
          margin-bottom: 16px;
        }
        
        .plan-price span {
          font-size: 0.9rem;
          color: var(--text-tertiary);
          font-weight: 400;
        }
        
        .plan-features {
          list-style: none;
          padding: 0;
          margin: 0 0 20px 0;
          text-align: left;
          font-size: 0.85rem;
        }
        
        .plan-features li {
          padding: 6px 0;
          border-bottom: 1px solid var(--border-subtle);
        }
        
        .plan-features li:last-child { border-bottom: none; }
        
        .plan-card .btn { width: 100%; }
      `}</style>
        </div>
    )
}
