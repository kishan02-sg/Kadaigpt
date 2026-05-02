import { useState } from 'react'
import {
    Download,
    Upload,
    FileSpreadsheet,
    Package,
    Users,
    FileText,
    Database,
    CheckCircle2,
    XCircle,
    Loader2,
    AlertTriangle
} from 'lucide-react'
import api from '../services/api'
import '../styles/BulkOperations.css'

export default function BulkOperations({ addToast }) {
    const [activeTab, setActiveTab] = useState('export')
    const [loading, setLoading] = useState(false)
    const [importResults, setImportResults] = useState(null)
    const [dragActive, setDragActive] = useState(false)

    // Check demo mode
    const isDemoMode = localStorage.getItem('kadai_demo_mode') === 'true'

    // Export functions
    const handleExport = async (type, format = 'csv') => {
        setLoading(true)
        try {
            const token = localStorage.getItem('kadai_token')
            const apiUrl = import.meta.env.VITE_API_URL || '/api/v1'

            const response = await fetch(`${apiUrl}/bulk/export/${type}?format=${format}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (!response.ok) throw new Error('Export failed')

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${type}_${new Date().toISOString().split('T')[0]}.${format}`
            document.body.appendChild(a)
            a.click()
            a.remove()
            window.URL.revokeObjectURL(url)

            addToast?.({ type: 'success', message: `${type} exported successfully!` })
        } catch (error) {
            console.error('Export error:', error)
            addToast?.({ type: 'error', message: 'Export failed. Please try again.' })
        } finally {
            setLoading(false)
        }
    }

    // Download template
    const handleDownloadTemplate = async (type) => {
        try {
            const token = localStorage.getItem('kadai_token')
            const apiUrl = import.meta.env.VITE_API_URL || '/api/v1'

            const response = await fetch(`${apiUrl}/bulk/templates/${type}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (!response.ok) throw new Error('Template download failed')

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${type}_template.csv`
            document.body.appendChild(a)
            a.click()
            a.remove()
            window.URL.revokeObjectURL(url)

            addToast?.({ type: 'success', message: 'Template downloaded!' })
        } catch (error) {
            addToast?.({ type: 'error', message: 'Template download failed.' })
        }
    }

    // Import functions
    const handleImport = async (type, file) => {
        if (!file) return

        setLoading(true)
        setImportResults(null)

        try {
            const token = localStorage.getItem('kadai_token')
            const apiUrl = import.meta.env.VITE_API_URL || '/api/v1'

            const formData = new FormData()
            formData.append('file', file)

            const response = await fetch(`${apiUrl}/bulk/import/${type}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            })

            const result = await response.json()
            setImportResults(result)

            if (result.success) {
                addToast?.({ type: 'success', message: `Imported ${result.imported} ${type} successfully!` })
            } else {
                addToast?.({ type: 'warning', message: `Import completed with ${result.failed} errors.` })
            }
        } catch (error) {
            console.error('Import error:', error)
            addToast?.({ type: 'error', message: 'Import failed. Please check file format.' })
        } finally {
            setLoading(false)
        }
    }

    // Backup function
    const handleBackup = async () => {
        setLoading(true)
        try {
            const token = localStorage.getItem('kadai_token')
            const apiUrl = import.meta.env.VITE_API_URL || '/api/v1'

            const response = await fetch(`${apiUrl}/bulk/backup`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (!response.ok) throw new Error('Backup failed')

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `kadaigpt_backup_${new Date().toISOString().split('T')[0]}.json`
            document.body.appendChild(a)
            a.click()
            a.remove()
            window.URL.revokeObjectURL(url)

            addToast?.({ type: 'success', message: 'Backup created successfully!' })
        } catch (error) {
            addToast?.({ type: 'error', message: 'Backup failed. Please try again.' })
        } finally {
            setLoading(false)
        }
    }

    // Restore function
    const handleRestore = async (file) => {
        if (!file) return

        if (!window.confirm('This will replace your current data. Are you sure?')) {
            return
        }

        setLoading(true)
        try {
            const token = localStorage.getItem('kadai_token')
            const apiUrl = import.meta.env.VITE_API_URL || '/api/v1'

            const formData = new FormData()
            formData.append('file', file)

            const response = await fetch(`${apiUrl}/bulk/restore`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            })

            const result = await response.json()

            if (result.success) {
                addToast?.({ type: 'success', message: 'Data restored successfully!' })
            } else {
                throw new Error(result.detail || 'Restore failed')
            }
        } catch (error) {
            addToast?.({ type: 'error', message: 'Restore failed. Please check file.' })
        } finally {
            setLoading(false)
        }
    }

    // Drag and drop handlers
    const handleDrag = (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    const handleDrop = (e, type) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleImport(type, e.dataTransfer.files[0])
        }
    }

    return (
        <div className="bulk-operations-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">📦 Bulk Operations</h1>
                    <p className="page-subtitle">Import and export data in bulk</p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bulk-tabs">
                <button
                    className={`bulk-tab ${activeTab === 'export' ? 'active' : ''}`}
                    onClick={() => setActiveTab('export')}
                >
                    <Download size={18} />
                    Export Data
                </button>
                <button
                    className={`bulk-tab ${activeTab === 'import' ? 'active' : ''}`}
                    onClick={() => setActiveTab('import')}
                >
                    <Upload size={18} />
                    Import Data
                </button>
                <button
                    className={`bulk-tab ${activeTab === 'backup' ? 'active' : ''}`}
                    onClick={() => setActiveTab('backup')}
                >
                    <Database size={18} />
                    Backup & Restore
                </button>
            </div>

            {/* Export Tab */}
            {activeTab === 'export' && (
                <div className="bulk-section">
                    <h2 className="section-title">Export Your Data</h2>
                    <p className="section-desc">Download your data as CSV or JSON files</p>

                    <div className="export-grid">
                        {/* Products Export */}
                        <div className="export-card">
                            <div className="export-icon">
                                <Package size={32} />
                            </div>
                            <h3>Products</h3>
                            <p>Export all your inventory items</p>
                            <div className="export-actions">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => handleExport('products', 'csv')}
                                    disabled={loading}
                                >
                                    <FileSpreadsheet size={16} />
                                    Export CSV
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => handleExport('products', 'json')}
                                    disabled={loading}
                                >
                                    Export JSON
                                </button>
                            </div>
                        </div>

                        {/* Customers Export */}
                        <div className="export-card">
                            <div className="export-icon">
                                <Users size={32} />
                            </div>
                            <h3>Customers</h3>
                            <p>Export customer information</p>
                            <div className="export-actions">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => handleExport('customers', 'csv')}
                                    disabled={loading}
                                >
                                    <FileSpreadsheet size={16} />
                                    Export CSV
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => handleExport('customers', 'json')}
                                    disabled={loading}
                                >
                                    Export JSON
                                </button>
                            </div>
                        </div>

                        {/* Bills Export */}
                        <div className="export-card">
                            <div className="export-icon">
                                <FileText size={32} />
                            </div>
                            <h3>Bills</h3>
                            <p>Export all sales records</p>
                            <div className="export-actions">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => handleExport('bills', 'csv')}
                                    disabled={loading}
                                >
                                    <FileSpreadsheet size={16} />
                                    Export CSV
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => handleExport('bills', 'json')}
                                    disabled={loading}
                                >
                                    Export JSON
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Tab */}
            {activeTab === 'import' && (
                <div className="bulk-section">
                    <h2 className="section-title">Import Data</h2>
                    <p className="section-desc">Upload CSV files to add data in bulk</p>

                    <div className="import-grid">
                        {/* Products Import */}
                        <div className="import-card">
                            <div className="import-header">
                                <Package size={24} />
                                <h3>Import Products</h3>
                            </div>

                            <div
                                className={`drop-zone ${dragActive ? 'active' : ''}`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={(e) => handleDrop(e, 'products')}
                            >
                                <Upload size={32} />
                                <p>Drag & drop CSV file here</p>
                                <span>or</span>
                                <label className="btn btn-primary">
                                    Browse Files
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={(e) => handleImport('products', e.target.files[0])}
                                        hidden
                                    />
                                </label>
                            </div>

                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleDownloadTemplate('products')}
                            >
                                <Download size={14} />
                                Download Template
                            </button>
                        </div>

                        {/* Customers Import */}
                        <div className="import-card">
                            <div className="import-header">
                                <Users size={24} />
                                <h3>Import Customers</h3>
                            </div>

                            <div
                                className={`drop-zone ${dragActive ? 'active' : ''}`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={(e) => handleDrop(e, 'customers')}
                            >
                                <Upload size={32} />
                                <p>Drag & drop CSV file here</p>
                                <span>or</span>
                                <label className="btn btn-primary">
                                    Browse Files
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={(e) => handleImport('customers', e.target.files[0])}
                                        hidden
                                    />
                                </label>
                            </div>

                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleDownloadTemplate('customers')}
                            >
                                <Download size={14} />
                                Download Template
                            </button>
                        </div>
                    </div>

                    {/* Import Results */}
                    {importResults && (
                        <div className={`import-results ${importResults.success ? 'success' : 'warning'}`}>
                            <div className="results-header">
                                {importResults.success ? (
                                    <CheckCircle2 size={24} />
                                ) : (
                                    <AlertTriangle size={24} />
                                )}
                                <h4>Import Results</h4>
                            </div>
                            <div className="results-stats">
                                <div className="stat">
                                    <span className="stat-value">{importResults.imported}</span>
                                    <span className="stat-label">Imported</span>
                                </div>
                                <div className="stat">
                                    <span className="stat-value">{importResults.failed}</span>
                                    <span className="stat-label">Failed</span>
                                </div>
                            </div>
                            {importResults.errors?.length > 0 && (
                                <div className="results-errors">
                                    <h5>Errors:</h5>
                                    <ul>
                                        {importResults.errors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Backup Tab */}
            {activeTab === 'backup' && (
                <div className="bulk-section">
                    <h2 className="section-title">Backup & Restore</h2>
                    <p className="section-desc">Create full backups or restore from previous backups</p>

                    <div className="backup-grid">
                        {/* Create Backup */}
                        <div className="backup-card">
                            <div className="backup-icon create">
                                <Download size={40} />
                            </div>
                            <h3>Create Backup</h3>
                            <p>Download a complete backup of all your store data including products, customers, bills, and settings.</p>
                            <button
                                className="btn btn-primary btn-lg"
                                onClick={handleBackup}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={18} className="spin" />
                                        Creating Backup...
                                    </>
                                ) : (
                                    <>
                                        <Database size={18} />
                                        Create Backup
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Restore Backup */}
                        <div className="backup-card">
                            <div className="backup-icon restore">
                                <Upload size={40} />
                            </div>
                            <h3>Restore Backup</h3>
                            <p>Restore your store data from a previous backup file. This will replace all current data.</p>
                            <label className="btn btn-secondary btn-lg">
                                {loading ? (
                                    <>
                                        <Loader2 size={18} className="spin" />
                                        Restoring...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={18} />
                                        Choose Backup File
                                    </>
                                )}
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={(e) => handleRestore(e.target.files[0])}
                                    hidden
                                    disabled={loading}
                                />
                            </label>
                            <p className="backup-warning">
                                <AlertTriangle size={14} />
                                This action cannot be undone
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading Overlay */}
            {loading && (
                <div className="loading-overlay">
                    <div className="loading-spinner">
                        <Loader2 size={48} className="spin" />
                        <p>Processing...</p>
                    </div>
                </div>
            )}
        </div>
    )
}
