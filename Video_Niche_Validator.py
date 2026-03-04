import os
import json
import time
import logging
import sys
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("video_validation.log")
    ]
)

class VideoNicheValidator:
    def __init__(self):
        # API Keys & URLs
        self.supabase_url = os.environ.get("SUPABASE_URL")
        self.supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
        self.openrouter_key = os.environ.get("OPENROUTER_API_KEY")
        
        if not all([self.supabase_url, self.supabase_key, self.openrouter_key]):
            raise ValueError("Missing environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY, or OPENROUTER_API_KEY")

        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        self.openrouter_url = "https://openrouter.ai/api/v1/chat/completions"
        self.model = "google/gemma-3-27b-it"
        self.rate_limit_delay = 1.0 # Increased slightly for more batches
        self.batch_size = 30 # Updated to 30 as requested

    def get_niches(self):
        """Fetch all niches from niches_list. PK is niche_id."""
        response = self.supabase.table("niches_list").select('niche_id, name, description, "Sub Niche"').execute()
        # Normalise to 'id' key so rest of code stays consistent
        return [{**n, "id": n["niche_id"]} for n in response.data]

    def get_sub_niches(self, niche_id: int):
        """Fetch sub-niches and keywords for a specific niche."""
        response = self.supabase.table("sub_niches") \
            .select("sub_niche_id, id, name, keywords") \
            .eq("niche_id", niche_id) \
            .execute()
        # Normalise: expose sub_niche_id as 'id' for prompt building
        return [{**sn, "id": sn["sub_niche_id"]} for sn in response.data]

    def get_pending_mappings(self, niche_id: int, limit: int = None):
        """Fetch rows from 'videos' table where llm_validated is NULL
        and niche_id matches.
        """
        if limit is None:
            limit = self.batch_size

        response = self.supabase.table("videos") \
            .select("id, title") \
            .is_("llm_validated", "null") \
            .eq("niche_id", niche_id) \
            .limit(limit) \
            .execute()

        if not response.data:
            return []

        # Map to consistent format for the rest of the script
        return [{
            "map_id": item["id"],
            "title": item["title"] or "(no title)"
        } for item in response.data]
        return mappings

    def build_llm_prompt(self, niche_data, mappings):
        """Construct the thematic context prompt provided by the user."""
        items_list = []
        for i, m in enumerate(mappings, 1):
            items_list.append({
                "index": i,
                "map_id": m["map_id"],
                "title": m["title"]
            })

        videos_json = json.dumps(items_list, indent=2)
        sub_niches = niche_data.get("Sub Niche", [])
        sub_niche_list = ", ".join(sub_niches) if sub_niches else "N/A"

        return f"""You are validating video assignments for the Niche: "{niche_data['name']}"

Niche Description:
{niche_data['description']}

This niche includes the following thematic areas:
{sub_niche_list}

CRITICAL RULES:
1. Classify TRUE if the video title clearly fits within the niche description or at least one of the thematic areas listed above.
2. Even if the title is remotely related to the niche, classify TRUE.
3. Only mark False if there is a clear and logical disconnect.
4. THUMB RULE : Ok with including some wrong ones, but not ok with missing out on correct ones.
5. Your main job is to remove the obvious wrong ones - like other langauges than English or VERY OBVIOUS out-of-niche videos.

Videos to classify:
{videos_json}

Return ONLY a JSON object:
{{
  "results": [
    {{ "map_id": "uuid_here", "belongs": true, "reason": "Reason under 10 words" }}
  ]
}}"""


    def call_llm(self, prompt):
        """Call OpenRouter API with retry logic."""
        headers = {
            "Authorization": f"Bearer {self.openrouter_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://creatorjoy.com",
            "X-Title": "Video Validator Service"
        }
        
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": """You are a content classification validator.

Your job is to determine whether each video title fits within the provided niche and its thematic areas.

