import { useState, useEffect, useRef } from 'react';
import './RangeSlider.css';

const RangeSlider = ({ min, max, step, value, onChange, label, unit = '', formatValue }) => {
    const [minValue, setMinValue] = useState(value.min);
    const [maxValue, setMaxValue] = useState(value.max);

    useEffect(() => {
        setMinValue(value.min);
        setMaxValue(value.max);
    }, [value]);

    const handleMinChange = (e) => {
        const val = parseFloat(e.target.value);
        if (val < maxValue) {
            setMinValue(val);
            onChange({ min: val, max: maxValue });
        }
    };

    const handleMaxChange = (e) => {
        const val = parseFloat(e.target.value);
        if (val > minValue) {
            setMaxValue(val);
            onChange({ min: minValue, max: val });
        }
    };

    // Calculate percentage for styling the track
    const minPercent = ((minValue - min) / (max - min)) * 100;
    const maxPercent = ((maxValue - min) / (max - min)) * 100;

    return (
        <div className="range-slider-container">
            <div className="range-slider-labels">
                <span className="slider-value">{formatValue ? formatValue(minValue) : minValue}{unit}</span>
                <span className="slider-value">{formatValue ? formatValue(maxValue) : maxValue}{unit}</span>
            </div>
            <div className="slider-track-container">
                <div
                    className="slider-track-highlight"
                    style={{
                        left: `${minPercent}%`,
                        right: `${100 - maxPercent}%`
                    }}
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={minValue}
                    onChange={handleMinChange}
                    className="thumb thumb--left"
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={maxValue}
                    onChange={handleMaxChange}
                    className="thumb thumb--right"
                />
            </div>
        </div>
    );
};

export default RangeSlider;
