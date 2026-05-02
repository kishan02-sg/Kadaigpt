/**
 * KadaiGPT - Error Boundary Component
 * Catches React component errors, reports to error tracker,
 * and shows a friendly recovery UI instead of a white screen
 */

import { Component } from 'react'
import errorTracker from '../services/errorTracker'

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        // Report to error tracker
        errorTracker.captureComponentError(error, errorInfo)
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', minHeight: '60vh', padding: '40px',
                    textAlign: 'center',
                }}>
                    <div style={{
                        fontSize: '48px', marginBottom: '16px',
                        animation: 'pulse 2s infinite',
                    }}>⚠️</div>
                    <h2 style={{
                        fontSize: '20px', fontWeight: 600,
                        color: 'var(--text-primary, #fff)',
                        marginBottom: '8px',
                    }}>
                        Something went wrong
                    </h2>
                    <p style={{
                        fontSize: '14px', color: 'var(--text-secondary, #999)',
                        marginBottom: '24px', maxWidth: '400px',
                    }}>
                        {this.state.error?.message || 'An unexpected error occurred. Our team has been notified.'}
                    </p>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={this.handleRetry}
                            style={{
                                padding: '10px 24px', borderRadius: '10px',
                                background: 'var(--primary-500, #6366f1)',
                                color: '#fff', border: 'none', cursor: 'pointer',
                                fontWeight: 500, fontSize: '14px',
                            }}
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '10px 24px', borderRadius: '10px',
                                background: 'var(--bg-card, #1e1e2e)',
                                color: 'var(--text-primary, #fff)',
                                border: '1px solid var(--border-color, #333)',
                                cursor: 'pointer', fontWeight: 500, fontSize: '14px',
                            }}
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
