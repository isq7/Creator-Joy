import { useState, useRef, useEffect } from 'react';
import RangeSlider from './RangeSlider';
import './CustomDropdown.css'; // Reuse dropdown styling
import './SliderDropdown.css';

function SliderDropdown({ value, onChange, label, min, max, step, unit = '', formatValue, colorClass }) {
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

    const displayValue = `${formatValue ? formatValue(value.min) : value.min}${unit} - ${formatValue ? formatValue(value.max) : value.max}${unit}`;

    return (
        <div className={`custom-dropdown-container slider-dropdown ${colorClass}`} ref={dropdownRef}>
            <div className={`dropdown-trigger ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(!isOpen)}>
                {label && <span className="dropdown-label">{label}</span>}
                <span className="current-value">{displayValue}</span>
                <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </span>
            </div>

            {isOpen && (
                <div className="slider-dropdown-menu">
                    <RangeSlider
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={onChange}
                        unit={unit}
                        formatValue={formatValue}
                    />
                </div>
            )}
        </div>
    );
}

export default SliderDropdown;
