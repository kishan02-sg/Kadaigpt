import { useState } from 'react'
import { ShieldCheck, Mail, Lock, ArrowRight, Loader2, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import api from '../services/api'

export default function AdminLogin({ onLogin }) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [form, setForm] = useState({
        email: '',
        password: '',
        adminCode: ''
    })

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            // Validate admin code
            if (form.adminCode !== 'KADAI-ADMIN-2024') {
                throw new Error('Invalid admin access code')
            }

            // Try to login
            await api.login(form.email, form.password)
            const userData = await api.getProfile()

            // Check if user has admin role
            if (userData.role !== 'admin' && userData.role !== 'superadmin') {
                api.logout()
                throw new Error('This account does not have admin privileges')
            }

            localStorage.setItem('kadai_user_role', 'admin')
            localStorage.setItem('kadai_is_admin', 'true')

            onLogin({
                ...userData,
                role: 'admin',
                isAdmin: true
            })
        } catch (err) {
            console.error('Admin login error:', err)
            setError(err.message || 'Invalid credentials or access code')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="admin-login-page">
            <div className="admin-login-container">
                <div className="admin-login-header">
                    <div className="admin-icon">
                        <ShieldCheck size={40} />
                    </div>
                    <h1>Admin Portal</h1>
                    <p>KadaiGPT System Administration</p>
                </div>

                {error && (
                    <div className="error-alert">
                        <AlertTriangle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label><Mail size={16} /> Admin Email</label>
                        <input
                            type="email"
                            placeholder="admin@kadaigpt.com"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label><Lock size={16} /> Password</label>
                        <div className="password-input">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Enter your password"
                                value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                                required
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label><ShieldCheck size={16} /> Admin Access Code</label>
                        <input
                            type="password"
                            placeholder="Enter admin access code"
                            value={form.adminCode}
                            onChange={e => setForm({ ...form, adminCode: e.target.value })}
                            required
                        />
                        <small>Contact system administrator for access code</small>
                    </div>

                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 size={18} className="spin" />
                                Verifying...
                            </>
                        ) : (
                            <>
                                Access Admin Panel <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>

                <div className="admin-footer">
                    <p>Not an admin? <a href="#login">Go to regular login</a></p>
                </div>
            </div>

            <style>{`
        .admin-login-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #16213e 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .admin-login-container {
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 24px;
          padding: 40px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
        }

        .admin-login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .admin-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 20px;
          background: linear-gradient(135deg, #f97316, #ea580c);
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 12px 40px rgba(249, 115, 22, 0.4);
        }

        .admin-login-header h1 {
          font-size: 1.75rem;
          margin: 0 0 8px;
          background: linear-gradient(135deg, #fff, #f97316);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .admin-login-header p {
          color: var(--text-tertiary);
          margin: 0;
        }

        .error-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 12px;
          margin-bottom: 24px;
          color: #ef4444;
          font-size: 0.875rem;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          font-weight: 500;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .form-group input {
          width: 100%;
          padding: 14px 16px;
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          font-size: 0.9375rem;
          transition: all 0.2s;
        }

        .form-group input:focus {
          border-color: var(--primary-400);
          outline: none;
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
        }

        .form-group small {
          display: block;
          margin-top: 8px;
          font-size: 0.75rem;
          color: var(--text-tertiary);
        }

        .password-input {
          position: relative;
        }

        .password-input input {
          padding-right: 48px;
        }

        .password-input button {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-tertiary);
          cursor: pointer;
        }

        .submit-btn {
          width: 100%;
          padding: 16px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #f97316, #ea580c);
          color: white;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.2s;
        }

        .submit-btn:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .admin-footer {
          text-align: center;
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid var(--border-subtle);
        }

        .admin-footer p {
          color: var(--text-tertiary);
          font-size: 0.875rem;
          margin: 0;
        }

        .admin-footer a {
          color: var(--primary-400);
          text-decoration: none;
        }
      `}</style>
        </div>
    )
}
