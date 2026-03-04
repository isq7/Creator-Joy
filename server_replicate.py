from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import replicate
import os
import uuid
import httpx
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "")
SUPABASE_URL        = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# The Supabase Storage bucket where generated images will be stored.
# Make sure this bucket exists and is set to PUBLIC in your Supabase dashboard.
SUPABASE_BUCKET = "thumbnails"

os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN

app = FastAPI(title="Flux Thumbnail Generator API")

# Allow requests from your website's domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict this to your domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request Schema ────────────────────────────────────────────────────────────

class GenerationRequest(BaseModel):
    target_image: str   # URL of the main thumbnail / background image
    face_image: str     # URL of the face to be swapped in

# ─── Health Check ──────────────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {"status": "Flux Thumbnail API is running ✅"}

# ─── Main Endpoint ─────────────────────────────────────────────────────────────

@app.post("/generate-thumbnail")
async def generate_thumbnail(request: GenerationRequest):
    """
    Full pipeline:
    1. Accept two image URLs (target + face)
    2. Run Flux-2-Pro on Replicate to generate a new image
    3. Download the generated image from Replicate
    4. Upload the image to Supabase Storage (thumbnails bucket)
    5. Return the permanent public Supabase URL
    """

    # ── Validate env vars ────────────────────────────────────────────────────
    if not REPLICATE_API_TOKEN:
        raise HTTPException(status_code=500, detail="REPLICATE_API_TOKEN is missing from .env")
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="Supabase credentials are missing from .env")

    # ── Step 0: Validate Inputs ──────────────────────────────────────────────
    if not request.target_image or not request.face_image:
        raise HTTPException(status_code=400, detail="Missing image URLs. Both target_image and face_image are required.")
    
    if not request.target_image.startswith("http") or not request.face_image.startswith("http"):
        raise HTTPException(status_code=400, detail="Invalid URLs. Image links must start with http:// or https://")

    # ── Step 1: Run Replicate Flux-2-Pro ─────────────────────────────────────
    try:
        output = replicate.run(
            "black-forest-labs/flux-2-pro",
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
                "input_images": [request.target_image, request.face_image],
                "resolution": "1 MP",
                "aspect_ratio": "1:1",
                "output_format": "webp",
                "output_quality": 80,
                "safety_tolerance": 2
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Replicate error: {str(e)}")

    # Get the raw generated image URL from Replicate
    replicate_url = output[0] if isinstance(output, list) else str(output)

    # ── Step 2: Download the image from Replicate ─────────────────────────────
    async with httpx.AsyncClient(timeout=60) as client:
        img_response = await client.get(replicate_url)
        if img_response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to download generated image from Replicate")
        image_bytes = img_response.content

    # ── Step 3: Upload to Supabase Storage ────────────────────────────────────
    # Generate a unique filename so we never overwrite old images
    filename = f"{uuid.uuid4()}.webp"
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{filename}"

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "image/webp",
    }

    async with httpx.AsyncClient(timeout=60) as client:
        upload_response = await client.post(upload_url, content=image_bytes, headers=headers)
        if upload_response.status_code not in (200, 201):
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload image to Supabase: {upload_response.text}"
            )

    # ── Step 4: Build the public Supabase URL and return ──────────────────────
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{filename}"

    return {
        "success": True,
        "url": public_url
    }


# ─── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
