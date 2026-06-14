import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Camera,
    Upload,
    Loader2,
    AlertTriangle,
    RotateCcw,
    ShoppingCart,
    Trash2,
    ScanLine
} from 'lucide-react'
import ocrService from '../services/ocrService'

const UNITS = ['pcs', 'kg', 'g', 'L', 'ml']

export default function OCRCapture({ addToast, setCurrentPage }) {
    const { t, i18n } = useTranslation()
    const [step, setStep] = useState('capture') // capture | preview | processing | results
    const [imagePreview, setImagePreview] = useState(null)
    const [imageFile, setImageFile] = useState(null)
    const [result, setResult] = useState(null)
    const [items, setItems] = useState([])
    const [error, setError] = useState(null)

    const cameraInputRef = useRef(null)
    const galleryInputRef = useRef(null)

    const resetCapture = () => {
        if (imagePreview) URL.revokeObjectURL(imagePreview)
        setImageFile(null)
        setImagePreview(null)
        setResult(null)
        setItems([])
        setError(null)
        setStep('capture')
    }

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return

        if (imagePreview) URL.revokeObjectURL(imagePreview)
        setImageFile(file)
        setImagePreview(URL.createObjectURL(file))
        setResult(null)
        setItems([])
        setError(null)
        setStep('preview')
    }

    const handleScan = async () => {
        if (!imageFile) return
        setStep('processing')
        setError(null)

        try {
            const data = await ocrService.processImage(imageFile, i18n.language)
            if (!data.success || !data.items || data.items.length === 0) {
                setResult(null)
                setItems([])
                setError(t('ocr.noResults'))
                setStep('results')
                return
            }
            setResult(data)
            setItems(data.items)
            setStep('results')
        } catch (err) {
            console.error('OCR processing error:', err)
            const message = err?.message || ''
            setError(/api|key|gemini/i.test(message) ? t('ocr.setupRequired') : (message || t('ocr.noResults')))
            setStep('preview')
        }
    }

    const updateItem = (id, field, value) => {
        setItems(prev => prev.map(item => {
            if (item.id !== id) return item
            const updated = { ...item, [field]: value }
            if (field === 'quantity' || field === 'price') {
                updated.total = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.price) || 0)
            }
            return updated
        }))
    }

    const removeItem = (id) => {
        setItems(prev => prev.filter(item => item.id !== id))
    }

    const grandTotal = items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0)

    const handleAddToBill = () => {
        if (items.length === 0) return
        const draft = items.map(item => ({
            name: item.name,
            quantity: parseFloat(item.quantity) || 1,
            unit: item.unit || 'pcs',
            price: parseFloat(item.price) || 0
        }))
        sessionStorage.setItem('kadai_ocr_draft', JSON.stringify(draft))
        addToast(t('ocr.addedToCart', { count: draft.length }), 'success')
        setCurrentPage('create-bill')
    }

    const confidenceLevel = (confidence) => {
        if (confidence >= 90) return 'high'
        if (confidence >= 70) return 'medium'
        return 'low'
    }

    return (
        <div className="page-container ocr-capture">
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} hidden />
            <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleFileSelect} hidden />

            <div className="ocr-header">
                <h1 className="ocr-title">{t('ocr.title')}</h1>
                <p className="ocr-subtitle">{t('ocr.scanBill')}</p>
            </div>

            {step === 'capture' && (
                <div className="ocr-card ocr-capture-step">
                    <div className="ocr-capture-icon"><Camera size={40} /></div>
                    <div className="ocr-actions">
                        <button className="ocr-btn ocr-btn-primary" onClick={() => cameraInputRef.current?.click()}>
                            <Camera size={20} /> {t('ocr.takePhoto')}
                        </button>
                        <button className="ocr-btn ocr-btn-secondary" onClick={() => galleryInputRef.current?.click()}>
                            <Upload size={20} /> {t('ocr.uploadImage')}
                        </button>
                    </div>
                </div>
            )}

            {step === 'preview' && (
                <div className="ocr-card">
                    <div className="ocr-image-preview">
                        <img src={imagePreview} alt="" />
                    </div>
                    {error && (
                        <div className="ocr-banner ocr-banner-error">
                            <AlertTriangle size={18} />
                            <span>{error}</span>
                        </div>
                    )}
                    <p className="ocr-hint">{t('ocr.readyToScan')}</p>
                    <div className="ocr-actions">
                        <button className="ocr-btn ocr-btn-primary" onClick={handleScan}>
                            <ScanLine size={20} /> {t('ocr.scanBill')}
                        </button>
                        <button className="ocr-btn ocr-btn-secondary" onClick={resetCapture}>
                            <RotateCcw size={20} /> {t('ocr.chooseDifferent')}
                        </button>
                    </div>
                </div>
            )}

            {step === 'processing' && (
                <div className="ocr-card ocr-processing-step">
                    <Loader2 size={40} className="ocr-spinner" />
                    <p>{t('ocr.processing')}</p>
                </div>
            )}

            {step === 'results' && (
                <div className="ocr-card">
                    <div className="ocr-results-header">
                        <h2>{t('ocr.scanResults')}</h2>
                        {result && (
                            <span className={`ocr-confidence-badge ocr-confidence-${confidenceLevel(result.confidence)}`}>
                                {t('ocr.confidence')}: {result.confidence}%
                            </span>
                        )}
                    </div>

                    {items.length === 0 ? (
                        <div className="ocr-empty">
                            <AlertTriangle size={32} />
                            <p>{error || t('ocr.noResults')}</p>
                        </div>
                    ) : (
                        <>
                            <p className="ocr-hint">{t('ocr.itemsFound', { count: items.length })} · {t('ocr.reviewBeforeAdding')}</p>

                            <div className="ocr-items-list">
                                {items.map(item => (
                                    <div key={item.id} className={`ocr-item-card ${item.needsReview ? 'ocr-item-flagged' : ''}`}>
                                        <div className="ocr-item-top">
                                            <input
                                                className="ocr-item-name"
                                                type="text"
                                                value={item.name}
                                                onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                            />
                                            <button
                                                className="ocr-item-remove"
                                                onClick={() => removeItem(item.id)}
                                                title={t('ocr.removeItem')}
                                                aria-label={t('ocr.removeItem')}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        {item.originalText && (
                                            <p className="ocr-item-original">"{item.originalText}"</p>
                                        )}

                                        <div className="ocr-item-fields">
                                            <label className="ocr-field">
                                                <span>{t('common.quantity')}</span>
                                                <input
                                                    type="number" min="0" step="0.01" inputMode="decimal"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                                                />
                                            </label>
                                            <label className="ocr-field">
                                                <span>Unit</span>
                                                <select value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)}>
                                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                </select>
                                            </label>
                                            <label className="ocr-field">
                                                <span>{t('common.price')}</span>
                                                <input
                                                    type="number" min="0" step="0.01" inputMode="decimal"
                                                    value={item.price}
                                                    onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                                                />
                                            </label>
                                            <div className="ocr-field ocr-field-total">
                                                <span>{t('common.total')}</span>
                                                <strong>{t('common.rupees')}{(parseFloat(item.total) || 0).toFixed(2)}</strong>
                                            </div>
                                        </div>

                                        {item.needsReview && (
                                            <div className="ocr-item-flag">
                                                <AlertTriangle size={14} /> {t('ocr.needsReview')} ({item.confidence}%)
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="ocr-grand-total">
                                <span>{t('common.total')}</span>
                                <strong>{t('common.rupees')}{grandTotal.toFixed(2)}</strong>
                            </div>

                            {result?.suggestions?.length > 0 && (
                                <div className="ocr-suggestions">
                                    {result.suggestions.map((s, idx) => <p key={idx}>{s}</p>)}
                                </div>
                            )}
                        </>
                    )}

                    <div className="ocr-actions">
                        {items.length > 0 && (
                            <button className="ocr-btn ocr-btn-primary" onClick={handleAddToBill}>
                                <ShoppingCart size={20} /> {t('ocr.addToBill')}
                            </button>
                        )}
                        <button className="ocr-btn ocr-btn-secondary" onClick={resetCapture}>
                            <RotateCcw size={20} /> {t('ocr.rescan')}
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                .ocr-capture {
                    padding: 24px;
                    max-width: 640px;
                    margin: 0 auto;
                }
                .ocr-header {
                    text-align: center;
                    margin-bottom: 24px;
                }
                .ocr-title {
                    font-size: 1.75rem;
                    font-weight: 700;
                    background: linear-gradient(135deg, #7c3aed, #ec4899);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    margin-bottom: 4px;
                }
                .ocr-subtitle {
                    color: var(--text-secondary);
                }
                .ocr-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border-subtle);
                    border-radius: 16px;
                    padding: 24px;
                }
                .ocr-capture-step,
                .ocr-processing-step {
                    text-align: center;
                    padding: 48px 24px;
                }
                .ocr-capture-icon {
                    width: 88px;
                    height: 88px;
                    margin: 0 auto 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(99, 102, 241, 0.1));
                    color: var(--primary-500);
                }
                .ocr-processing-step {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                    color: var(--text-secondary);
                }
                .ocr-spinner {
                    color: var(--primary-500);
                    animation: ocr-spin 1s linear infinite;
                }
                @keyframes ocr-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .ocr-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 20px;
                }
                .ocr-btn {
                    flex: 1;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 14px 20px;
                    border-radius: 12px;
                    font-size: 0.95rem;
                    font-weight: 600;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .ocr-btn-primary {
                    background: linear-gradient(135deg, #7c3aed, #6366f1);
                    color: white;
                }
                .ocr-btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(124, 58, 237, 0.3);
                }
                .ocr-btn-secondary {
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    border: 1px solid var(--border-subtle);
                }
                .ocr-btn-secondary:hover {
                    border-color: var(--primary-500);
                }
                .ocr-image-preview {
                    border-radius: 12px;
                    overflow: hidden;
                    background: var(--bg-secondary);
                    max-height: 360px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .ocr-image-preview img {
                    max-width: 100%;
                    max-height: 360px;
                    object-fit: contain;
                }
                .ocr-hint {
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                    margin-top: 16px;
                    text-align: center;
                }
                .ocr-banner {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 16px;
                    border-radius: 10px;
                    margin-top: 16px;
                    font-size: 0.9rem;
                }
                .ocr-banner-error {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    color: #ef4444;
                }
                .ocr-results-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    flex-wrap: wrap;
                }
                .ocr-results-header h2 {
                    font-size: 1.25rem;
                    font-weight: 700;
                    margin: 0;
                }
                .ocr-confidence-badge {
                    padding: 6px 14px;
                    border-radius: 100px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }
                .ocr-confidence-high {
                    background: rgba(34, 197, 94, 0.15);
                    color: #16a34a;
                }
                .ocr-confidence-medium {
                    background: rgba(234, 179, 8, 0.15);
                    color: #ca8a04;
                }
                .ocr-confidence-low {
                    background: rgba(239, 68, 68, 0.15);
                    color: #ef4444;
                }
                .ocr-empty {
                    text-align: center;
                    padding: 32px 16px;
                    color: var(--text-secondary);
                }
                .ocr-empty svg {
                    color: #ca8a04;
                    margin-bottom: 12px;
                }
                .ocr-items-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-top: 16px;
                }
                .ocr-item-card {
                    border: 1px solid var(--border-subtle);
                    border-radius: 12px;
                    padding: 14px;
                }
                .ocr-item-card.ocr-item-flagged {
                    border-color: rgba(234, 179, 8, 0.5);
                    background: rgba(234, 179, 8, 0.05);
                }
                .ocr-item-top {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .ocr-item-name {
                    flex: 1;
                    border: none;
                    background: transparent;
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    padding: 6px 0;
                    border-bottom: 1px solid transparent;
                }
                .ocr-item-name:focus {
                    outline: none;
                    border-bottom-color: var(--primary-500);
                }
                .ocr-item-remove {
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    border: 1px solid var(--border-subtle);
                    background: transparent;
                    color: var(--text-secondary);
                    cursor: pointer;
                }
                .ocr-item-remove:hover {
                    color: #ef4444;
                    border-color: #ef4444;
                }
                .ocr-item-original {
                    margin: 4px 0 0;
                    font-size: 0.8rem;
                    color: var(--text-tertiary);
                    font-style: italic;
                }
                .ocr-item-fields {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    margin-top: 12px;
                }
                .ocr-field {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }
                .ocr-field input,
                .ocr-field select {
                    padding: 8px;
                    border-radius: 8px;
                    border: 1px solid var(--border-subtle);
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    font-size: 0.9rem;
                    width: 100%;
                }
                .ocr-field-total {
                    justify-content: center;
                }
                .ocr-field-total strong {
                    font-size: 1rem;
                    color: var(--text-primary);
                }
                .ocr-item-flag {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-top: 10px;
                    font-size: 0.8rem;
                    color: #ca8a04;
                }
                .ocr-grand-total {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid var(--border-subtle);
                    font-size: 1.1rem;
                    font-weight: 700;
                }
                .ocr-suggestions {
                    margin-top: 12px;
                    padding: 12px;
                    border-radius: 10px;
                    background: var(--bg-secondary);
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                }
                .ocr-suggestions p {
                    margin: 0;
                    padding: 2px 0;
                }
                @media (max-width: 480px) {
                    .ocr-capture {
                        padding: 16px;
                    }
                    .ocr-actions {
                        flex-direction: column;
                    }
                    .ocr-item-fields {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
            `}</style>
        </div>
    )
}
