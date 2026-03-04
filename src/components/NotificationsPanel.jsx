import { useEffect, useState } from 'react';
import { X, RefreshCw, BellOff } from 'lucide-react';
import { fetchNotifications } from '../services/api';
import './NotificationsPanel.css';

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 864000) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dayLabel(dateStr) {
    if (!dateStr) return 'Earlier';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupByDay(notifications) {
    const groups = [];
    let currentLabel = null;
    let currentGroup = [];

    notifications.forEach(n => {
        const label = dayLabel(n.created_at);
        if (label !== currentLabel) {
            if (currentGroup.length) groups.push({ label: currentLabel, items: currentGroup });
            currentLabel = label;
            currentGroup = [n];
        } else {
            currentGroup.push(n);
        }
    });
    if (currentGroup.length) groups.push({ label: currentLabel, items: currentGroup });
    return groups;
}

function NotificationsPanel({ isOpen, onClose, userId, onNavigate, onUnreadCountChange }) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [readIds, setReadIds] = useState(new Set());

    const load = async () => {
        if (!userId) return;
        setLoading(true);
        const data = await fetchNotifications(userId);
        setNotifications(data);
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen) load();
    }, [isOpen, userId]);

    const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

    // Report unread count to parent whenever it changes
    useEffect(() => {
        onUnreadCountChange?.(unreadCount);
    }, [unreadCount]);

    const markAllRead = () => setReadIds(new Set(notifications.map(n => n.id)));

    const handleClick = (notif) => {
        setReadIds(prev => new Set([...prev, notif.id]));
        if (onNavigate && notif.view) onNavigate(notif.view);
        onClose();
    };

    const groups = groupByDay(notifications);

    return (
        <>
            {/* Backdrop */}
            {isOpen && <div className="notif-backdrop" onClick={onClose} />}

            <div className={`notif-panel ${isOpen ? 'open' : ''}`}>
                {/* Header */}
                <div className="notif-header">
                    <div className="notif-header-left">
                        <span className="notif-title">Notifications</span>
                        {unreadCount > 0 && (
                            <span className="notif-unread-pill">{unreadCount} new</span>
                        )}
                    </div>
                    <div className="notif-header-actions">
                        {unreadCount > 0 && (
                            <button className="notif-mark-read" onClick={markAllRead} title="Mark all as read">
                                Mark all read
                            </button>
                        )}
                        <button className="notif-refresh" onClick={load} title="Refresh" disabled={loading}>
                            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
                        </button>
                        <button className="notif-close" onClick={onClose}>
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="notif-body">
                    {loading && notifications.length === 0 ? (
                        <div className="notif-empty">
                            <div className="notif-empty-spinner" />
                            <p>Loading activity...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="notif-empty">
                            <BellOff size={36} opacity={0.25} />
                            <p>No activity yet</p>
                            <span>Generate a title, script, or thumbnail to see it here.</span>
                        </div>
                    ) : (
                        groups.map(group => (
                            <div key={group.label} className="notif-group">
                                <div className="notif-group-label">{group.label}</div>
                                {group.items.map(notif => {
                                    const isRead = readIds.has(notif.id);
                                    return (
                                        <div
                                            key={notif.id}
                                            className={`notif-item ${isRead ? 'read' : 'unread'} type-${notif.type}`}
                                            onClick={() => handleClick(notif)}
                                        >
                                            <div className="notif-emoji">{notif.emoji}</div>
                                            <div className="notif-content">
                                                <div className="notif-label">{notif.label}</div>
                                                {notif.detail && (
                                                    <div className="notif-detail">{notif.detail}</div>
                                                )}
                                            </div>
                                            <div className="notif-meta">
                                                <span className="notif-time">{timeAgo(notif.created_at)}</span>
                                                {!isRead && <span className="notif-dot" />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}

export default NotificationsPanel;
