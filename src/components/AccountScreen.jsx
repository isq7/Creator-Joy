import { useState } from 'react';
import { Settings, CreditCard, Bell, Shield, Palette, LogOut } from 'lucide-react';
import './AccountScreen.css';

function AccountScreen({ user, userProfile, onNavigateToPricing }) {
    const [activeTab, setActiveTab] = useState('settings');

    // Get @username from profile
    const rawProfile = userProfile?.raw || {};
    const username = rawProfile.handles || rawProfile.Username || user?.id || 'you';
    const displayName = username.startsWith('@') ? username : `@${username}`;
    const avatarChar = (rawProfile.handles || rawProfile.Username || 'C')[0]?.toUpperCase();
    const userPlan = rawProfile.Plan || 'Basic';

    const billingHistory = [
        // Placeholder rows — replace with real data from Supabase billing table when available
        // { date: '2026-02-01', plan: 'Basic', amount: '$9.99', status: 'Paid' },
    ];

    return (
        <div className="account-screen">
            {/* Profile Header */}
            <div className="account-header">
                <div className="account-avatar-large">
                    {avatarChar}
                </div>
                <div className="account-info">
                    <h1 className="account-display-name">{displayName}</h1>
                    <span className="account-plan-badge">{userPlan} Plan</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="account-tabs">
                <button
                    className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                >
                    <Settings size={15} strokeWidth={2} />
                    Settings
                </button>
                <button
                    className={`tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
                    onClick={() => setActiveTab('billing')}
                >
                    <CreditCard size={15} strokeWidth={2} />
                    Billing
                </button>
            </div>

            <div className="tab-content">
                {/* ─── SETTINGS TAB ─────────────────────────────── */}
                {activeTab === 'settings' && (
                    <div className="settings-panel">
                        <div className="settings-group">
                            <div className="settings-group-title">
                                <Bell size={15} />
                                Notifications
                            </div>
                            <div className="settings-row">
                                <div className="settings-row-info">
                                    <span className="settings-row-label">Email Notifications</span>
                                    <span className="settings-row-desc">Get notified about new outliers and content generation</span>
                                </div>
                                <label className="settings-toggle">
                                    <input type="checkbox" defaultChecked />
                                    <span className="settings-toggle-slider" />
                                </label>
                            </div>
                            <div className="settings-row">
                                <div className="settings-row-info">
                                    <span className="settings-row-label">Weekly Digest</span>
                                    <span className="settings-row-desc">Receive a weekly summary of top outliers</span>
                                </div>
                                <label className="settings-toggle">
                                    <input type="checkbox" />
                                    <span className="settings-toggle-slider" />
                                </label>
                            </div>
                        </div>

                        <div className="settings-group">
                            <div className="settings-group-title">
                                <Palette size={15} />
                                Preferences
                            </div>
                            <div className="settings-row">
                                <div className="settings-row-info">
                                    <span className="settings-row-label">Default Platform</span>
                                    <span className="settings-row-desc">Auto-select platform when you open the app</span>
                                </div>
                                <select className="settings-select">
                                    <option value="instagram">Instagram</option>
                                    <option value="youtube">YouTube</option>
                                </select>
                            </div>
                            <div className="settings-row">
                                <div className="settings-row-info">
                                    <span className="settings-row-label">Grid Density</span>
                                    <span className="settings-row-desc">How many columns to show on the home feed</span>
                                </div>
                                <select className="settings-select">
                                    <option value="auto">Auto</option>
                                    <option value="4">4 Columns</option>
                                    <option value="5">5 Columns</option>
                                </select>
                            </div>
                        </div>

                        <div className="settings-group">
                            <div className="settings-group-title">
                                <Shield size={15} />
                                Privacy &amp; Security
                            </div>
                            <div className="settings-row">
                                <div className="settings-row-info">
                                    <span className="settings-row-label">Data Usage</span>
                                    <span className="settings-row-desc">Allow anonymous usage analytics to improve the product</span>
                                </div>
                                <label className="settings-toggle">
                                    <input type="checkbox" defaultChecked />
                                    <span className="settings-toggle-slider" />
                                </label>
                            </div>
                            <div className="settings-row danger-row">
                                <div className="settings-row-info">
                                    <span className="settings-row-label">Delete Account</span>
                                    <span className="settings-row-desc">Permanently remove your account and all data</span>
                                </div>
                                <button className="settings-danger-btn">Delete</button>
                            </div>
                        </div>

                        <div className="settings-logout-row">
                            <button className="logout-btn">
                                <LogOut size={16} strokeWidth={2} />
                                Log Out
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── BILLING TAB ──────────────────────────────── */}
                {activeTab === 'billing' && (
                    <div className="billing-panel">
                        <div className="billing-current-plan">
                            <div className="plan-name">Basic Plan</div>
                            <div className="plan-detail">25 credits / month</div>
                            <button className="upgrade-plan-btn" onClick={onNavigateToPricing}>Upgrade to Pro →</button>
                        </div>

                        <div className="billing-history-section">
                            <div className="billing-history-title">Payment History</div>
                            {billingHistory.length === 0 ? (
                                <div className="billing-empty">
                                    <CreditCard size={40} strokeWidth={1.2} />
                                    <p>No payment history yet.</p>
                                    <span>Your transactions will appear here once you upgrade.</span>
                                </div>
                            ) : (
                                <table className="billing-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Plan</th>
                                            <th>Amount</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {billingHistory.map((row, i) => (
                                            <tr key={i}>
                                                <td>{row.date}</td>
                                                <td>{row.plan}</td>
                                                <td>{row.amount}</td>
                                                <td>
                                                    <span className={`billing-status ${row.status.toLowerCase()}`}>
                                                        {row.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AccountScreen;
