import os
import json
import base64
import logging
import urllib.request
import urllib.error
from datetime import datetime
from zoneinfo import ZoneInfo

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException

APP_DIR = os.path.dirname(os.path.abspath(__file__))
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
TEXT_MODEL = "openai/gpt-oss-20b"
IMAGE_MODEL = "qwen/qwen3.8-27b"

env_file = os.path.join(APP_DIR, ".env")
if os.path.isfile(env_file):
    with open(env_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024
logging.basicConfig(level=logging.INFO)


@app.route("/")
def home():
    return send_from_directory(APP_DIR, "index.html")


@app.route("/style.css")
def style():
    return send_from_directory(APP_DIR, "style.css")


@app.route("/script.js")
def script():
    return send_from_directory(APP_DIR, "script.js")


@app.route("/favicon.svg")
def favicon():
    return send_from_directory(APP_DIR, "favicon.svg")


@app.route("/navai-logo.svg")
def logo():
    return send_from_directory(APP_DIR, "navai-logo.svg")


@app.route("/voice-system.js")
def voice_system():
    return send_from_directory(APP_DIR, "voice-system.js")


@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        api_key = os.environ.get("GROQ_API_KEY", "").strip()
        if not api_key:
            return jsonify(error="GROQ_API_KEY is missing from the server environment."), 503

        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify(error="Invalid JSON request."), 400

        message = str(data.get("message") or "").strip()
        image_data = data.get("image")
        history = data.get("history", [])
        study = bool(data.get("study", False))

        if not message and not image_data:
            return jsonify(error="Please enter a message or attach an image."), 400

        today = datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%d %B %Y")
        messages = [{
            "role": "system",
            "content": (
                "You are NavAI, a helpful AI assistant. Today's date in India is "
                + today + ". Answer clearly and accurately. Do not invent live facts."
            )
        }]

        if study:
            messages.append({
                "role": "system",
                "content": (
                    "You are NavAI Study, a patient tutor. Explain from basics in "
                    "simple Hinglish unless another language is requested. Use "
                    "steps, examples, and accurate exam-ready explanations."
                )
            })

        if isinstance(history, list):
            for item in history[-8:]:
                if not isinstance(item, dict):
                    continue
                role = item.get("role")
                content = item.get("content", item.get("text", ""))
                if role in ("user", "assistant") and isinstance(content, str) and content.strip():
                    messages.append({"role": role, "content": content.strip()[:6000]})

        user_text = message or "Please describe this image."

        if image_data:
            if not isinstance(image_data, str):
                return jsonify(error="Invalid image data."), 400
            try:
                mime = "image/jpeg"
                encoded = image_data
                if image_data.startswith("data:"):
                    header, encoded = image_data.split(",", 1)
                    mime = header[5:].split(";", 1)[0]
                raw = base64.b64decode(encoded, validate=True)
                if len(raw) > 10 * 1024 * 1024:
                    return jsonify(error="Image is too large. Please use a smaller image."), 400
                image_url = "data:" + mime + ";base64," + base64.b64encode(raw).decode("ascii")
                messages.append({
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_text},
                        {"type": "image_url", "image_url": {"url": image_url}}
                    ]
                })
            except (ValueError, TypeError):
                return jsonify(error="Could not read this image. Please upload it again."), 400
        else:
            messages.append({"role": "user", "content": user_text})

        payload = {
            "model": IMAGE_MODEL if image_data else TEXT_MODEL,
            "messages": messages,
            "stream": False,
            "max_completion_tokens": 1400
        }

        req = urllib.request.Request(
            GROQ_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer " + api_key,
                "User-Agent": "NavAI/1.0"
            },
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))

        choices = result.get("choices", [])
        answer = choices[0].get("message", {}).get("content", "") if choices else ""

        if isinstance(answer, list):
            answer = "\n".join(
                p.get("text", "") for p in answer if isinstance(p, dict)
            )

        if not isinstance(answer, str) or not answer.strip():
            return jsonify(error="The AI returned an empty response. Please try again."), 502

        return jsonify(response=answer.strip(), answer=answer.strip())

    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        app.logger.error("Groq HTTP %s: %s", e.code, detail[:1500])
        if e.code == 401:
            msg = "Groq API key was rejected. Check your key."
        elif e.code == 403:
            msg = "Groq denied this request or model access."
        elif e.code == 429:
            msg = "Groq rate limit reached. Try again later."
        else:
            msg = "Groq returned HTTP " + str(e.code) + ". Check the server log."
        return jsonify(error=msg), 502

    except urllib.error.URLError:
        app.logger.exception("Could not connect to Groq")
        return jsonify(error="Could not connect to Groq. Check your internet connection."), 503

    except Exception:
        app.logger.exception("NavAI chat failed")
        return jsonify(error="Server error. See the Python terminal for details."), 500


@app.errorhandler(413)
def too_large(error):
    return jsonify(error="Request is too large. Please use a smaller image."), 413


@app.errorhandler(Exception)
def handle_error(error):
    if isinstance(error, HTTPException):
        return jsonify(error=error.description), error.code
    app.logger.exception("Unhandled Flask error")
    return jsonify(error="Unexpected server error. See the Python terminal."), 500


if __name__ == "__main__":
    print("NavAI server starting...", flush=True)
    print("Text model:", TEXT_MODEL, flush=True)
    print("Image model:", IMAGE_MODEL, flush=True)
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)

