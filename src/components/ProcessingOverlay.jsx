import { X, Loader2, CheckCircle2, AlertCircle, Video } from 'lucide-react';
import './ProcessingOverlay.css';

function ProcessingOverlay({ state, onClose }) {
    const { status, action, result, phase } = state;

    const getTitle = () => {
        switch (action) {
            case 'script': return 'Generating Script Idea';
            case 'title': return 'Generating High-Click Title';
            case 'thumbnail': return 'Generating Thumbnail Concept';
            case 'avatar_video': return 'Creating AI Avatar Video';
            default: return 'Processing';
        }
    };

    const getLoadingMessage = () => {
        if (action === 'avatar_video') {
            switch (phase) {
                case 'sending': return 'Sending your video to the AI pipeline...';
                case 'waiting': return 'AI is building your avatar video. This usually takes 2–4 minutes...';
                case 'polling': return 'Checking if your video is ready...';
                default: return 'Preparing your avatar video...';
            }
        }
        switch (action) {
            case 'script': return 'Analyzing video hooks and patterns...';
            case 'title': return 'Testing outlier title variations...';
            case 'thumbnail': return 'Designing visual compositions...';
            default: return 'Please wait while we process your request...';
        }
    };

    const getEstimatedTime = () => {
        if (action !== 'avatar_video') return null;
        switch (phase) {
            case 'sending': return 'Est. 2–5 minutes total';
            case 'waiting': return 'Est. 1–3 minutes remaining';
            case 'polling': return 'Almost there...';
            default: return null;
        }
    };

    return (
        <div className="processing-overlay">
            <div className="processing-content">
                <button className="close-overlay" onClick={onClose}>
                    <X size={20} />
                </button>

                <div className="processing-body">
                    {status === 'loading' && (
                        <div className="state-loading">
                            {action === 'avatar_video' ? (
                                <div className="avatar-loading-icon">
                                    <Video size={40} className="avatar-icon-inner" />
                                    <div className="avatar-icon-ring" />
                                </div>
                            ) : (
                                <Loader2 className="spinner-icon" size={48} />
                            )}
                            <h2>{getTitle()}</h2>
                            <p>{getLoadingMessage()}</p>
                            {getEstimatedTime() && (
                                <div className="estimated-time">{getEstimatedTime()}</div>
                            )}
                            <div className="progress-bar-container">
                                <div className="progress-bar-fill"></div>
                            </div>
                            {action === 'avatar_video' && (
                                <div className="avatar-steps">
                                    <div className={`avatar-step ${phase === 'sending' ? 'active' : (phase === 'waiting' || phase === 'polling') ? 'done' : ''}`}>
                                        <span className="step-dot" />
                                        Sending to pipeline
                                    </div>
                                    <div className={`avatar-step ${phase === 'waiting' ? 'active' : phase === 'polling' ? 'done' : ''}`}>
                                        <span className="step-dot" />
                                        Generating video
                                    </div>
                                    <div className={`avatar-step ${phase === 'polling' ? 'active' : ''}`}>
                                        <span className="step-dot" />
                                        Finalising & saving
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="state-success">
                            <CheckCircle2 className="success-icon" size={64} />
                            <h2 className="success-title">Generation Complete!</h2>
                            <p className="success-subtitle">
                                {`We've successfully generated your ${action === 'script' ? 'idea' : action}.`}
                            </p>
                            <div className="redirect-countdown">
                                <div className="redirect-spinner"></div>
                                Opening {action === 'script' ? 'Idea' : action.charAt(0).toUpperCase() + action.slice(1)} Lab...
                            </div>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="state-error">
                            <AlertCircle className="error-icon" size={48} />
                            <h2>Generation Failed</h2>
                            <p>{result || 'An unexpected error occurred. Please try again later.'}</p>
                            <button className="retry-btn" onClick={onClose}>Close</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ProcessingOverlay;
