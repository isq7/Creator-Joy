import replicate
import sys
import os
import json
from dotenv import load_dotenv

# Load API Key from .env file
load_dotenv()

# Set Replicate API Token from environment variable
# n8n should manage this, or it must be in the .env file
os.environ["REPLICATE_API_TOKEN"] = os.getenv("REPLICATE_API_TOKEN", "")

def run_flux_swap(target_url, face_url):
    """
    Run the Flux model on Replicate to swap the face of the largest person.
    """
    if not os.environ["REPLICATE_API_TOKEN"]:
        print(json.dumps({
            "success": False, 
            "error": "REPLICATE_API_TOKEN is not set. Please add it to your .env file."
        }))
        return

    try:
        # Using black-forest-labs/flux-1.1-pro as the current state-of-the-art
        # Adjust the model name if you have a specific private variant
        output = replicate.run(
            "black-forest-labs/flux-1.1-pro",
            input={
                "prompt": (
                    "If multiple people are present:\n\n"
                    "1. Identify the largest and most centered person. Replace that person with the person from the second image.\n"
                    "   The identity must strongly and accurately match the second image.\n"
                    "   Preserve the same overall facial expression, pose, head angle, and hand positioning.\n"
                    "   Do not alter the facial structure of the second image identity.\n\n"
                    "2. Remove all other people and replace them with clean background that matches the surrounding area naturally.\n\n"
                    "Preserve layout, lighting direction, camera angle, and design elements.\n"
                    "Do not leave extra faces in the image."
                ),
                "input_images": [target_url, face_url],
                "resolution": "1 MP",
                "aspect_ratio": "1:1",
                "output_format": "webp",
                "output_quality": 80,
                "safety_tolerance": 1
            }
        )
        
        # Replicate usually returns a list or a single URL depending on the model version
        result_url = output[0] if isinstance(output, list) else str(output)
        
        # Final output for n8n to parse
        print(json.dumps({
            "success": True, 
            "url": result_url
        }))

    except Exception as e:
        print(json.dumps({
            "success": False, 
            "error": str(e)
        }))

if __name__ == "__main__":
    # Expects [script_name, target_url, face_url]
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False, 
            "error": "Usage: python generate_thumbnail_flux.py <target_url> <face_url>"
        }))
    else:
        target_img = sys.argv[1]
        face_img = sys.argv[2]
        run_flux_swap(target_img, face_img)
