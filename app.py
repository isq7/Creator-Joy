import os
import sys
import json
import re
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import traceback

import yt_dlp
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

# --------------------------------------------------------------------------------------
# Flask app
# --------------------------------------------------------------------------------------
app = Flask(__name__)
CORS(app)

# --------------------------------------------------------------------------------------
# Instagram config & session management
# --------------------------------------------------------------------------------------
INSTAGRAM_USERNAME = os.getenv("INSTAGRAM_USERNAME", "creatorjoy9")
INSTAGRAM_PASSWORD = os.getenv("INSTAGRAM_PASSWORD", "Allahisgreat@1234567")

# On Render, prefer a persistent disk (e.g. /data). Fallback to local file when not on Render.
SESSION_FILE = Path(
    os.getenv(
        "INSTAGRAM_SESSION_FILE",
        "/data/session_data.json" if os.getenv("RENDER") else "session_data.json",
    )
)

# Selenium Remote WebDriver URL (Selenium standalone Chrome running elsewhere)
# Example: http://<vps-ip>:4444/wd/hub
SELENIUM_REMOTE_URL = os.getenv("SELENIUM_REMOTE_URL")

session_data = {
    "cookie": None,
    "expires_at": None,
}


def load_session():
    """Load session from file"""
    global session_data

    if SESSION_FILE.exists():
        try:
            with open(SESSION_FILE, "r") as f:
                data = json.load(f)
                session_data["cookie"] = data.get("cookie")
                session_data["expires_at"] = data.get("expires_at")
                print(f"Loaded Instagram session from file: {SESSION_FILE}")
        except Exception as e:
            print(f"Failed to load session file: {e}", file=sys.stderr)


def save_session():
    """Save session to file"""
    try:
        SESSION_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(SESSION_FILE, "w") as f:
            json.dump(session_data, f)
        print(f"Saved Instagram session to file: {SESSION_FILE}")
    except Exception as e:
        print(f"Failed to save session file: {e}", file=sys.stderr)


def is_session_valid():
    """Check if current session is still valid"""
    if not session_data["cookie"]:
        return False

    if not session_data["expires_at"]:
        return False

    try:
        expires = datetime.fromisoformat(session_data["expires_at"])
    except Exception:
        return False

    # Check if expired (with 1 hour buffer)
    if datetime.now() >= expires - timedelta(hours=1):
        return False

    return True


def refresh_session_selenium():
    """
    Refresh session using Selenium.
    Uses Remote WebDriver (SELENIUM_REMOTE_URL) so that
    Chrome runs in a separate Selenium container/host.
    """
    try:
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.webdriver.chrome.options import Options

        if not SELENIUM_REMOTE_URL:
            print(
                "SELENIUM_REMOTE_URL not set; cannot refresh Instagram session",
                file=sys.stderr,
            )
            return None

        print(f"Refreshing Instagram session via Selenium Remote at {SELENIUM_REMOTE_URL}...")

        chrome_options = Options()
        # Headless usually controlled on Selenium host; these flags still help stability.
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument(
            "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )

        # Remote WebDriver instead of local Chrome
        driver = webdriver.Remote(
            command_executor=SELENIUM_REMOTE_URL,
            options=chrome_options,
        )

        try:
            driver.get("https://www.instagram.com/accounts/login/")
            time.sleep(5)

            # Try to accept cookies / allow all if banner appears
            try:
                cookies_button = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable(
                        (
                            By.XPATH,
                            "//button[contains(text(),'Allow all') or "
                            "contains(text(),'Accept all') or "
                            "contains(text(),'Accept All') or "
                            "contains(text(),'Accept')]",
                        )
                    )
                )
                cookies_button.click()
                print("Clicked cookies/accept button on Instagram")
                time.sleep(2)
            except Exception:
                print("No cookies/accept banner detected")

            # Now wait a bit longer for the login fields
            try:
                username_field = WebDriverWait(driver, 20).until(
                    EC.presence_of_element_located((By.NAME, "username"))
                )
            except Exception:
                # Fallback: look for input[type='text'] if name is different
                try:
                    username_field = WebDriverWait(driver, 5).until(
                        EC.presence_of_element_located(
                            (
                                By.CSS_SELECTOR,
                                "input[name='username'], input[type='text']",
                            )
                        )
                    )
                except Exception:
                    print(
                        "Could not find username field on Instagram login page",
                        file=sys.stderr,
                    )
                    traceback.print_exc()
                    return None

            password_field = driver.find_element(By.NAME, "password")

            username_field.send_keys(INSTAGRAM_USERNAME)
            password_field.send_keys(INSTAGRAM_PASSWORD)

            login_button = driver.find_element(
                By.CSS_SELECTOR, "button[type='submit']"
            )
            login_button.click()

            time.sleep(5)

            try:
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located(
                        (By.CSS_SELECTOR, "svg[aria-label='Home']")
                    )
                )
                print("Instagram login successful")
            except Exception:
                print("Instagram login may have failed or needs verification")

            cookies = driver.get_cookies()
            auth_cookies = {}

            REQUIRED_COOKIES = {
                "sessionid",
                "csrftoken",
                "ds_user_id",
                "mid",
                "ig_did",
            }

            for cookie in cookies:
                name = cookie.get("name")
                if name in REQUIRED_COOKIES:
                    auth_cookies[name] = cookie.get("value")

            if "sessionid" not in auth_cookies:
                print("sessionid missing, login failed")
                return None

            session_data["cookie"] = auth_cookies
            session_data["expires_at"] = (
                datetime.now() + timedelta(days=30)
            ).isoformat()

            save_session()
            print(f"Saved Instagram cookies: {list(auth_cookies.keys())}")
            return auth_cookies

        finally:
            driver.quit()

    except ImportError:
        print("Selenium not installed. Install with: pip install selenium", file=sys.stderr)
        return None
    except Exception as e:
        print("Error refreshing Instagram session:", file=sys.stderr)
        traceback.print_exc()
        return None


