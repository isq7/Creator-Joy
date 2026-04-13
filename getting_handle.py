from flask import Flask, request, jsonify
from playwright.sync_api import sync_playwright
import re
import sys
import traceback

app = Flask(__name__)

def log(msg):
    print(msg, file=sys.stdout, flush=True)

def get_instagram_handle(query: str):
    log(f"[get_instagram_handle] Query received: {query}")

    url = f"https://www.bing.com/search?q={query.replace(' ', '+')}"
    log(f"[get_instagram_handle] Bing URL: {url}")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=[
                "--window-position=-32000,-32000",
                "--window-size=1280,800",
            ],
        )
        page = browser.new_page()
        page.goto(url, wait_until="domcontentloaded")
        log("[get_instagram_handle] Page loaded")

        page.wait_for_timeout(800)
        text = page.inner_text("body")
        log(f"[get_instagram_handle] Body length: {len(text)} chars")

        browser.close()
        log("[get_instagram_handle] Browser closed")

    pattern = r"instagram\.com\s*[›/]\s*([a-zA-Z0-9._]{3,30})"
    match = re.search(pattern, text)
    log(f"[get_instagram_handle] Regex pattern: {pattern}")
    log(f"[get_instagram_handle] Match found: {bool(match)}")

    if match:
        handle = match.group(1).lower()
        log(f"[get_instagram_handle] Extracted handle: {handle}")
        return handle

    log("[get_instagram_handle] No match. First 500 chars of body:")
    log(text[:500].replace("\n", "\\n"))
    return None

@app.route("/instagram-handle", methods=["POST"])
def instagram_handle():
    try:
        data = request.get_json(silent=True)
        log(f"[instagram_handle] Raw JSON body: {data}")

        # HTTP node should send: { "name": "Alex Hormozi" }
        if not data or "name" not in data:
            log("[instagram_handle] Missing 'name' key in body")
            return jsonify({"error": "Missing 'name'"}), 400

        name = data["name"]
        log(f"[instagram_handle] Name from client: '{name}'")

        # 🔒 HARD-CODE the 'instagram handle' suffix here
        query = f"{name} instagram handle"
        log(f"[instagram_handle] Final query used: '{query}'")

        handle = get_instagram_handle(query)

        log(f"[instagram_handle] Returning handle: {handle}")
        return jsonify({
            "name": name,
            "query": query,
            "handle": handle,
        }), 200

    except Exception:
        log("[instagram_handle] Exception occurred:")
        log(traceback.format_exc())
        return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    log("[main] Starting Flask app on http://127.0.0.1:5002")
    app.run(host="127.0.0.1", port=5002, debug=False)
