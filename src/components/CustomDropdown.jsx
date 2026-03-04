import { useState, useRef, useEffect } from 'react';
import './CustomDropdown.css';

function CustomDropdown({ value, options, onChange, label, colorClass }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value) || options[0];

    const handleSelect = (val) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <div className={`custom-dropdown-container ${colorClass}`} ref={dropdownRef}>
            <div className="dropdown-trigger" onClick={() => setIsOpen(!isOpen)}>
                {label && <span className="dropdown-label">{label}</span>}
                <span className="current-value">{selectedOption.label}</span>
                <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </span>
            </div>

            {isOpen && (
                <ul className="dropdown-menu">
                    {options.map((opt) => (
                        <li
                            key={opt.value}
                            className={`dropdown-item ${opt.value === value ? 'active' : ''}`}
                            onClick={() => handleSelect(opt.value)}
                        >
                            {opt.label}
                            {opt.value === value && <span className="check-icon">✓</span>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default CustomDropdown;