def get_valid_session():
    """Get a valid session cookie, refresh if needed"""
    if not session_data["cookie"]:
        load_session()

    if is_session_valid():
        print("Using existing Instagram session")
        return session_data["cookie"]

    print("Instagram session expired or missing, refreshing...")
    return refresh_session_selenium()


class InstagramScraperAPI:
    """Instagram scraper with auto session management"""

    def __init__(self, session_cookie):
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.instagram.com/",
            "X-Requested-With": "XMLHttpRequest",
            "X-IG-App-ID": "936619743392459",
            "X-ASBD-ID": "129477",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
        }

        self.session = requests.Session()

        if isinstance(session_cookie, dict):
            for name, value in session_cookie.items():
                self.session.cookies.set(name, value, domain=".instagram.com")

            if "csrftoken" in session_cookie:
                self.headers["X-CSRFToken"] = session_cookie["csrftoken"]
        else:
            self.session.cookies.set(
                "sessionid", session_cookie, domain=".instagram.com"
            )

        self.session.headers.update(self.headers)

    def scrape_reels(
        self, username: str, days: int = 90, max_reels: int = 50
    ) -> List[Dict[str, Any]]:
        user_id = self._get_user_id(username)
        if not user_id:
            raise ValueError(f"Failed to resolve user ID for {username}")

        cutoff_timestamp = (datetime.now() - timedelta(days=days)).timestamp()
        print(f"Instagram: scraping up to {max_reels} reels or last {days} days")

        all_reels: List[Dict[str, Any]] = []
        seen_ids = set()
        max_id: Optional[str] = None
        stop_reason: Optional[str] = None

        while True:
            clips_data = self._fetch_clips_page(user_id, username, max_id)

            if not clips_data:
                break

            items = clips_data.get("items", []) or []
            if not items:
                break

            for item in items:
                if item.get("media_type") != 2:
                    continue

                taken_at = item.get("taken_at", 0)

                if len(all_reels) >= 3 and taken_at < cutoff_timestamp:
                    stop_reason = f"date cutoff ({days} days)"
                    break

                item_id = item.get("id")
                if item_id in seen_ids:
                    continue

                seen_ids.add(item_id)
                all_reels.append(self._parse_reel_item(item, username))

                if len(all_reels) >= max_reels:
                    stop_reason = f"max reels ({max_reels})"
                    break

            if stop_reason:
                print(f"Instagram: stopped {stop_reason}")
                break

            next_max_id = clips_data.get("next_max_id")
            more_available = clips_data.get("more_available", False)

            if not more_available or not next_max_id or next_max_id == max_id:
                print("Instagram: no more reels available")
                break

            max_id = next_max_id

        return all_reels

    def _get_user_id(self, username: str) -> Optional[str]:
        url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={username}"

        try:
            response = self.session.get(url, timeout=10)
            print(f"web_profile_info status: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                user_data = data.get("data", {}).get("user", {})
                user_id = user_data.get("pk") or user_data.get("id")
                print(f"Instagram user ID: {user_id}")
                return user_id
            else:
                print(f"Failed to get user ID: {response.status_code}")
        except Exception as e:
            print(f"Error getting user ID: {e}", file=sys.stderr)
        return None

    def _fetch_clips_page(
        self, user_id: str, username: str, max_id: Optional[str]
    ) -> Optional[Dict]:
        try:
            url = f"https://www.instagram.com/api/v1/feed/user/{user_id}/"
            params = {"count": "12"}
            if max_id:
                params["max_id"] = max_id

            response = self.session.get(url, params=params, timeout=15)

            if response.status_code == 200:
                data = response.json()
                items_count = len(data.get("items", []))
                print(f"Instagram feed: fetched {items_count} items")
                return data
            else:
                print(f"Feed endpoint failed: {response.status_code}")
        except Exception as e:
            print(f"Error fetching feed: {e}", file=sys.stderr)

        return None

    def _parse_reel_item(self, item: Dict, username: str) -> Dict[str, Any]:
        caption_obj = item.get("caption", {})
        caption = caption_obj.get("text", "") if caption_obj else ""

        user = item.get("user", {})
        video_versions = item.get("video_versions", [])
        video_url = video_versions[0].get("url", "") if video_versions else ""

        image_versions = item.get("image_versions2", {}).get("candidates", [])
        thumbnail = image_versions[0].get("url", "") if image_versions else ""

        like_count = item.get("like_count", 0)
        comment_count = item.get("comment_count", 0)
        play_count = item.get("play_count", 0) or item.get("view_count", 0)

        taken_at = item.get("taken_at", 0)
        date_posted = (
            datetime.fromtimestamp(taken_at).strftime("%Y-%m-%d %H:%M:%S")
            if taken_at
            else ""
        )
        code = item.get("code", "")
        hashtags = re.findall(r"#(\w+)", caption)

        return {
            "id": item.get("id", ""),
            "shortcode": code,
            "url": f"https://www.instagram.com/reel/{code}/",
            "username": user.get("username", username),
            "full_name": user.get("full_name", ""),
            "caption": caption,
            "hashtags": hashtags,
            "view_count": play_count,
            "likes": like_count,
            "comments": comment_count,
            "date_posted": date_posted,
            "timestamp": taken_at,
            "thumbnail": thumbnail,
            "video_url": video_url,
            "duration": item.get("video_duration", 0),
        }


# --------------------------------------------------------------------------------------
# YouTube scraping functions (yt-dlp)
# --------------------------------------------------------------------------------------
def scrape_channel_fast(channel_url, max_videos=30, days=90):
    """
    Fast scan: get video list + basic metadata.
    Date filtering is done later in fill_missing_metadata.
    """
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "skip_download": True,
        "playlistend": max_videos,
        "extractor_args": {"youtube": {"skip": ["comments"]}},
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(channel_url, download=False)
        except Exception as e:
            print(f"Error fetching channel info: {e}", file=sys.stderr)
            return None

        channel_name = info.get("channel", "Unknown")
        channel_id = info.get("channel_id", "Unknown")
        channel_url = info.get("channel_url", channel_url)
        channel_views = info.get("channel_view_count", 0)

        video_data = []

        entries = info.get("entries", []) or []
        for entry in entries:
            if len(video_data) >= max_videos:
                break

            video_id = entry.get("id")
            if not video_id:
                continue

            title = entry.get("title", "No title")
            view_count = entry.get("view_count", 0)

            raw_description = entry.get("description", "") or ""
            description = str(raw_description)

            duration = entry.get("duration", 0)
            upload_date_str = entry.get("upload_date", "") or ""

            hashtags = re.findall(r"#\w+", description)

            video_data.append(
                {
                    "video_id": video_id,
                    "title": title,
                    "view_count": view_count,
                    "description": description,
                    "hashtags": hashtags,
                    "upload_date": upload_date_str,
                    "upload_datetime": None,
                    "thumbnail_url": entry.get("thumbnail", "") or "",
                    "duration_seconds": duration,
                    "video_url": f"https://www.youtube.com/watch?v={video_id}",
                }
            )

        return {
            "channel_name": channel_name,
            "channel_id": channel_id,
            "channel_url": channel_url,
            "total_channel_views": channel_views,
            "total_videos_fetched": len(video_data),
            "videos": video_data,
        }


def fill_missing_metadata(video_list, max_workers=5, days=None):
    """
    For each video in video_list, fetch full metadata to fill upload_date,
    thumbnail_url, description, view_count, etc. Apply date cutoff if days is set.
    """
    cookies_path = os.getenv("YTDLP_COOKIES_FILE")  # e.g. "/app/youtube_cookies.txt"

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
    }

    if cookies_path:
        ydl_opts["cookies"] = cookies_path

    cutoff_dt = None
    if days is not None:
        cutoff_dt = datetime.now() - timedelta(days=days)

    def fetch_one(video):
        video_id = video["video_id"]
        video_url = f"https://www.youtube.com/watch?v={video_id}"

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)

            upload_date_str = video.get("upload_date") or info.get("upload_date", "") or ""
            video["upload_date"] = upload_date_str

            upload_dt = None
            if upload_date_str:
                try:
                    upload_dt = datetime.strptime(upload_date_str, "%Y%m%d")
                    video["upload_datetime"] = upload_dt.isoformat()
                except Exception:
                    upload_dt = None

            video["_upload_dt"] = upload_dt

            if not video.get("thumbnail_url"):
                video["thumbnail_url"] = info.get("thumbnail", "") or ""

            if not video.get("description"):
                raw_desc = info.get("description", "") or ""
                video["description"] = str(raw_desc)

            if video.get("view_count", 0) == 0:
                video["view_count"] = info.get("view_count", 0) or 0

            desc_for_tags = video.get("description", "") or ""
            desc_for_tags = str(desc_for_tags)
            video["hashtags"] = re.findall(r"#\w+", desc_for_tags)

            return video_id, None
        except Exception as e:
            return video_id, str(e)

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(fetch_one, v) for v in video_list]
        for future in as_completed(futures):
            video_id, error = future.result()
            if error:
                print(f"Failed to fetch metadata for {video_id}: {error}", file=sys.stderr)

    if cutoff_dt is not None:
        filtered = []
        for v in video_list:
            upload_dt = v.get("_upload_dt")
            if upload_dt is None or upload_dt >= cutoff_dt:
                filtered.append(v)
        video_list = filtered

    for v in video_list:
        v.pop("_upload_dt", None)

    return video_list


