import os
import requests
import statistics
import re as _re
import time
from collections import defaultdict
from dotenv import load_dotenv

# Load credentials from .env
load_dotenv()

# =========================
# CONFIG
# =========================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

APIFY_TOKEN = os.getenv("APIFY_TOKEN")
APIFY_URL = f"https://api.apify.com/v2/acts/instagram-scraper~instagram-profile-reels-scraper/run-sync-get-dataset-items?token={APIFY_TOKEN}"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

PLATFORM = "instagram"


# =========================
# HELPERS
# =========================

def supabase_get(table, params=None):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    r = requests.get(url, headers=HEADERS, params=params, timeout=60)
    r.raise_for_status()
    if not r.text: return []
    try: return r.json()
    except: return []


def supabase_upsert(table, data, conflict_cols):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    params = {"on_conflict": conflict_cols}
    r = requests.post(url, headers=HEADERS, params=params, json=data, timeout=60)
    if r.status_code >= 400:
        msg = f"Supabase Error: {r.text}"
        print(msg, flush=True)
        with open("error_log.txt", "a") as f:
            f.write(msg + "\n")
    r.raise_for_status()
    if not r.text: return {}
    try: return r.json()
    except: return {}


# =========================
# MAIN WORKFLOW LOGIC
# =========================

def run_weekly_niche_scraper(niche_id: int):

    print(f"\n==========================================")
    print(f"STARTING NICHE ID: {niche_id}")
    print(f"==========================================")

    # 1. Get ALL mappings for this niche (Combine everything to save Apify Server Boot fees)
    mappings = supabase_get("creator_niche_map", {"niche_id": f"eq.{niche_id}"})
    if not mappings:
        print("No mappings found. Skipping.")
        return

    # 1.5 Get already processed progress so we can skip them
    processed = supabase_get("subniche_pair_progress", {"niche_id": f"eq.{niche_id}"})
    processed_set = {
        f"{p['niche_id']}_{p['primary_sub_niche_id']}_{p['secondary_sub_niche_id']}"
        for p in processed
    }

    # Track which sub-niche pairs each creator belongs to
    creator_pairs = defaultdict(list)
    creator_ids_set = set()
    
    total_unique_pairs = set()

    for m in mappings:
        pair_key = f"{m['niche_id']}_{m['primary_sub_niche_id']}_{m['secondary_sub_niche_id']}"
        total_unique_pairs.add(pair_key)
        
        # Skip this mapping if its pair was already processed completely
        if pair_key in processed_set:
            continue
            
        c_id = m["creator_id"]
        creator_ids_set.add(c_id)
        creator_pairs[c_id].append({
            "primary": m["primary_sub_niche_id"],
            "secondary": m["secondary_sub_niche_id"]
        })

    if not creator_ids_set:
        print(f"All {len(total_unique_pairs)} pairs were already processed! Skipping.")
        return
    
    print(f"Found {len(creator_ids_set)} unique creators across the entire niche (Unprocessed pairs only).")

    # 2. Grab Usernames for all creators
    usernames_data = []
    # Supabase "in." has limits, so batch creator fetches if large
    c_list = list(creator_ids_set)
    for i in range(0, len(c_list), 150):
        batch_c = c_list[i:i+150]
        c_str = ",".join(map(str, batch_c))
        data = supabase_get("creators_master", {"id": f"in.({c_str})"})
        usernames_data.extend(data)

    print(f"Usernames resolved: {len(usernames_data)}")

    username_to_cid = {u["username"].lower(): u["id"] for u in usernames_data}
    usernames_to_scrape = list(username_to_cid.keys())

    if not usernames_to_scrape:
        print("No valid usernames found. Skipping.")
        return

    # 3. Batch the scraper calls to Apify (Max 100 usernames per single server boot run to keep it extremely cheap)
    # This prevents running 500+ tiny Apify jobs which burns Compute Units
    
    BATCH_SIZE = 100
    all_reels = []

    for i in range(0, len(usernames_to_scrape), BATCH_SIZE):
        batch_users = usernames_to_scrape[i:i + BATCH_SIZE]
        print(f"Calling Apify for batch of {len(batch_users)} usernames... (To minimize $ Server Boot Costs)")

        apify_payload = {
            "instagramUsernames": batch_users,
            "postsPerProfile": 12
        }

        try:
            apify_response = requests.post(
                APIFY_URL,
                headers={"Content-Type": "application/json"},
                json=apify_payload,
                timeout=900
            )
            apify_response.raise_for_status()
            reels = apify_response.json()
            all_reels.extend(reels)
            print(f"Apify returned {len(reels)} reels for this batch.")
        except Exception as e:
            print(f"WARNING: Apify call failed on this batch: {e}")
            print(f"If 403 Forbidden is returned, YOUR $30 MONTHLY LIMIT HAS BEEN HIT.")
            print(f"To fix: Generate a new token in Apify and update APIFY_TOKEN.")
            raise e

    print(f"Finished scraping. Total Reels: {len(all_reels)}")

    if not all_reels:
        return

    # 4. Process all scraped data LOCALLY to calculate medians
    creator_play_counts = defaultdict(list)

    for reel in all_reels:
        u_name = ""
        from_url = reel.get("from_url", "")
        # Parse username from instagram.com/username/...
        m2 = _re.search(r"instagram\.com/([^/]+)", from_url)
        if m2:
            u_name = m2.group(1).lower()
        
        c_id = username_to_cid.get(u_name)
        if c_id:
            v = reel.get("play_count")
            if v is not None:
                try: creator_play_counts[c_id].append(int(v))
                except: pass

    creator_medians = {}
    for c_id, counts in creator_play_counts.items():
        creator_medians[c_id] = int(statistics.median(counts)) if counts else 0
    
    # 5. Build Upsert Batches
    videos_batch = []
    niche_batch = []
    seen_video_ids = set()

    for reel in all_reels:
        from_url = reel.get("from_url", "")
        m3 = _re.search(r"instagram\.com/([^/]+)", from_url)
        username = m3.group(1).lower() if m3 else ""
        creator_id = username_to_cid.get(username)

        if not creator_id: continue
        video_id = reel.get("id")
        if not video_id or video_id in seen_video_ids: continue
        
        seen_video_ids.add(video_id)

        views_raw = reel.get("play_count")
        views = int(views_raw) if views_raw is not None else None
        median = creator_medians.get(creator_id, 0)
        
        multiplier = 0.0
        if views is not None and median > 0:
            multiplier = round(float(views) / float(median), 2)
        
        # Only keep absolute outlier hits > 1.05
        if multiplier < 1.05: continue

        video_url = reel.get("reel_url")

        # Calculate actual published date from PK
        pk_raw = reel.get("pk")
        if pk_raw:
            try:
                # Formula: (BigInt(pk) >> 23n) + 1314220021721n
                ts_ms = (int(pk_raw) >> 23) + 1314220021721
                from datetime import datetime, timezone
                posted_at = datetime.fromtimestamp(ts_ms / 1000.0, tz=timezone.utc).isoformat()
            except Exception:
                posted_at = reel.get("timestamp") or reel.get("posted_at") or reel.get("crawled_at")
        else:
            posted_at = reel.get("timestamp") or reel.get("posted_at") or reel.get("crawled_at")
        
        if views is None or not video_url or not posted_at: continue

        videos_batch.append({
            "platform_video_id": video_id,
            "platform": PLATFORM,
            "creator_id": creator_id,
            "title": reel.get("caption"),
            "thumbnail_url": reel.get("image"), # Save directly as requested
            "views": views,
            "video_url": video_url,
            "posted_at": posted_at,
            "multiplier": multiplier,
            "median_views": median,
            "niche_id": niche_id,
            "llm_validated": None # Set to NULL so the LLM validator handles it
        })

        # Map to EVERY pair this specific creator belongs to in this niche
        for pair in creator_pairs[creator_id]:
            niche_batch.append({
                "platform": PLATFORM,
                "platform_video_id": video_id,
                "video_url": video_url,
                "primary_sub_niche_id": pair["primary"],
                "secondary_sub_niche_id": pair["secondary"]
            })

    # 6. Upload cleanly
    if videos_batch:
        # Supabase chunk limits
        for i in range(0, len(videos_batch), 400):
            supabase_upsert("videos", videos_batch[i:i+400], "platform,platform_video_id")
            
    if niche_batch:
        for i in range(0, len(niche_batch), 400):
            supabase_upsert("videos_niche_map", niche_batch[i:i+400], "platform,platform_video_id,primary_sub_niche_id,secondary_sub_niche_id")

    # 7. Update progress tracker for ALL pairs in this niche
    progress_batch = []
    # Re-iterate the mappings array to track completed pairs
    unique_pairs_processed = set()
    for m in mappings:
        pair_key = f"{m['niche_id']}_{m['primary_sub_niche_id']}_{m['secondary_sub_niche_id']}"
        if pair_key not in unique_pairs_processed:
            unique_pairs_processed.add(pair_key)
            progress_batch.append({
                "niche_id": m["niche_id"],
                "primary_sub_niche_id": m["primary_sub_niche_id"],
                "secondary_sub_niche_id": m["secondary_sub_niche_id"]
            })
            
    if progress_batch:
        for i in range(0, len(progress_batch), 400):
            supabase_upsert("subniche_pair_progress", progress_batch[i:i+400], "niche_id,primary_sub_niche_id,secondary_sub_niche_id")

    print(f"Upserted {len(videos_batch)} unique videos and marked {len(progress_batch)} pairs as processed successfully.")
    print("Done.")


if __name__ == "__main__":
    import math

    # Hardcoding exactly what your niches are based on the old script 
    # (1 to 22 inclusive)
    
    # We will loop through them directly
    niche_ids = list(range(1, 23))

    for nid in niche_ids:
        try:
            run_weekly_niche_scraper(niche_id=nid)
        except Exception as e:
            print(f"FAILED ON NICHE {nid}: {e}")
            if "Forbidden" in str(e) or "403" in str(e):
                print("ABORTING SCRIPT DUE TO $30 APIFY LIMIT HIT.")
                break
            time.sleep(2)
