import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './FiltersPanel.css';

// Logarithmic scale helpers for Views & Subscribers
const viewsToSlider = (val) => {
    if (!val) return 0;
    const normalized = val.toString().toLowerCase().trim();
    const num = parseFloat(normalized);
    if (normalized.endsWith('b')) return Math.min(100, (Math.log10(num * 1e9) - 3) * 14.3);
    if (normalized.endsWith('m')) return Math.min(100, (Math.log10(num * 1e6) - 3) * 14.3);
    if (normalized.endsWith('k')) return Math.min(100, (Math.log10(num * 1e3) - 3) * 14.3);
    return Math.min(100, (Math.log10(num || 1000) - 3) * 14.3);
};

const sliderToViews = (s) => {
    const v = Math.pow(10, (s / 14.3) + 3);
    if (v >= 1e9) return `${+(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${Math.round(v / 1e6)}M`;
    if (v >= 1e3) return `${Math.round(v / 1e3)}k`;
    return `${Math.round(v)}`;
};

const subsToSlider = (val) => {
    if (!val && val !== 0) return 0;
    const normalized = val.toString().toLowerCase().trim();
    const num = parseFloat(normalized);
    if (normalized.endsWith('m')) return Math.min(100, (Math.log10(num * 1e6) - 2) * 16.67);
    if (normalized.endsWith('k')) return Math.min(100, (Math.log10(num * 1e3) - 2) * 16.67);
    return Math.min(100, (Math.log10(num || 100) - 2) * 16.67);
};

