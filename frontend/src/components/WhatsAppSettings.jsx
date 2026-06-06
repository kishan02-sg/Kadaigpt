import { useState, useEffect } from 'react'
import { MessageCircle, Check, Copy, Loader2, Zap, Smartphone, PowerOff } from 'lucide-react'
import api from '../services/api'

/**
 * Per-store WhatsApp "storefront bot" connection.
 * Lets the owner connect a number so customers can message the shop to check
 * stock / price / store info. Supports the official Meta Cloud API or a
 * self-hosted WAHA/Evolution instance (their own number).
 */
export default function WhatsAppSettings({ addToast }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cfg, setCfg] = useState(null)
  const [provider, setProvider] = useState('') // '' | 'cloud' | 'evolution'
  const [form, setForm] = useState({
    cloud_token: '', cloud_phone_id: '', evolution_url: '', evolution_key: '', session: 'default', number: '',
  })

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const c = await api.getWaConfig()
      setCfg(c)
      setProvider(c.provider || '')
      setForm(f => ({
        ...f,
        cloud_phone_id: c.cloud_phone_id || '',
        evolution_url: c.evolution_url || '',
        session: c.session || 'default',
        number: c.number || '',
      }))
    } catch (e) {
      setCfg({ connected: false })
    } finally {
      setLoading(false)
    }
  }

  const copy = (txt) => { navigator.clipboard?.writeText(txt); addToast?.('Copied!', 'success') }

  const save = async () => {
    setSaving(true)
    try {
      const payload = { provider, number: form.number }
      if (provider === 'cloud') {
        if (form.cloud_token) payload.cloud_token = form.cloud_token
        payload.cloud_phone_id = form.cloud_phone_id
      } else if (provider === 'evolution') {
        payload.evolution_url = form.evolution_url
        if (form.evolution_key) payload.evolution_key = form.evolution_key
        payload.session = form.session
      }
      await api.saveWaConfig(payload)
      addToast?.(provider ? '✅ WhatsApp settings saved' : 'WhatsApp disconnected', 'success')
      setForm(f => ({ ...f, cloud_token: '', evolution_key: '' })) // clear secrets from the form
      await load()
    } catch (e) {
      addToast?.(e.message || 'Could not save WhatsApp settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="card settings-card" style={{ padding: 24, textAlign: 'center' }}><Loader2 className="spin" size={20} /> Loading…</div>
  }

  const fld = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.9rem' }
  const label = { display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '12px 0 4px', fontWeight: 600 }

  return (
    <div className="card settings-card">
      <div className="card-header">
        <h3 className="card-title"><MessageCircle size={20} /> WhatsApp Storefront Bot</h3>
      </div>
      <div style={{ padding: '4px 4px 8px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 14px' }}>
          Connect a WhatsApp number so customers can message your shop to ask
          <b> "is rice available?"</b>, <b>"price of sugar"</b>, or your store timings — answered instantly from your live stock.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, marginBottom: 14,
          background: cfg?.connected ? 'rgba(34,197,94,0.12)' : 'var(--bg-tertiary)',
          color: cfg?.connected ? '#22c55e' : 'var(--text-tertiary)', fontWeight: 600, fontSize: '0.85rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg?.connected ? '#22c55e' : '#9ca3af' }} />
          {cfg?.connected ? `Connected${cfg?.number ? ' · ' + cfg.number : ''}` : 'Not connected'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          {[
            { id: 'cloud', icon: Zap, t: 'Official (Meta)', s: 'Safe, free tier' },
            { id: 'evolution', icon: Smartphone, t: 'My own number', s: 'WAHA · scan QR' },
            { id: '', icon: PowerOff, t: 'Off', s: 'Disconnect' },
          ].map(p => (
            <button key={p.id || 'off'} onClick={() => setProvider(p.id)}
              style={{ padding: '12px 8px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                border: `1px solid ${provider === p.id ? '#ea580c' : 'var(--border-subtle)'}`,
                background: provider === p.id ? 'rgba(234,88,12,0.1)' : 'var(--bg-card)',
                color: provider === p.id ? '#ea580c' : 'var(--text-secondary)' }}>
              <p.icon size={18} />
              <div style={{ fontSize: '0.78rem', fontWeight: 700, marginTop: 4 }}>{p.t}</div>
              <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>{p.s}</div>
            </button>
          ))}
        </div>

        {provider === 'cloud' && (
          <div>
            <label style={label}>Access Token</label>
            <input style={fld} type="password" placeholder={cfg?.cloud_token_set ? '•••••• (saved — leave blank to keep)' : 'Meta permanent token'}
              value={form.cloud_token} onChange={e => setForm({ ...form, cloud_token: e.target.value })} />
            <label style={label}>Phone Number ID</label>
            <input style={fld} placeholder="e.g. 123456789012345" value={form.cloud_phone_id}
              onChange={e => setForm({ ...form, cloud_phone_id: e.target.value })} />
            <label style={label}>Your WhatsApp number (shown to customers)</label>
            <input style={fld} placeholder="+91 98765 43210" value={form.number}
              onChange={e => setForm({ ...form, number: e.target.value })} />
            <WebhookInfo cfg={cfg} copy={copy} />
          </div>
        )}

        {provider === 'evolution' && (
          <div>
            <label style={label}>WAHA / Evolution URL</label>
            <input style={fld} placeholder="https://your-waha.up.railway.app" value={form.evolution_url}
              onChange={e => setForm({ ...form, evolution_url: e.target.value })} />
            <label style={label}>API Key</label>
            <input style={fld} type="password" placeholder={cfg?.evolution_key_set ? '•••••• (saved — leave blank to keep)' : 'your WAHA api key'}
              value={form.evolution_key} onChange={e => setForm({ ...form, evolution_key: e.target.value })} />
            <label style={label}>Session name</label>
            <input style={fld} placeholder="default" value={form.session}
              onChange={e => setForm({ ...form, session: e.target.value })} />
            <label style={label}>Your WhatsApp number (shown to customers)</label>
            <input style={fld} placeholder="+91 98765 43210" value={form.number}
              onChange={e => setForm({ ...form, number: e.target.value })} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 10 }}>
              After saving, open your WAHA dashboard and <b>scan the QR with your phone's WhatsApp</b> to go live.
              Point WAHA's webhook to the URL below.
            </p>
            <WebhookInfo cfg={cfg} copy={copy} />
          </div>
        )}

        <button className="btn btn-primary" onClick={save} disabled={saving} style={{ marginTop: 16, width: '100%' }}>
          {saving ? <Loader2 className="spin" size={16} /> : <Check size={16} />} {provider ? ' Save & Connect' : ' Disconnect'}
        </button>
      </div>
    </div>
  )
}

function WebhookInfo({ cfg, copy }) {
  if (!cfg?.webhook_url) return null
  const row = (k, v) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', minWidth: 90 }}>{k}</span>
      <code style={{ flex: 1, fontSize: '0.72rem', wordBreak: 'break-all', color: 'var(--text-secondary)' }}>{v}</code>
      <button onClick={() => copy(v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-400)' }}><Copy size={13} /></button>
    </div>
  )
  return (
    <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: 'var(--bg-tertiary)' }}>
      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Webhook settings (paste into your provider)</div>
      {row('Webhook URL', cfg.webhook_url)}
      {row('Verify token', cfg.verify_token)}
    </div>
  )
}