# --------------------------------------------------------------------------------------
# Error handling (JSON)
# --------------------------------------------------------------------------------------
@app.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, HTTPException):
        return e
    return jsonify({"error": "Internal Server Error", "details": str(e)}), 500


# --------------------------------------------------------------------------------------
# Health endpoints
# --------------------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def root_health():
    return jsonify(
        {
            "status": "ok",
            "service": "social-scraper",
        }
    ), 200


@app.route("/instagram/health", methods=["GET"])
def instagram_health():
    return jsonify(
        {
            "status": "ok",
            "service": "instagram-scraper",
            "session_valid": is_session_valid(),
        }
    ), 200


@app.route("/youtube/health", methods=["GET"])
def youtube_health():
    return jsonify({"status": "ok", "service": "youtube-scraper"}), 200


# --------------------------------------------------------------------------------------
# Instagram routes
# --------------------------------------------------------------------------------------
@app.route("/instagram/refresh-session", methods=["POST"])
def instagram_refresh_session_endpoint():
    cookie = refresh_session_selenium()

    if cookie:
        return jsonify({"success": True, "message": "Session refreshed successfully"})
    else:
        msg = "Failed to refresh session"
        if not SELENIUM_REMOTE_URL:
            msg += " (SELENIUM_REMOTE_URL not configured)"
        return jsonify({"success": False, "error": msg}), 500


