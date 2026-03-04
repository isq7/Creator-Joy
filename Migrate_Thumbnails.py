import os
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# Load credentials from .env
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL or SUPABASE_SERVICE_KEY not found in .env")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
BUCKET_NAME = "video-thumbnails"

def migrate_video_thumbnails():
    print(f"--- Starting Thumbnail Migration to Bucket: {BUCKET_NAME} ---")
    
    # 1. Fetch videos that haven't been migrated yet
    # We select essential fields. 
    # Logic: If thumbnail_url doesn't contain supabase.co, it's external.
    try:
        # Paginate to get ALL rows (Supabase defaults to 1000 row limit per request)
        videos = []
        PAGE_SIZE = 1000
        offset = 0
        while True:
            page = supabase.table("videos") \
                .select("id, thumbnail_url, platform, platform_video_id") \
                .eq("llm_validated", True) \
                .not_.like("thumbnail_url", "%supabase.co%") \
                .range(offset, offset + PAGE_SIZE - 1) \
                .execute()
            if not page.data:
                break
            videos.extend(page.data)
            print(f"  Fetched {len(videos)} videos so far...")
            if len(page.data) < PAGE_SIZE:
                break
            offset += PAGE_SIZE
    except Exception as e:
        print(f"Failed to fetch videos from database: {e}")
        return

    if not videos:
        print("No videos found in the database.")
        return

    success_count = 0
    skipped_count = 0
    error_count = 0

    for video in videos:
        video_id = video.get("id")
        old_url = video.get("thumbnail_url")
        platform = video.get("platform")
        platform_vid = video.get("platform_video_id")

        if not old_url or not platform or not platform_vid:
            print(f"Skipping video {video_id}: Missing metadata.")
            skipped_count += 1
            continue

        # Check if already migrated
        if SUPABASE_URL in old_url:
            # print(f"Skipping video {video_id}: Already migrated.")
            skipped_count += 1
            continue

        print(f"Processing Video {video_id} ({platform})...", end=" ", flush=True)

        try:
            # 2. Download thumbnail
            r = requests.get(old_url, timeout=10)
            r.raise_for_status()
            img_data = r.content
            
            # Use content-type if available, else default to image/jpeg
            content_type = r.headers.get('Content-Type', 'image/jpeg')

            # 3. Define path: platform/platform_video_id.jpg
            # Note: We append .jpg even if it's png for consistency in the request, 
            # but ideally we'd preserve extension. For production thumbnails, .jpg is standard.
            file_path = f"{platform}/{platform_vid}.jpg"

            # 4. Upload to Supabase Storage
            # upsert=True allows replacing/overwriting if it already exists
            try:
                storage_resp = supabase.storage.from_(BUCKET_NAME).upload(
                    path=file_path,
                    file=img_data,
                    file_options={"content-type": content_type, "upsert": "true"}
                )
            except Exception as se:
                # If it still fails but it's a "Duplicate" error, we can ignore and move to DB update
                if "Duplicate" in str(se):
                    pass
                else:
                    raise se
            
            # 5. Get Public URL
            new_public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(file_path)

            # 6. Update row in DB
            supabase.table("videos").update({"thumbnail_url": new_public_url}).eq("id", video_id).execute()

            print("✅ Success")
            success_count += 1

        except Exception as e:
            print(f"❌ Error: {e}")
            error_count += 1
            continue

    print(f"\n--- Migration Complete ---")
    print(f"Successfully Migrated: {success_count}")
    print(f"Skipped (Already/Invalid): {skipped_count}")
    print(f"Errors: {error_count}")

if __name__ == "__main__":
    # Ensure bucket exists check is manual/setup step for the user, 
    # but the script will attempt to run.
    migrate_video_thumbnails()
