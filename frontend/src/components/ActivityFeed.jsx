import { useState, useEffect } from 'react'
import { Clock, Package, Users, ShoppingBag, TrendingUp, AlertTriangle, Gift, Settings, Bell } from 'lucide-react'

const activityIcons = {
    'sale': ShoppingBag,
    'product': Package,
    'customer': Users,
    'stock': AlertTriangle,
    'loyalty': Gift,
    'settings': Settings,
    'system': Bell
}

const activityColors = {
    'sale': 'success',
    'product': 'primary',
    'customer': 'info',
    'stock': 'warning',
    'loyalty': 'purple',
    'settings': 'gray',
    'system': 'blue'
}

// Demo activities
const demoActivities = [
    { id: 1, type: 'sale', title: 'New Sale', description: 'Bill #2847 - ₹1,250 to Priya Sharma', time: '2 min ago' },
    { id: 2, type: 'customer', title: 'New Customer', description: 'Rahul Kumar registered via WhatsApp', time: '15 min ago' },
    { id: 3, type: 'stock', title: 'Low Stock Alert', description: 'Toor Dal running low (8 kg left)', time: '32 min ago' },
    { id: 4, type: 'sale', title: 'Credit Sale', description: 'Bill #2846 - ₹3,500 credit to Amit Singh', time: '1 hour ago' },
    { id: 5, type: 'loyalty', title: 'Reward Redeemed', description: 'Priya Sharma redeemed 500 points', time: '2 hours ago' },
    { id: 6, type: 'product', title: 'Stock Updated', description: 'Added 50 kg Basmati Rice', time: '3 hours ago' },
    { id: 7, type: 'sale', title: 'UPI Payment', description: 'Bill #2845 - ₹780 via UPI', time: '4 hours ago' },
    { id: 8, type: 'system', title: 'Daily Backup', description: 'Automatic backup completed', time: '6 hours ago' },
]

export default function ActivityFeed({ activities = demoActivities, maxItems = 10 }) {
    const [items, setItems] = useState(activities.slice(0, maxItems))
    const [isLive, setIsLive] = useState(true)

    return (
        <div className="activity-feed">
            <div className="activity-header">
                <h3>
                    <Clock size={18} />
                    Activity Feed
                </h3>
                <div className={`live-indicator ${isLive ? 'active' : ''}`}>
                    <span className="live-dot"></span>
                    <span>Live</span>
                </div>
            </div>

            <div className="activity-list">
                {items.map((activity, index) => {
                    const Icon = activityIcons[activity.type] || Bell
                    const color = activityColors[activity.type] || 'gray'

                    return (
                        <div
                            key={activity.id}
                            className="activity-item"
                            style={{ animationDelay: `${index * 0.05}s` }}
                        >
                            <div className={`activity-icon ${color}`}>
                                <Icon size={16} />
                            </div>
                            <div className="activity-content">
                                <div className="activity-title">{activity.title}</div>
                                <div className="activity-description">{activity.description}</div>
                            </div>
                            <div className="activity-time">{activity.time}</div>
                        </div>
                    )
                })}
            </div>

            <style>{`
                .activity-feed {
                    background: var(--bg-secondary);
                    border-radius: var(--radius-xl);
                    padding: 20px;
                    border: 1px solid var(--border-subtle);
                }
                
                .activity-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 16px;
                }
                .activity-header h3 {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 1rem;
                    margin: 0;
                }
                
                .live-indicator {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.75rem;
                    color: var(--text-tertiary);
                    padding: 4px 10px;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-full);
                }
                .live-indicator.active {
                    color: var(--success);
                }
                .live-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: var(--text-tertiary);
                }
                .live-indicator.active .live-dot {
                    background: var(--success);
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.2); }
                }
                
                .activity-list {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                
                .activity-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 12px;
                    border-radius: var(--radius-md);
                    transition: background 0.15s ease;
                    animation: fadeInUp 0.3s ease forwards;
                    opacity: 0;
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .activity-item:hover {
                    background: var(--bg-tertiary);
                }
                
                .activity-icon {
                    width: 32px;
                    height: 32px;
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .activity-icon.success { background: rgba(34, 197, 94, 0.15); color: var(--success); }
                .activity-icon.primary { background: rgba(124, 58, 237, 0.15); color: var(--primary-400); }
                .activity-icon.info { background: rgba(59, 130, 246, 0.15); color: var(--info); }
                .activity-icon.warning { background: rgba(234, 179, 8, 0.15); color: var(--warning); }
                .activity-icon.purple { background: rgba(168, 85, 247, 0.15); color: #a855f7; }
                .activity-icon.gray { background: var(--bg-tertiary); color: var(--text-tertiary); }
                .activity-icon.blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
                
                .activity-content {
                    flex: 1;
                    min-width: 0;
                }
                .activity-title {
                    font-weight: 600;
                    font-size: 0.875rem;
                    margin-bottom: 2px;
                }
                .activity-description {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .activity-time {
                    font-size: 0.75rem;
                    color: var(--text-tertiary);
                    white-space: nowrap;
                }
            `}</style>
        </div>
    )
}
