import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Home,
    FolderSearch,
    Bookmark,
    Lightbulb,
    Type,
    Image,
    Bell,
    Users,
    HelpCircle,
    Moon,
    Zap,
    Settings,
    ChevronRight,
    PanelLeftOpen,
    PanelLeftClose,
    ExternalLink,
    Video,
    Sparkles,
    ChevronDown,
    FileText
} from 'lucide-react';
import CreatorJoyLogo from '../assets/NewLogo.png';
import './Sidebar.css';

function Sidebar({ isCollapsed, onToggle, currentView, onViewChange, userId, userProfile, notificationsOpen, onOpenNotifications, unreadNotifCount }) {
    const [isCreationsExpanded, setIsCreationsExpanded] = useState(false);

    // Dynamic User Data
    const userName = userProfile?.raw?.handles || userProfile?.raw?.Username || userProfile?.raw?.Full_Name || 'Creator';
    const userPlan = userProfile?.raw?.Plan || 'Basic';
    const userInitial = userName.charAt(0).toUpperCase();

    useEffect(() => {
        if (['idea', 'title', 'thumbnail', 'avatar_video'].includes(currentView)) {
            setIsCreationsExpanded(true);
        }
    }, [currentView]);
    const iconSize = 22;
    const strokeWidth = 1.8;

    const navSection = (title, items) => (
        <div className="sidebar-section">
            {!isCollapsed && <div className="section-label">{title}</div>}
            <nav className="sidebar-nav">
                {items.map((item, idx) => (
                    <a
                        key={idx}
                        href="#"
                        className={`nav-item ${item.active ? 'active' : ''} ${item.special ? item.special : ''}`}
                        title={item.label}
                        onClick={(e) => {
                            e.preventDefault();
                            if (item.onAction) {
                                item.onAction();
                            } else if (item.url) {
                                window.location.href = item.url;
                            } else {
                                onViewChange(item.view);
                            }
                        }}
                    >
                        <span className="nav-icon">
                            <item.icon size={iconSize} strokeWidth={strokeWidth} />
                        </span>
                        {!isCollapsed && <span className="nav-text">{item.label}</span>}
                        {item.badge && !isCollapsed && <span className="nav-badge">{item.badge}</span>}
                    </a>
                ))}
            </nav>
        </div>
    );

    return (
        <motion.aside
            initial={false}
            animate={{ width: isCollapsed ? 80 : 280 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}
        >
            <div className="sidebar-header">
                <div className="sidebar-brand" onClick={() => onViewChange('home')} style={{ cursor: 'pointer' }}>
                    <div className="brand-logo-custom" style={{
                        width: '34px',
                        height: '34px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <img
                            src={CreatorJoyLogo}
                            alt="Creator Joy Logo"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain'
                            }}
                        />
                    </div>
                    {!isCollapsed && (
                        <div className="brand-name-custom">
                            <span className="brand-creator">CREATOR</span>
                            <span className="brand-joy">JOY</span>
                        </div>
                    )}
                </div>
                <button className="hamburger-btn" onClick={onToggle} title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}>
                    {isCollapsed ? (
                        <PanelLeftOpen size={18} strokeWidth={1.6} />
                    ) : (
                        <PanelLeftClose size={18} strokeWidth={1.6} />
                    )}
                </button>
            </div>

            <div className="sidebar-content">
                {navSection("CORE", [
                    { icon: Home, label: "Home", view: 'home', active: currentView === 'home' },
                    { icon: Bookmark, label: "Bookmarks", view: 'bookmarks', active: currentView === 'bookmarks' },
                ])}

                <div className="section-divider" />

                {!isCollapsed && <div className="section-label">CREATION</div>}

                <div
                    className={`nav-item nav-item-expandable ${['idea', 'title', 'thumbnail', 'avatar_video'].includes(currentView) ? 'parent-active' : ''}`}
                    onClick={() => {
                        if (isCollapsed) onToggle();
                        setIsCreationsExpanded(!isCreationsExpanded);
                    }}
                >
                    <span className="nav-icon">
                        <span className="rainbow-sparkle-emoji">✨</span>
                    </span>
                    {!isCollapsed && <span className="nav-text">My Creations</span>}
                    {!isCollapsed && (
                        <ChevronDown
                            size={14}
                            className={`chevron-icon ${isCreationsExpanded ? 'rotated' : ''}`}
                        />
                    )}
                </div>

                {!isCollapsed && (
                    <div className={`sidebar-submenu ${isCreationsExpanded ? 'expanded' : ''}`}>
                        {[
                            { icon: FileText, label: "Scripts", view: 'idea', active: currentView === 'idea' },
                            { icon: Type, label: "Titles", view: 'title', active: currentView === 'title' },
                            { icon: Image, label: "Thumbnails", view: 'thumbnail', active: currentView === 'thumbnail' },
                            { icon: Video, label: "Avatar Videos", view: 'avatar_video', active: currentView === 'avatar_video' },
                        ].map((item, idx) => (
                            <a
                                key={idx}
                                href="#"
                                className={`submenu-item ${item.active ? 'active' : ''}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    onViewChange(item.view);
                                }}
                            >
                                <span className="nav-icon">
                                    <item.icon size={14} strokeWidth={strokeWidth} />
                                </span>
                                <span className="nav-text">{item.label}</span>
                            </a>
                        ))}
                    </div>
                )}

                <div className="section-divider" />

                {navSection("SYSTEM", [
                    {
                        icon: ExternalLink,
                        label: "AirPublisher",
                        url: `https://aircreator.cloud/publisher/dashboard${userId ? `?unique_identifier=${userId}` : ''}`
                    },
                    {
                        icon: Bell,
                        label: "Notifications",
                        onAction: onOpenNotifications,
                        active: notificationsOpen,
                        badge: unreadNotifCount > 0 ? String(unreadNotifCount) : null,
                    },
                ])}
            </div>

            <div className="sidebar-footer">
                {!isCollapsed && (
                    <button className="upgrade-btn" onClick={() => onViewChange('pricing')}>
                        <Zap size={14} fill="currentColor" />
                        <span>Upgrade to Pro</span>
                    </button>
                )}

                <div
                    className="footer-nav nav-item"
                    title="Settings"
                    onClick={() => onViewChange('account')}
                    style={{ cursor: 'pointer' }}
                >
                    <div className="user-profile">
                        <div className="user-avatar">{userInitial}</div>
                        {!isCollapsed && (
                            <div className="user-info">
                                <span className="user-name">{userName}</span>
                                <span className="user-plan">{userPlan}</span>
                            </div>
                        )}
                    </div>
                    {!isCollapsed && <Settings size={16} strokeWidth={1.6} className="settings-trigger" />}
                </div>
            </div>
        </motion.aside>
    );
}

export default Sidebar;
