import OutlierCard from './OutlierCard';
import './ResultsScreen.css';

function ResultsScreen({ platform, outliers, onBack, onVideoClick }) {
    const platformLabels = {
        facebook: 'Facebook',
        youtube: 'YouTube',
        instagram: 'Instagram',
    };

    const maxMultiplier = outliers.length > 0
        ? Math.max(...outliers.map(v => parseFloat(v.multiplier) || 0))
        : 0;

    return (
        <div className="results-screen">
            <header className="results-header">
                <button className="back-button" onClick={onBack}>
                    ← Back
                </button>
                <h1 className="results-title">
                    {platformLabels[platform]} Outliers
                </h1>
            </header>

            {outliers.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <p>No outliers found for this platform</p>
                </div>
            ) : (
                <div className="outliers-grid">
                    {outliers.map((video, index) => (
                        <OutlierCard
                            key={video.video_url || index}
                            video={video}
                            onVideoClick={onVideoClick}
                            isHighest={parseFloat(video.multiplier) === maxMultiplier}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default ResultsScreen;