Rules:
- Mark TRUE only if there is a clear and logical connection to the niche or thematic areas.
- If the title is vague, generic, or purely entertainment/motivational without clear relevance, mark FALSE.
- Provide a short reason (<10 words) for each decision.
- Return ONLY valid JSON."""},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0,
            "top_p": 1,
            "frequency_penalty": 0,
            "presence_penalty": 0,
            "max_tokens": 4000,
            "response_format": { "type": "json_object" }
        }

        for attempt in range(3): # 2 retries
            try:
                response = requests.post(self.openrouter_url, headers=headers, json=payload, timeout=60)
                response.raise_for_status()
                
                content = response.json()['choices'][0]['message']['content']
                
                # Cleanup potential markdown
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0].strip()
                
                parsed = json.loads(content)
                if "results" in parsed and isinstance(parsed["results"], list):
                    return parsed["results"]
                
                raise ValueError("Invalid JSON structure from LLM")

            except Exception as e:
                logging.warning(f"LLM call attempt {attempt + 1} failed: {e}")
                if attempt < 2: time.sleep(2)
        
        return None

    def update_database(self, results):
        """Update Supabase and return success/fail counts."""
        updated = 0
        skipped_by_llm = 0
        total = len(results)
        
        for res in results:
            map_id = res.get("map_id")
            belongs = res.get("belongs")
            reason = res.get("reason", "No reason provided")
            
            if "LLM skipped" in reason:
                skipped_by_llm += 1

            if map_id is None or belongs is None:
                logging.warning(f"Skipping invalid result item: {res}")
                continue

            try:
                self.supabase.table("videos") \
                    .update({"llm_validated": belongs}) \
                    .eq("id", map_id) \
                    .execute()
                
                status = "VALID" if belongs else "INVALID"
                logging.info(f"[{status}] Map ID {map_id}: {reason}")
                updated += 1
            except Exception as e:
                logging.error(f"Failed to update map_id {map_id}: {e}")
        
        return updated, skipped_by_llm

    def run(self, test_mode=False, target_niche_id=None):
        logging.info("Starting Video Validation Script" + (f" [Target Niche ID: {target_niche_id}]" if target_niche_id else ""))
        try:
            niches = self.get_niches()

            # Filter by niche ID if provided
            if target_niche_id:
                niches = [n for n in niches if n['id'] == target_niche_id]
            elif test_mode:
                niches = niches[:1]

            for niche in niches:
                logging.info(f"Processing Niche: {niche['name']} (ID: {niche['id']})")
                
                while True:
                    mappings = self.get_pending_mappings(niche['id'])
                    if not mappings:
                        logging.info(f"No pending videos in 'videos' table for niche: {niche['name']}")
                        break
                    
                    logging.info(f"Analyzing {len(mappings)} videos (Batch size: {self.batch_size})...")
                    start_time = time.time()
                    
                    # 1. Filter out videos with missing titles
                    valid_mappings = []
                    results = []
                    
                    for m in mappings:
                        if m['title'] == "(title not found)" or not m['title'].strip():
                            results.append({
                                "map_id": m["map_id"],
                                "belongs": False,
                                "reason": "Title not found or empty in videos table"
                            })
                        else:
                            valid_mappings.append(m)
                    
                    # 2. Call LLM for videos that have titles
                    if valid_mappings:
                        prompt = self.build_llm_prompt(niche, valid_mappings)
                        llm_results = self.call_llm(prompt)
                        
                        if llm_results:
                            # Check if LLM skipped any IDs we sent
                            received_ids = {r["map_id"] for r in llm_results if "map_id" in r}
                            for m in valid_mappings:
                                if m["map_id"] not in received_ids:
                                    results.append({
                                        "map_id": m["map_id"],
                                        "belongs": False,
                                        "reason": "LLM skipped this item (likely truncation or error)"
                                    })
                            results.extend(llm_results)
                        else:
                            logging.error("Failed to get LLM results for batch. Leaving these videos as NULL (will retry next run).")
                            # Do NOT mark as False — leave llm_validated as NULL so they get retried next run
                            # Skip adding to results entirely

                    # 3. Update database with combined results
                    if results:
                        count, skipped = self.update_database(results)
                        logging.info(f"Batch Summary: {count} successfully updated, {skipped} items skipped by LLM.")
                    
                    # In test mode, stop after one batch
                    if test_mode:
                        logging.info("TEST MODE: Stopping after first batch.")
                        break

                    # Rate limiting
                    elapsed = time.time() - start_time
                    if elapsed < self.rate_limit_delay:
                        time.sleep(self.rate_limit_delay - elapsed)

        except Exception as e:
            logging.critical(f"Fatal error: {e}", exc_info=True)
        logging.info("Validation complete.")

if __name__ == "__main__":
    # Target all niches, test_mode=False will process ALL pending videos
    VideoNicheValidator().run(target_niche_id=None, test_mode=False)
