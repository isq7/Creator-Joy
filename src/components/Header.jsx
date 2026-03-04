import { Search, X } from 'lucide-react';
import { Moon, Sun } from 'lucide-react';
import './Header.css';

function Header({ credits = 25, isDarkMode, onToggleDarkMode, searchQuery = '', onSearchChange }) {
    return (
        <header className="main-header">
            <div className="header-center-wrap">
                <div className="header-search-wrap">
                    <Search size={15} className="search-icon-svg" />
                    <input
                        type="text"
                        placeholder="Search videos, titles, scripts, @channels..."
                        className="header-search-input"
                        value={searchQuery}
                        onChange={e => onSearchChange?.(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="search-clear-btn" onClick={() => onSearchChange?.('')} title="Clear search">
                            <X size={13} />
                        </button>
                    )}
                </div>
            </div>

            <div className="header-actions-right">
                {/* Dark / Light Mode Toggle */}
                <button
                    className="theme-toggle-btn"
                    onClick={onToggleDarkMode}
                    title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    aria-label="Toggle theme"
                >
                    <span className={`theme-toggle-track ${isDarkMode ? 'dark' : 'light'}`}>
                        <span className="theme-toggle-thumb">
                            {isDarkMode
                                ? <Moon size={12} strokeWidth={2} />
                                : <Sun size={12} strokeWidth={2} />
                            }
                        </span>
                    </span>
                </button>

                <div className="credits-pill">
                    <span className="credits-value">{credits}</span>
                    <span className="credits-label">Credits</span>
                </div>
            </div>
        </header>
    );
}

export default Header;