const sliderToSubs = (s) => {
    const v = Math.pow(10, (s / 16.67) + 2);
    if (v >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${Math.round(v / 1e3)}k`;
    return `${Math.round(v)}`;
};

function DualSlider({ min, max, step, minVal, maxVal, onMinChange, onMaxChange }) {
    const minPercent = ((minVal - min) / (max - min)) * 100;
    const maxPercent = ((maxVal - min) / (max - min)) * 100;

    return (
        <div className="fp-dual-slider">
            <div className="fp-track">
                <div
                    className="fp-track-fill"
                    style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
                />
            </div>
            <input
                type="range" min={min} max={max} step={step}
                value={minVal}
                onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (v < maxVal) onMinChange(v);
                }}
                className="fp-thumb fp-thumb--min"
            />
            <input
                type="range" min={min} max={max} step={step}
                value={maxVal}
                onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (v > minVal) onMaxChange(v);
                }}
                className="fp-thumb fp-thumb--max"
            />
        </div>
    );
}

function FiltersPanel({ isOpen, onClose, filters, onApply, columns, onColumnsChange }) {
    // Local state — only committed on Apply
    const [local, setLocal] = useState({ ...filters });
    const [localCols, setLocalCols] = useState(columns);
    const panelRef = useRef(null);

    // Slider positions (0-100 scale for log filters)
    const [viewMinS, setViewMinS] = useState(viewsToSlider(filters.views?.min || '1k'));
    const [viewMaxS, setViewMaxS] = useState(viewsToSlider(filters.views?.max || '1B'));
    const [subMinS, setSubMinS] = useState(subsToSlider(filters.subscribers?.min || '1k'));
    const [subMaxS, setSubMaxS] = useState(subsToSlider(filters.subscribers?.max || '50M'));

    // Sync when filters prop changes (e.g. reset)
    useEffect(() => {
        setLocal({ ...filters });
        setViewMinS(viewsToSlider(filters.views?.min || '1k'));
        setViewMaxS(viewsToSlider(filters.views?.max || '1B'));
        setSubMinS(subsToSlider(filters.subscribers?.min || '1k'));
        setSubMaxS(subsToSlider(filters.subscribers?.max || '50M'));
        setLocalCols(columns);
    }, [filters, columns]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen, onClose]);

    const DATE_OPTIONS = [
        { value: 'all', label: 'All time' },
        { value: '7d', label: 'Last week' },
        { value: '30d', label: 'Last month' },
        { value: '90d', label: 'Last 3 months' },
        { value: '180d', label: 'Last 6 months' },
        { value: '365d', label: 'Last year' },
        { value: '730d', label: 'Last 2 years' },
    ];

    const DEFAULT_FILTERS = {
        outlierScore: { min: 1, max: 250 },
        views: { min: '1k', max: '1B' },
        subscribers: { min: '1k', max: '50M' },
        dateRange: 'all',
    };

    const handleReset = () => {
        setLocal({ ...DEFAULT_FILTERS });
        setViewMinS(viewsToSlider('1k'));
        setViewMaxS(viewsToSlider('1B'));
        setSubMinS(subsToSlider('1k'));
        setSubMaxS(subsToSlider('50M'));
        setLocalCols(4);
    };

    const handleApply = () => {
        onApply({
            ...local,
            views: { min: sliderToViews(viewMinS), max: sliderToViews(viewMaxS) },
            subscribers: { min: sliderToSubs(subMinS), max: sliderToSubs(subMaxS) },
        }, localCols);
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fp-backdrop">
            <div className="fp-panel" ref={panelRef}>
                {/* Header */}
                <div className="fp-header">
                    <div>
                        <h2 className="fp-title">Filters &amp; Views</h2>
                        <p className="fp-subtitle">Adjust filters and apply when you're done.</p>
                    </div>
                    <button className="fp-close" onClick={onClose}>✕</button>
                </div>

                <div className="fp-body">
                    {/* LEFT: Search Filters */}
                    <div className="fp-section">
                        <div className="fp-section-header">
                            <span className="fp-section-title">Search Filters</span>
                        </div>

                        {/* Outlier Score + Views row */}
                        <div className="fp-sliders-grid">
                            {/* Outlier Score */}
                            <div className="fp-filter-block">
                                <div className="fp-filter-header">
                                    <span className="fp-filter-label">Outlier Score</span>
                                    <span className="fp-filter-range">
                                        {local.outlierScore?.min ?? 1}x — {local.outlierScore?.max ?? 250}x
                                    </span>
                                </div>
                                <DualSlider
                                    min={1} max={250} step={1}
                                    minVal={local.outlierScore?.min ?? 1}
                                    maxVal={local.outlierScore?.max ?? 250}
                                    onMinChange={(v) => setLocal(p => ({ ...p, outlierScore: { ...p.outlierScore, min: v } }))}
                                    onMaxChange={(v) => setLocal(p => ({ ...p, outlierScore: { ...p.outlierScore, max: v } }))}
                                />
                            </div>

                            {/* Views */}
                            <div className="fp-filter-block">
                                <div className="fp-filter-header">
                                    <span className="fp-filter-label">Views</span>
                                    <span className="fp-filter-range">
                                        {sliderToViews(viewMinS)} — {sliderToViews(viewMaxS)}
                                    </span>
                                </div>
                                <DualSlider
                                    min={0} max={100} step={0.5}
                                    minVal={viewMinS}
                                    maxVal={viewMaxS}
                                    onMinChange={setViewMinS}
                                    onMaxChange={setViewMaxS}
                                />
                            </div>

                            {/* Avg Subscriber Count */}
                            <div className="fp-filter-block">
                                <div className="fp-filter-header">
                                    <span className="fp-filter-label">Avg. Subscribers</span>
                                    <span className="fp-filter-range">
                                        {sliderToSubs(subMinS)} — {sliderToSubs(subMaxS)}
                                    </span>
                                </div>
                                <DualSlider
                                    min={0} max={100} step={0.5}
                                    minVal={subMinS}
                                    maxVal={subMaxS}
                                    onMinChange={setSubMinS}
                                    onMaxChange={setSubMaxS}
                                />
                            </div>
                        </div>

                        {/* Publication Date */}
                        <div className="fp-date-block">
                            <span className="fp-filter-label">Publication date</span>
                            <div className="fp-date-pills">
                                {DATE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        className={`fp-date-pill ${local.dateRange === opt.value ? 'active' : ''}`}
                                        onClick={() => setLocal(p => ({ ...p, dateRange: opt.value }))}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: View Preferences */}
                    <div className="fp-prefs-section">
                        <span className="fp-section-title">View Preferences</span>

                        <div className="fp-prefs-body">
                            <div className="fp-pref-item">
                                <span className="fp-filter-label">Columns</span>
                                <div className="fp-columns-control">
                                    <button
                                        className="fp-col-btn"
                                        onClick={() => setLocalCols(c => Math.max(1, c - 1))}
                                    >−</button>
                                    <span className="fp-col-val">{localCols}</span>
                                    <button
                                        className="fp-col-btn"
                                        onClick={() => setLocalCols(c => Math.min(8, c + 1))}
                                    >+</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="fp-footer">
                    <button className="fp-reset-btn" onClick={handleReset}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                        Reset Filters
                    </button>
                    <button className="fp-apply-btn" onClick={handleApply}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        Apply changes
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default FiltersPanel;
