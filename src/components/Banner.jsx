import './Banner.css';

function Banner() {
    return (
        <div className="utility-banner">
            <div className="banner-content">
                <span className="banner-text">
                    Creators grow faster together. Be part of the <strong>1of10 Discord</strong> today.
                </span>
                <button className="banner-cta">Join Now</button>
            </div>
            <button className="banner-close">✕</button>
        </div>
    );
}

export default Banner;
