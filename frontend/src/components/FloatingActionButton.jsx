import { Plus } from 'lucide-react'
import './FloatingActionButton.css'

export default function FloatingActionButton({ onClick, label = "Create Bill" }) {
    return (
        <button
            className="floating-action-btn"
            onClick={onClick}
            title={label}
        >
            <Plus size={24} />
            <span className="fab-label">{label}</span>
        </button>
    )
}
