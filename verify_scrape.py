from dotenv import load_dotenv
load_dotenv()
import os
import requests
import json

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def supabase_get(table, params=None):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    try:
        r = requests.get(url, headers=HEADERS, params=params, timeout=60)
        r.raise_for_status()
        return r.json() if r.text else []
    except:
        return []

def main():
    print("Checking database for missing data...")

    # 1. Total processed niches
    progress = supabase_get("subniche_pair_progress", {"select": "niche_id"})
    completed_niches = sorted(list(set(p["niche_id"] for p in progress)))
    print(f"\n[Niches Processed]: {len(completed_niches)} / 22")
    if len(completed_niches) < 22:
        missing = [i for i in range(1, 23) if i not in completed_niches]
        print(f"   Missing Niches: {missing}")
    
    # 2. Total Master Creators vs Mapped Creators
    mappings = supabase_get("creator_niche_map", {"select": "creator_id"})
    mapped_ids = set(m["creator_id"] for m in mappings)
    print(f"\n[Total Mapped Creators in Niches]: {len(mapped_ids)}")

    # 3. Creators with scraped Videos
    video_creators = set()
    offset = 0
    while True:
        v = supabase_get("videos", {"select": "creator_id", "offset": offset, "limit": 1000})
        if not v: break
        for item in v:
            video_creators.add(item["creator_id"])
        if len(v) < 1000: break
        offset += 1000

    print(f"[Creators with Scraped Outliers]: {len(video_creators)}")
    
    missing_creators_count = len(mapped_ids - video_creators)
    success_rate = round((len(video_creators)/len(mapped_ids)) * 100, 2) if mapped_ids else 0

    print(f"\n[Success Rate]: {success_rate}%")
    print(f"[Creators returning 0 outlier videos]: {missing_creators_count}")
    print("   *Note: This usually means the creator hasn't posted recently, has a private account, deleted account, or didn't have any reels over the 1.05x median limit.")

if __name__ == "__main__":
    main()
