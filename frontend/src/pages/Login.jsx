import { useState } from 'react'
import { ShoppingCart, Mail, Lock, User, ArrowRight, Loader2, Sparkles, Zap, Shield, Wifi, Eye, EyeOff, Square, CheckSquare, Building, Users } from 'lucide-react'
import api from '../services/api'

export default function Login({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [registerType, setRegisterType] = useState('owner') // 'owner' or 'staff'
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    storeName: '',
    storeCode: '', // For staff joining existing store
  })
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [forgotStep, setForgotStep] = useState(1) // 1=email, 2=token+password
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMessage, setForgotMessage] = useState('')
  const [forgotError, setForgotError] = useState('')

  // Clear error when switching between login/register
  const toggleMode = () => {
    setError('')
    setIsLogin(!isLogin)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('') // Clear any previous error

    try {
      if (isLogin) {
        // Login uses email
        console.log('Attempting login with email:', form.email)
        await api.login(form.email, form.password)
        const user = await api.getProfile()
        localStorage.setItem('kadai_user_role', user.role || 'owner')
        onLogin(user)
      } else {
        // Register - differentiate between owner and staff
        console.log('Attempting registration as:', registerType)

        if (registerType === 'owner') {
          // Store owner registration
          const registerResult = await api.register({
            full_name: form.username,
            email: form.email,
            password: form.password,
            store_name: form.storeName,
            role: 'owner'
          })

          if (registerResult.access_token) {
            api.setToken(registerResult.access_token)
            if (registerResult.store?.name) {
              localStorage.setItem('kadai_store_name', registerResult.store.name)
            }
            localStorage.setItem('kadai_user_role', 'owner')

            const user = {
              id: registerResult.user?.id,
              email: registerResult.user?.email,
              full_name: registerResult.user?.full_name,
              username: registerResult.user?.full_name || form.username,
              store_name: registerResult.store?.name || form.storeName,
              role: 'owner'
            }
            onLogin(user)
          }
        } else {
          // Manager or Cashier registration - join existing store
          const selectedRole = registerType // 'manager' or 'cashier'
          const registerResult = await api.registerStaff?.({
            full_name: form.username,
            email: form.email,
            password: form.password,
            store_code: form.storeCode,
            role: selectedRole
          }) || await api.register({
            full_name: form.username,
            email: form.email,
            password: form.password,
            store_code: form.storeCode,
            role: selectedRole
          })

          if (registerResult.access_token) {
            api.setToken(registerResult.access_token)
            localStorage.setItem('kadai_user_role', selectedRole)

            const user = {
              id: registerResult.user?.id,
              email: registerResult.user?.email,
              full_name: registerResult.user?.full_name,
              username: registerResult.user?.full_name || form.username,
              store_name: registerResult.store?.name,
              role: selectedRole
            }
            onLogin(user)
          } else {
            // Fallback login
            await api.login(form.email, form.password)
            const user = await api.getProfile()
            localStorage.setItem('kadai_user_role', selectedRole)
            onLogin({ ...user, role: selectedRole })
          }
        }
      }
    } catch (err) {
      console.error('Auth error:', err)
      // Handle different error formats
      let errorMessage = 'Something went wrong. Please try again.'

      if (typeof err === 'string') {
        errorMessage = err
      } else if (err?.message) {
        errorMessage = err.message
      } else if (err?.detail) {
        errorMessage = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail)
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }


  // No demo mode - real authentication only

  const features = [
    { icon: Sparkles, text: 'AI-Powered Bill Scanning' },
    { icon: Zap, text: 'Instant Silent Printing' },
    { icon: Wifi, text: 'Works Offline' },
    { icon: Shield, text: 'GST Compliant' },
  ]

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Left - Branding */}
        <div className="login-brand">
          <div className="brand-content">
            <div className="brand-logo">
              <ShoppingCart size={40} />
            </div>
            <h1>KadaiGPT</h1>
            <p className="tagline">AI-Powered Retail Intelligence</p>
            <p className="description">
              Smart billing, inventory management, and analytics for your retail store.
              WhatsApp integration, works offline, and GST compliant.
            </p>

            <div className="features-grid">
              {features.map((feature, i) => (
                <div key={i} className="feature-item">
                  <feature.icon size={20} />
                  <span>{feature.text}</span>
                </div>
              ))}
            </div>

            <div className="trust-badges">
              <div className="badge-item">
                <span className="badge-number">10,000+</span>
                <span className="badge-text">Bills Processed</span>
              </div>
              <div className="badge-item">
                <span className="badge-number">500+</span>
                <span className="badge-text">Happy Stores</span>
              </div>
              <div className="badge-item">
                <span className="badge-number">99.9%</span>
                <span className="badge-text">Uptime</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right - Form */}
        <div className="login-form-section">
          <div className="form-container">
            <h2>{isLogin ? 'Welcome Back!' : 'Get Started Free'}</h2>
            <p className="form-subtitle">
              {isLogin ? 'Sign in to your store account' : 'Create your AI-powered store in seconds'}
            </p>

            {error && <div className="error-alert">{error}</div>}

            <form onSubmit={handleSubmit}>
              {/* Role Selector for Registration */}
              {!isLogin && (
                <div className="role-selector">
                  <button
                    type="button"
                    className={`role-btn ${registerType === 'owner' ? 'active' : ''}`}
                    onClick={() => setRegisterType('owner')}
                  >
                    <Building size={18} />
                    <span>Store Owner</span>
                    <small>Create new store</small>
                  </button>
                  <button
                    type="button"
                    className={`role-btn ${registerType === 'manager' ? 'active' : ''}`}
                    onClick={() => setRegisterType('manager')}
                  >
                    <Shield size={18} />
                    <span>Manager</span>
                    <small>Join as manager</small>
                  </button>
                  <button
                    type="button"
                    className={`role-btn ${registerType === 'cashier' ? 'active' : ''}`}
                    onClick={() => setRegisterType('cashier')}
                  >
                    <Users size={18} />
                    <span>Cashier</span>
                    <small>Join as staff</small>
                  </button>
                </div>
              )}

              {/* For Registration - Show Full Name first */}
              {!isLogin && (
                <div className="form-group">
                  <label className="form-label" htmlFor="fullname">Full Name</label>
                  <div className="input-icon">
                    <User size={18} />
                    <input
                      type="text"
                      id="fullname"
                      name="fullname"
                      className="form-input"
                      placeholder="Your full name"
                      autoComplete="name"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      required
                      minLength={2}
                    />
                  </div>
                </div>
              )}

              {/* Email - Always shown */}
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email Address</label>
                <div className="input-icon">
                  <Mail size={18} />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className="form-input"
                    placeholder="your@email.com"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
              </div>


              {/* Store Name - For Store Owners only */}
              {!isLogin && registerType === 'owner' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="storename">Store Name</label>
                  <div className="input-icon">
                    <ShoppingCart size={18} />
                    <input
                      type="text"
                      id="storename"
                      name="storename"
                      className="form-input"
                      placeholder="Your Store Name"
                      autoComplete="organization"
                      value={form.storeName}
                      onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                      required
                      minLength={2}
                    />
                  </div>
                </div>
              )}

              {/* Store Code - For Staff joining existing store */}
              {!isLogin && registerType === 'staff' && (
                <div className="form-group">
                  <label className="form-label">Store Code</label>
                  <div className="input-icon">
                    <Building size={18} />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter store code (from owner)"
                      value={form.storeCode}
                      onChange={(e) => setForm({ ...form, storeCode: e.target.value.toUpperCase() })}
                      required
                      maxLength={8}
                    />
                  </div>
                  <span className="password-hint">Ask your store owner for the code</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <div className="input-icon password-input">
                  <Lock size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    className="form-input"
                    placeholder="Enter your password"
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {!isLogin && (
                  <span className="password-hint">Minimum 6 characters</span>
                )}
              </div>

              {/* Terms Checkbox - Registration only */}
              {!isLogin && (
                <div className="terms-checkbox">
                  <button
                    type="button"
                    className={`checkbox-btn ${acceptedTerms ? 'checked' : ''}`}
                    onClick={() => setAcceptedTerms(!acceptedTerms)}
                    aria-checked={acceptedTerms}
                    role="checkbox"
                  >
                    {acceptedTerms ? (
                      <CheckSquare size={20} />
                    ) : (
                      <Square size={20} />
                    )}
                  </button>
                  <span className="terms-label">
                    I agree to the{' '}
                    <a href="#terms" onClick={(e) => e.preventDefault()}>Terms of Service</a>
                    {' '}and{' '}
                    <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
                  </span>
                </div>
              )}

              {/* Remember Me - Login only */}
              {isLogin && (
                <div className="remember-forgot">
                  <label className="remember-me">
                    <input type="checkbox" id="rememberme" name="rememberme" />
                    <span>Remember me</span>
                  </label>
                  <button type="button" className="forgot-link" onClick={() => { setShowForgotPassword(true); setForgotStep(1); setForgotEmail(form.email || ''); setForgotMessage(''); setForgotError('') }}>
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg w-full"
                disabled={loading || (!isLogin && !acceptedTerms)}
              >
                {loading ? <Loader2 size={20} className="spin" /> : <><span>{isLogin ? 'Sign In' : 'Create Account'}</span><ArrowRight size={18} /></>}
              </button>
            </form>

            <p className="switch-mode">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button onClick={toggleMode}>
                {isLogin ? 'Sign Up Free' : 'Sign In'}
              </button>
            </p>

            {isLogin && (
              <div className="admin-login-link">
                <a href="#admin-login" onClick={(e) => { e.preventDefault(); window.location.hash = 'admin-login' }}>
                  Admin Login →
                </a>
              </div>
            )}

            {isLogin && (
              <p className="terms-text">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="modal-overlay" onClick={() => setShowForgotPassword(false)} style={{ zIndex: 10000 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', margin: '20px' }}>
            <div className="modal-header">
              <h3 className="modal-title">🔐 Reset Password</h3>
              <button className="modal-close" onClick={() => setShowForgotPassword(false)}>
                <span style={{ fontSize: '24px', lineHeight: 1 }}>&times;</span>
              </button>
            </div>
            <div className="modal-body">
              {forgotMessage && <div style={{ background: '#dcfce7', color: '#166534', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>{forgotMessage}</div>}
              {forgotError && <div className="error-alert">{forgotError}</div>}

              {forgotStep === 1 ? (
                <>
                  <p style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Enter your registered email address. We'll send you a password reset token.
                  </p>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      placeholder="your@email.com"
                      autoFocus
                    />
                  </div>
                  <button
                    className="btn btn-primary w-full"
                    disabled={forgotLoading || !forgotEmail.includes('@')}
                    onClick={async () => {
                      setForgotLoading(true); setForgotError('');
                      try {
                        await api.forgotPassword(forgotEmail);
                        setForgotMessage('Reset token generated! Check server logs for the token (email coming soon).');
                        setForgotStep(2);
                      } catch (err) {
                        setForgotError(err.message || 'Failed to send reset request');
                      } finally { setForgotLoading(false) }
                    }}
                  >
                    {forgotLoading ? 'Sending...' : 'Send Reset Token'}
                  </button>
                </>
              ) : (
                <>
                  <p style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Enter the reset token and your new password.
                  </p>
                  <div className="form-group">
                    <label className="form-label">Reset Token</label>
                    <input
                      type="text"
                      className="form-input"
                      value={resetToken}
                      onChange={e => setResetToken(e.target.value)}
                      placeholder="Paste token here"
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input
                      type="password"
                      className="form-input"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      minLength={6}
                    />
                  </div>
                  <button
                    className="btn btn-primary w-full"
                    disabled={forgotLoading || !resetToken || newPassword.length < 6}
                    onClick={async () => {
                      setForgotLoading(true); setForgotError('');
                      try {
                        await api.resetPassword(resetToken, newPassword);
                        setForgotMessage('Password reset successfully! You can now login.');
                        setTimeout(() => { setShowForgotPassword(false); setForgotStep(1); setResetToken(''); setNewPassword('') }, 2000);
                      } catch (err) {
                        setForgotError(err.message || 'Failed to reset password');
                      } finally { setForgotLoading(false) }
                    }}
                  >
                    {forgotLoading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* Login Page - Cross Platform Responsive */
        .login-page {
          min-height: 100vh;
          min-height: -webkit-fill-available; /* iOS Safari fix */
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          padding: max(20px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
          background: linear-gradient(135deg, var(--bg-primary) 0%, #1a1a2e 100%);
          box-sizing: border-box;
        }
        
        .login-container {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          max-width: 1100px;
          width: 100%;
          background: var(--bg-secondary);
          border-radius: var(--radius-2xl);
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          border: 1px solid var(--border-subtle);
        }
        
        /* Tablet and below - single column */
        @media (max-width: 900px) {
          .login-container { 
            grid-template-columns: 1fr;
            max-width: 480px;
            border-radius: var(--radius-xl);
          }
          .login-brand { display: none; }
        }
        
        /* Mobile specific */
        @media (max-width: 480px) {
          .login-page {
            padding: 12px;
            align-items: center;
            padding-top: max(20px, env(safe-area-inset-top));
            padding-bottom: max(20px, env(safe-area-inset-bottom));
          }
          .login-container {
            border-radius: var(--radius-lg);
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
          }
        }
        
        .login-brand {
          background: var(--gradient-primary);
          padding: 48px;
          display: flex;
          align-items: center;
          position: relative;
          overflow: hidden;
        }
        
        .login-brand::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -50%;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
        }
        
        .brand-content { 
          position: relative; 
          z-index: 1; 
        }
        
        .brand-logo {
          width: 72px; 
          height: 72px;
          background: rgba(255,255,255,0.2);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px); /* Safari */
          border-radius: var(--radius-xl);
          display: flex; 
          align-items: center; 
          justify-content: center;
          color: white; 
          margin-bottom: 24px;
        }
        
        .brand-content h1 { 
          color: white; 
          font-size: 2.5rem; 
          margin-bottom: 8px; 
          font-weight: 800;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        .tagline { 
          color: rgba(255,255,255,0.95); 
          font-size: 1.25rem; 
          margin-bottom: 20px; 
          font-weight: 500; 
        }
        
        .description { 
          color: rgba(255,255,255,0.85); 
          margin-bottom: 32px; 
          line-height: 1.7; 
          font-size: 0.9375rem; 
        }
        
        .tamil-tagline { 
          font-size: 1rem; 
          color: rgba(255,255,255,0.9); 
          font-style: italic; 
          margin-bottom: 16px; 
          padding: 8px 16px;
          background: rgba(255,255,255,0.15);
          border-radius: var(--radius-md);
          display: inline-block;
        }
        
        .features-grid { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 12px; 
          margin-bottom: 32px; 
        }
        
        .feature-item { 
          display: flex; 
          align-items: center; 
          gap: 10px; 
          color: white; 
          font-size: 0.875rem; 
          font-weight: 500;
          background: rgba(255,255,255,0.1); 
          padding: 12px 14px;
          border-radius: var(--radius-lg);
        }
        
        .trust-badges { 
          display: flex; 
          gap: 24px; 
          padding-top: 24px; 
          border-top: 1px solid rgba(255,255,255,0.2); 
        }
        
        .badge-item { 
          display: flex; 
          flex-direction: column; 
        }
        
        .badge-number { 
          color: white; 
          font-size: 1.5rem; 
          font-weight: 800; 
        }
        
        .badge-text { 
          color: rgba(255,255,255,0.7); 
          font-size: 0.75rem; 
        }
        
        /* Form Section */
        .login-form-section { 
          padding: 48px; 
          display: flex; 
          align-items: center;
          justify-content: center;
        }
        
        @media (max-width: 768px) {
          .login-form-section {
            padding: 32px 24px;
          }
        }
        
        @media (max-width: 480px) {
          .login-form-section {
            padding: 24px 16px;
          }
        }
        
        .form-container { 
          width: 100%; 
          max-width: 360px; 
          margin: 0 auto; 
        }
        
        .form-container h2 { 
          font-size: 1.75rem; 
          margin-bottom: 8px; 
          text-align: center;
          -webkit-font-smoothing: antialiased;
        }
        
        @media (max-width: 480px) {
          .form-container h2 {
            font-size: 1.5rem;
          }
        }
        
        .form-subtitle { 
          color: var(--text-secondary); 
          margin-bottom: 28px; 
          text-align: center;
          font-size: 0.9375rem;
        }
        
        @media (max-width: 480px) {
          .form-subtitle {
            margin-bottom: 20px;
            font-size: 0.875rem;
          }
        }
        
        /* Input styling for touch devices */
        .input-icon { 
          position: relative; 
        }
        
        .input-icon svg { 
          position: absolute; 
          left: 14px; 
          top: 50%; 
          transform: translateY(-50%); 
          color: var(--text-tertiary);
          pointer-events: none;
        }
        
        .input-icon input { 
          padding-left: 44px;
          /* iOS Safari - prevent zoom on focus */
          font-size: 16px !important;
          /* Touch-friendly height */
          min-height: 48px;
          -webkit-appearance: none;
          appearance: none;
        }
        
        /* Password input with toggle */
        .password-input input {
          padding-right: 44px;
        }
        
        .password-toggle {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          -webkit-tap-highlight-color: transparent;
          width: 36px;
          height: 36px;
        }
        
        .password-toggle:hover {
          background: var(--bg-tertiary);
          color: var(--primary-400);
          border-color: var(--primary-400);
        }
        
        .password-toggle:active {
          transform: translateY(-50%) scale(0.95);
        }
        
        .password-toggle:focus {
          outline: none;
          border-color: var(--primary-400);
        }

        .password-hint {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          margin-top: 6px;
          display: block;
        }

        /* Terms Checkbox */
        .terms-checkbox {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin: 20px 0;
          padding: 12px 14px;
          background: var(--bg-tertiary);
          border-radius: 10px;
          border: 1px solid var(--border-subtle);
        }

        .checkbox-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-tertiary);
          transition: all 0.2s;
          flex-shrink: 0;
          -webkit-tap-highlight-color: transparent;
        }

        .checkbox-btn:hover {
          color: var(--primary-400);
        }

        .checkbox-btn.checked {
          color: var(--primary-500);
        }

        .checkbox-btn.checked svg {
          fill: var(--primary-500);
        }

        .terms-label {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .terms-label a {
          color: var(--primary-400);
          text-decoration: none;
          font-weight: 500;
        }

        .terms-label a:hover {
          text-decoration: underline;
        }

        /* Remember Me & Forgot Password */
        .remember-forgot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 16px 0 20px;
        }

        .remember-me {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .remember-me input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: var(--primary-500);
          cursor: pointer;
          border-radius: 4px;
        }

        .forgot-link {
          background: none;
          border: none;
          color: var(--primary-400);
          font-size: 0.85rem;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .forgot-link:hover {
          background: rgba(249, 115, 22, 0.1);
        }
        
        .w-full { 
          width: 100%; 
        }

        /* Role Selector */
        .role-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 20px;
        }

        .role-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 16px 12px;
          background: var(--bg-tertiary);
          border: 2px solid var(--border-subtle);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .role-btn:hover {
          border-color: var(--primary-300);
          background: var(--bg-secondary);
        }

        .role-btn.active {
          border-color: var(--primary-500);
          background: rgba(249, 115, 22, 0.1);
        }

        .role-btn svg {
          color: var(--text-secondary);
        }

        .role-btn.active svg {
          color: var(--primary-500);
        }

        .role-btn span {
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text-primary);
        }

        .role-btn small {
          font-size: 0.75rem;
          color: var(--text-tertiary);
        }

        /* Admin Login Link */
        .admin-login-link {
          text-align: center;
          margin-top: 16px;
        }

        .admin-login-link a {
          color: var(--text-tertiary);
          font-size: 0.8rem;
          text-decoration: none;
          transition: color 0.2s;
        }

        .admin-login-link a:hover {
          color: var(--primary-400);
        }
        
        /* Error Alert */
        .error-alert { 
          background: rgba(239, 68, 68, 0.1); 
          color: #ef4444; 
          padding: 12px 16px; 
          border-radius: var(--radius-md); 
          margin-bottom: 20px; 
          font-size: 0.875rem; 
          text-align: center;
          border: 1px solid rgba(239, 68, 68, 0.2);
          word-break: break-word;
        }
        
        .divider { 
          display: flex; 
          align-items: center; 
          gap: 16px; 
          margin: 24px 0; 
          color: var(--text-tertiary); 
          font-size: 0.8125rem; 
        }
        
        .divider::before, 
        .divider::after { 
          content: ''; 
          flex: 1; 
          height: 1px; 
          background: var(--border-subtle); 
        }
        
        /* Demo Button */
        .btn-demo {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-default);
          color: var(--text-primary);
          transition: all var(--transition-fast);
          min-height: 48px;
          -webkit-tap-highlight-color: transparent;
        }
        
        .btn-demo:hover {
          background: var(--bg-card);
          border-color: var(--primary-400);
          color: var(--primary-400);
        }
        
        .btn-demo:active {
          transform: scale(0.98);
        }
        
        .switch-mode { 
          text-align: center; 
          margin-top: 24px; 
          color: var(--text-secondary); 
          font-size: 0.9375rem; 
        }
        
        .switch-mode button { 
          background: none; 
          border: none; 
          color: var(--primary-400); 
          cursor: pointer; 
          font-weight: 600;
          padding: 4px 8px;
          -webkit-tap-highlight-color: transparent;
        }
        
        .terms-text { 
          text-align: center; 
          margin-top: 20px; 
          font-size: 0.75rem; 
          color: var(--text-tertiary);
          line-height: 1.5;
        }
        
        .spin { 
          animation: spin 1s linear infinite; 
        }
        
        @keyframes spin { 
          to { transform: rotate(360deg); } 
        }
        
        /* iOS specific fixes */
        @supports (-webkit-touch-callout: none) {
          .login-page {
            min-height: -webkit-fill-available;
          }
          
          .form-input {
            font-size: 16px !important; /* Prevent zoom */
          }
        }
        
        /* Android Chrome specific */
        @media screen and (-webkit-min-device-pixel-ratio: 0) {
          .form-container {
            -webkit-font-smoothing: subpixel-antialiased;
          }
        }
        
        /* High DPI screens */
        @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
          .brand-logo {
            border: 0.5px solid rgba(255,255,255,0.1);
          }
        }
        
        /* Landscape mobile */
        @media (max-height: 600px) and (orientation: landscape) {
          .login-page {
            align-items: flex-start;
            padding-top: 20px;
          }
          
          .login-form-section {
            padding: 20px;
          }
          
          .form-container h2 {
            font-size: 1.25rem;
            margin-bottom: 4px;
          }
          
          .form-subtitle {
            margin-bottom: 12px;
          }
          
          .form-group {
            margin-bottom: 12px;
          }
        }
        
        /* Desktop hover states */
        @media (hover: hover) and (pointer: fine) {
          .btn:hover {
            transform: translateY(-2px);
          }
        }
        
        /* Touch devices - remove hover effects */
        @media (hover: none) and (pointer: coarse) {
          .btn:hover {
            transform: none;
          }
          
          .btn:active {
            transform: scale(0.98);
          }
        }
      `}</style>
    </div>
  )
}
