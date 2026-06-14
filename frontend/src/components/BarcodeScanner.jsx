import { useState, useRef, useEffect, useCallback } from 'react'
import { Barcode, Camera, X, Check, Loader2, Search, AlertCircle, Zap } from 'lucide-react'

export default function BarcodeScanner({ products = [], onProductFound, onClose }) {
    const [barcode, setBarcode] = useState('')
    const [scanning, setScanning] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState('')
    const [mode, setMode] = useState('manual') // manual, camera
    const inputRef = useRef(null)
    const videoRef = useRef(null)
    const streamRef = useRef(null)

    useEffect(() => {
        // Focus on input for barcode scanner
        if (mode === 'manual' && inputRef.current) {
            inputRef.current.focus()
        }
        return () => {
            stopCamera()
        }
    }, [mode])

    // Search the store's real products by barcode or SKU
    const lookupProduct = useCallback((code) => {
        const trimmed = (code || '').trim()
        if (!trimmed) return

        setScanning(true)
        setError('')
        setResult(null)

        setTimeout(() => {
            const normalized = trimmed.toLowerCase()
            const product = products.find(p =>
                (p.barcode && String(p.barcode).toLowerCase() === normalized) ||
                (p.sku && String(p.sku).toLowerCase() === normalized)
            )
            if (product) {
                setResult(product)
                playBeep('success')
            } else {
                setError(`No product found for barcode "${trimmed}". Add this barcode to a product in Products.`)
                playBeep('error')
            }
            setScanning(false)
        }, 200)
    }, [products])

    // Handle barcode input (works with USB barcode scanners)
    const handleBarcodeInput = (e) => {
        const value = e.target.value
        setBarcode(value)

        // Auto-search when barcode is complete (typically 8-13 digits)
        if (value.length >= 8 && value.length <= 13) {
            lookupProduct(value)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && barcode) {
            lookupProduct(barcode)
        }
    }

    const playBeep = (type) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = type === 'success' ? 800 : 300
        oscillator.type = 'sine'
        gainNode.gain.value = 0.3

        oscillator.start()
        oscillator.stop(audioContext.currentTime + (type === 'success' ? 0.1 : 0.3))
    }

    const startCamera = async () => {
        try {
            setError('')
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
            }
            setMode('camera')
        } catch (err) {
            setError('Camera access denied. Use manual entry.')
        }
    }

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
    }

    // Live-decode barcodes from the camera feed where the browser supports it
    useEffect(() => {
        if (mode !== 'camera') return

        if (!('BarcodeDetector' in window)) {
            setError('Live camera scanning isn\'t supported on this browser. Use manual / USB entry instead.')
            return
        }

        let active = true
        let frameId

        const detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
        })

        const scanFrame = async () => {
            if (!active) return
            if (videoRef.current && videoRef.current.readyState >= 2) {
                try {
                    const codes = await detector.detect(videoRef.current)
                    if (codes.length > 0) {
                        active = false
                        const value = codes[0].rawValue
                        setBarcode(value)
                        lookupProduct(value)
                        return
                    }
                } catch {
                    // ignore per-frame detection errors
                }
            }
            if (active) frameId = requestAnimationFrame(scanFrame)
        }

        frameId = requestAnimationFrame(scanFrame)
        return () => {
            active = false
            if (frameId) cancelAnimationFrame(frameId)
        }
    }, [mode, lookupProduct])

    const addToCart = () => {
        if (result) {
            onProductFound(result)
            setBarcode('')
            setResult(null)
        }
    }

    const clearAndFocus = () => {
        setBarcode('')
        setResult(null)
        setError('')
        inputRef.current?.focus()
    }

    return (
        <div className="barcode-scanner">
            <div className="scanner-header">
                <h3><Barcode size={20} /> Barcode Scanner</h3>
                <button className="close-btn" onClick={onClose}><X size={20} /></button>
            </div>

            <div className="scanner-modes">
                <button
                    className={`mode-btn ${mode === 'manual' ? 'active' : ''}`}
                    onClick={() => { setMode('manual'); stopCamera(); }}
                >
                    <Search size={16} /> Manual / USB Scanner
                </button>
                <button
                    className={`mode-btn ${mode === 'camera' ? 'active' : ''}`}
                    onClick={startCamera}
                >
                    <Camera size={16} /> Camera Scan
                </button>
            </div>

            {mode === 'manual' && (
                <div className="manual-input">
                    <div className="input-wrapper">
                        <Barcode size={20} />
                        <input
                            ref={inputRef}
                            type="text"
                            className="barcode-input"
                            placeholder="Scan or enter barcode / SKU..."
                            value={barcode}
                            onChange={handleBarcodeInput}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                        {barcode && (
                            <button className="clear-btn" onClick={clearAndFocus}>
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <p className="hint">
                        <Zap size={14} /> USB barcode scanners work automatically
                    </p>
                </div>
            )}

            {mode === 'camera' && (
                <div className="camera-view">
                    <video ref={videoRef} autoPlay playsInline muted />
                    <div className="scan-overlay">
                        <div className="scan-line"></div>
                    </div>
                    <p className="camera-hint">Point camera at barcode</p>
                </div>
            )}

            {scanning && (
                <div className="scanning-status">
                    <Loader2 size={24} className="spin" />
                    <span>Looking up product...</span>
                </div>
            )}

            {error && (
                <div className="scanner-error">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {result && (
                <div className="scanner-result">
                    <div className="result-icon"><Check size={24} /></div>
                    <div className="result-info">
                        <h4>{result.name}</h4>
                        <p className="result-barcode">{result.barcode || result.sku}</p>
                        <p className="result-price">₹{result.price} / {result.unit || 'pcs'}</p>
                    </div>
                    <button className="btn btn-primary" onClick={addToCart}>
                        Add to Cart
                    </button>
                </div>
            )}

            <style>{`
        .barcode-scanner {
          background: var(--bg-card);
          border-radius: var(--radius-xl);
          padding: 24px;
          border: 1px solid var(--border-subtle);
        }
        .scanner-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .scanner-header h3 { display: flex; align-items: center; gap: 8px; margin: 0; }
        .close-btn { background: none; border: none; color: var(--text-tertiary); cursor: pointer; padding: 4px; }

        .scanner-modes { display: flex; gap: 8px; margin-bottom: 20px; }
        .mode-btn {
          flex: 1; padding: 12px;
          background: var(--bg-tertiary); border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg); cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          font-size: 0.875rem; font-weight: 500; color: var(--text-secondary);
          transition: all var(--transition-fast);
        }
        .mode-btn:hover { border-color: var(--primary-400); color: var(--primary-400); }
        .mode-btn.active { background: rgba(249, 115, 22, 0.1); border-color: var(--primary-400); color: var(--primary-400); }

        .manual-input { margin-bottom: 20px; }
        .input-wrapper {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 16px; background: var(--bg-tertiary);
          border: 2px solid var(--border-default); border-radius: var(--radius-lg);
          transition: border-color var(--transition-fast);
        }
        .input-wrapper:focus-within { border-color: var(--primary-400); }
        .barcode-input {
          flex: 1; border: none; background: none;
          font-size: 1.25rem; font-family: var(--font-mono);
          color: var(--text-primary); outline: none;
        }
        .hint { font-size: 0.75rem; color: var(--text-tertiary); margin-top: 8px; display: flex; align-items: center; gap: 6px; }

        .camera-view { position: relative; border-radius: var(--radius-lg); overflow: hidden; margin-bottom: 20px; }
        .camera-view video { width: 100%; max-height: 200px; object-fit: cover; }
        .scan-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
        .scan-line { width: 80%; height: 2px; background: var(--primary-400); animation: scan 2s infinite; }
        @keyframes scan { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        .camera-hint { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); font-size: 0.75rem; background: rgba(0,0,0,0.7); padding: 4px 12px; border-radius: var(--radius-md); }

        .scanning-status { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 20px; color: var(--text-secondary); }
        .scanner-error { display: flex; align-items: center; gap: 8px; padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-md); color: var(--error); margin-bottom: 16px; }

        .scanner-result {
          display: flex; align-items: center; gap: 16px;
          padding: 16px; background: rgba(34, 197, 94, 0.1);
          border: 1px solid var(--success); border-radius: var(--radius-lg);
          margin-bottom: 16px;
        }
        .result-icon { width: 48px; height: 48px; background: var(--success); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .result-info { flex: 1; }
        .result-info h4 { margin: 0 0 4px; }
        .result-barcode { font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-tertiary); margin: 0; }
        .result-price { font-weight: 700; color: var(--primary-400); margin: 4px 0 0; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
        </div>
    )
}
