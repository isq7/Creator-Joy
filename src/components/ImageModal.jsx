import React from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import './ImageModal.css';

function ImageModal({ imageUrl, title, onClose }) {
    if (!imageUrl) return null;

    const handleDownload = (e) => {
        e.stopPropagation();
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `thumbnail-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleOpenNewTab = (e) => {
        e.stopPropagation();
        window.open(imageUrl, '_blank');
    };

    return (
        <div className="image-modal-overlay" onClick={onClose}>
            <div className="image-modal-wrapper" onClick={e => e.stopPropagation()}>
                <div className="image-modal-header">
                    <div className="image-modal-title">{title || 'Generated Thumbnail'}</div>
                    <div className="image-modal-actions">
                        <button className="modal-action-btn" onClick={handleDownload} title="Download Image">
                            <Download size={18} />
                        </button>
                        <button className="modal-action-btn" onClick={handleOpenNewTab} title="Open in New Tab">
                            <ExternalLink size={18} />
                        </button>
                        <button className="modal-close-btn" onClick={onClose}>
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="image-modal-body">
                    <img src={imageUrl} alt={title || 'Full size thumbnail'} />
                </div>
            </div>
        </div>
    );
}

export default ImageModal;