@app.route("/instagram/scrape", methods=["POST"])
def instagram_scrape_reels():
    try:
        data = request.get_json()

        target_username = data.get("target_username")
        days = int(data.get("days", 90))
        max_reels = int(data.get("max_reels", 50))

        if not target_username:
            return (
                jsonify(
                    {"success": False, "error": "target_username is required"}
                ),
                400,
            )

        print(
            f"Instagram scrape request for @{target_username} "
            f"(max {max_reels}, {days} days)"
        )

        session_cookie = get_valid_session()

        if not session_cookie:
            return (
                jsonify(
                    {
                        "success": False,
                        "error": "Could not obtain valid Instagram session",
                    }
                ),
                401,
            )

        scraper = InstagramScraperAPI(session_cookie)
        reels = scraper.scrape_reels(
            target_username, days=days, max_reels=max_reels
        )

        if not reels:
            return jsonify(
                {
                    "success": True,
                    "count": 0,
                    "target_username": target_username,
                    "reels": [],
                    "message": "No reels found",
                }
            )

        print(f"Instagram: {len(reels)} reels scraped")

        view_counts = [r["view_count"] for r in reels]
        view_counts_sorted = sorted(view_counts)
        median_views = (
            view_counts_sorted[len(view_counts_sorted) // 2] if view_counts else 0
        )
        avg_views = sum(view_counts) // len(view_counts) if view_counts else 0

        outlier_threshold = median_views * 2
        outliers = [r for r in reels if r["view_count"] > outlier_threshold]

        return jsonify(
            {
                "success": True,
                "count": len(reels),
                "target_username": target_username,
                "days_limit": days,
                "max_reels_limit": max_reels,
                "reels": reels,
                "stats": {
                    "total_views": sum(r["view_count"] for r in reels),
                    "total_likes": sum(r["likes"] for r in reels),
                    "total_comments": sum(r["comments"] for r in reels),
                    "avg_views": avg_views,
                    "median_views": median_views,
                    "min_views": min(view_counts) if view_counts else 0,
                    "max_views": max(view_counts) if view_counts else 0,
                    "outliers_count": len(outliers),
                    "outlier_threshold": outlier_threshold,
                    "consistency_score": round(
                        (median_views / avg_views * 100), 2
                    )
                    if avg_views > 0
                    else 0,
                },
            }
        )

    except ValueError as ve:
        print(f"Instagram error: {ve}", file=sys.stderr)
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as e:
        print(f"Instagram error: {e}", file=sys.stderr)
        return jsonify({"success": False, "error": str(e)}), 500


# --------------------------------------------------------------------------------------
# YouTube routes
# --------------------------------------------------------------------------------------
@app.route("/youtube/scrape", methods=["POST"])
def youtube_scrape_batch():
    """
    Accepts JSON body:
    [
      {
        "handle": "cristiano",
        "max_reels": 30,
        "days": "90"
      }
    ]
    """
    try:
        data = request.get_json(force=True, silent=False)
    except Exception as e:
        return (
            jsonify({"error": "Invalid JSON", "details": str(e)}),
            400,
        )

    if data is None:
        return jsonify({"error": "Missing JSON body"}), 400

    if not isinstance(data, list):
        return jsonify({"error": "Body must be a JSON array"}), 400

    results = []

    for item in data:
        if not isinstance(item, dict):
            results.append(
                {
                    "error": "Each array item must be an object",
                    "raw": item,
                }
            )
            continue

        handle = item.get("handle")
        max_reels = item.get("max_reels", 30)
        days = item.get("days", 90)

        try:
            max_reels = int(max_reels)
            days = int(days)
        except ValueError:
            results.append(
                {
                    "handle": handle,
                    "error": "max_reels and days must be integers",
                }
            )
            continue

        if not handle:
            results.append({"handle": handle, "error": "Missing handle"})
            continue

        channel_url = f"https://www.youtube.com/@{handle}/videos"

        result = scrape_channel_fast(
            channel_url=channel_url,
            max_videos=max_reels,
            days=days,
        )

        if result is None:
            results.append(
                {
                    "handle": handle,
                    "channel_url": channel_url,
                    "error": "Failed to fetch channel data",
                }
            )
            continue

        result["videos"] = fill_missing_metadata(
            result["videos"],
            max_workers=5,
            days=days,
        )

        results.append(
            {
                "handle": handle,
                "channel_url": channel_url,
                **result,
            }
        )

    return jsonify(results), 200


# --------------------------------------------------------------------------------------
# Local dev entrypoint
# --------------------------------------------------------------------------------------
if __name__ == "__main__":
    # Load existing Instagram session on startup (local dev)
    load_session()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=False)
    
