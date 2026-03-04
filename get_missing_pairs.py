from dotenv import load_dotenv
load_dotenv()
import os

import requests

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def get_unprocessed(niche_ids):
    # Get all processed pairs for these niches (filtered by niche_id to avoid 1000-row limit)
    processed_url = f"{SUPABASE_URL}/rest/v1/subniche_pair_progress"
    processed_set = set()
    for n_id in niche_ids:
        processed_resp = requests.get(processed_url, headers=HEADERS, params={"niche_id": f"eq.{n_id}"})
        processed_data = processed_resp.json()
        for p in processed_data:
            processed_set.add(f"{p['niche_id']}_{p['primary_sub_niche_id']}_{p['secondary_sub_niche_id']}")

    # Get all mappings for these niches
    mappings_url = f"{SUPABASE_URL}/rest/v1/creator_niche_map"
    mappings_resp = requests.get(mappings_url, headers=HEADERS, params={"niche_id": f"in.({','.join(map(str, niche_ids))})"})
    mappings_data = mappings_resp.json()

    results = {n: [] for n in niche_ids}
    
    for m in mappings_data:
        n_id = m['niche_id']
        key = f"{n_id}_{m['primary_sub_niche_id']}_{m['secondary_sub_niche_id']}"
        if key not in processed_set:
            pair_str = f"{m['primary_sub_niche_id']}_{m['secondary_sub_niche_id']}"
            if pair_str not in results[n_id]:
                results[n_id].append(pair_str)
    
    for n_id in niche_ids:
        print(f"\n--- NICHE {n_id} ---")
        print(f"Total Unprocessed: {len(results[n_id])}")
        if results[n_id]:
            print(f"Pairs: {', '.join(results[n_id])}")
        else:
            print("All pairs processed!")

if __name__ == "__main__":
    get_unprocessed([20, 21, 22])
