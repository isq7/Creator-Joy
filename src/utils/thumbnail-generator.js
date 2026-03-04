/**
 * Utility to communicate with the Backend for generating Flux-2-Pro thumbnails.
 * 
 * If using n8n: Use the n8n webhook URL.
 * If calling FastAPI directly: Use your Hostinger server URL (e.g., http://your-ip:8000/generate-thumbnail).
 */

const API_URL = 'https://n8n.yourserver.com/webhook/generate-thumbnail';

/**
 * Sends a request to the backend to trigger the Replicate Flux model.
 * 
 * @param {string} targetImageUrl The main thumbnail background image URL
 * @param {string} faceImageUrl The image URL of the face to be swapped in
 * @returns {Promise<string>} The generated image URL from Replicate
 */
export const generateSwappedThumbnail = async (targetImageUrl, faceImageUrl) => {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                target_image: targetImageUrl,
                face_image: faceImageUrl
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // The FastAPI server returns { "success": true, "url": "..." }
        if (data.success && data.url) {
            return data.url;
        } else {
            throw new Error(data.error || data.detail || "Failed to generate thumbnail");
        }

    } catch (error) {
        console.error("Error generating thumbnail:", error);
        throw error;
    }
};

/**
 * Example Usage in a React Component:
 * 
 * import { generateSwappedThumbnail } from './thumbnail-generator';
 * 
 * const onGenerateClick = async () => {
 *    setIsLoading(true);
 *    try {
 *       const result = await generateSwappedThumbnail(mainImg, faceImg);
 *       setGeneratedResult(result);
 *    } catch (e) {
 *       alert("Generation failed!");
 *    } finally {
 *       setIsLoading(false);
 *    }
 * }
 */
