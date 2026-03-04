import replicate
import os
import requests
import uuid
import json
from dotenv import load_dotenv

# Load credentials from .env
load_dotenv()

# Configuration
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_BUCKET = "thumbnails"

# Set replicate token for the library
os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN if REPLICATE_API_TOKEN else ""

def test_generation():
    print("--- 🚀 Starting Generation Test ---")
    
    # 1. Check Env Vars
    if not REPLICATE_API_TOKEN:
        print("❌ Error: REPLICATE_API_TOKEN missing in .env")
        return

    # Use the test images you have in your directory as URLs 
    # (Replicate needs public URLs - I'll use placeholders that Flux can see)
    target_img = "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=1000&auto=format&fit=crop"
    face_img = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1000&auto=format&fit=crop"

    print(f"1. Calling Replicate (flux-2-pro)...")
    try:
        output = replicate.run(
            "black-forest-labs/flux-2-pro",
            input={
                "prompt": (
                    "If multiple people are present:\n\n"
                    "1. Identify the largest and most centered person. Replace that person with the person from the second image.\n"
                    "   The identity must strongly and accurately match the second image.\n"
                    "   Preserve the same overall facial expression, pose, head angle, and hand positioning.\n\n"
                    "2. Remove all other people and replace them with clean background.\n"
                    "Preserve layout, lighting direction, and camera angle."
                ),
                "input_images": [target_img, face_img],
                "resolution": "1 MP",
                "aspect_ratio": "1:1",
                "output_format": "webp"
            }
        )
        replicate_url = output[0] if isinstance(output, list) else str(output)
        print(f"✅ Replicate Generated: {replicate_url}")
    except Exception as e:
        print(f"❌ Replicate Error: {e}")
        return

    # 2. Download
    print(f"2. Downloading result...")
    img_data = requests.get(replicate_url).content

    # 3. Upload to Supabase
    print(f"3. Uploading to Supabase (Bucket: {SUPABASE_BUCKET})...")
    filename = f"test-swap-{uuid.uuid4().hex[:8]}.webp"
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{filename}"
    
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "image/webp"
    }

    resp = requests.post(upload_url, data=img_data, headers=headers)
    
    if resp.status_code in (200, 201):
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{filename}"
        print(f"✅ Success! Image available at:")
        print(f"🔗 {public_url}")
    else:
        print(f"❌ Supabase Upload Failed: {resp.status_code}")
        print(resp.text)

if __name__ == "__main__":
    test_generation()
