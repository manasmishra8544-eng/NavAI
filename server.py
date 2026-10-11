
import os
import json
import base64
import urllib.request
import urllib.error

from flask import Flask, jsonify, request, send_from_directory

APP_DIR = os.path.dirname(os.path.abspath(__file__))

# Load .env locally. Render uses its Environment Variables.
env_file = os.path.join(APP_DIR, ".env")

if os.path.isfile(env_file):
    with open(env_file, "r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(
                    key.strip(),
                    value.strip().strip('"').strip("'")
                )

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "qwen/qwen3.8-27b"

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024


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
    return send_from_directory(APP_DIR, "favicon.svg", mimetype="image/svg+xml")


@app.route("/navai-logo.svg")
def navai_logo():
    return send_from_directory(APP_DIR, "navai-logo.svg", mimetype="image/svg+xml")


@app.route("/api/chat", methods=["POST"])
def chat():
    api_key = os.environ.get("GROQ_API_KEY", "").strip()

    if not api_key:
        return jsonify({
            "error": "Groq API key is missing. Check your environment settings."
        }), 503

    data = request.get_json(silent=True) or {}

    message = str(data.get("message", "")).strip()
    image_data = data.get("image")
    history = data.get("history", [])

    if not message and not image_data:
        return jsonify({
            "error": "Please enter a message or attach an image."
        }), 400

    from datetime import datetime
    from zoneinfo import ZoneInfo

    current_date = datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%d %B %Y")

    messages = [{
        "role": "system",
        "content": (
            "You are NavAI, a helpful AI assistant. "
            f"The current date is {current_date} in India (Asia/Kolkata). "
            "Never assume the year is 2024 or use an outdated date. "
            "Answer clearly and naturally in English or Hindi. "
            "Use browser search for current or changing facts whenever available. ""Never pretend your knowledge is live "
            "and never invent recent news, results, prices, or dates. "
            "If you cannot verify current information, say so clearly. "
            "Answer stable questions normally. "
            "If an image is provided, inspect it and answer based on it."
        )
    }]

    if isinstance(history, list):
        for item in history[-8:]:
            if not isinstance(item, dict):
                continue

            role = item.get("role")
            content = item.get("content", item.get("text", ""))

            if role in ("user", "assistant") and isinstance(content, str):
                content = content.strip()

                if content:
                    messages.append({
                        "role": role,
                        "content": content[:6000]
                    })

    current_message = {
        "role": "user",
        "content": message or "Please describe this image."
    }

    if image_data:
        try:
            mime_type = "image/jpeg"

            if isinstance(image_data, str) and image_data.startswith("data:"):
                header, image_data = image_data.split(",", 1)

                if ";" in header:
                    mime_type = header[5:].split(";", 1)[0]

            image_bytes = base64.b64decode(image_data, validate=True)

            if len(image_bytes) > 10 * 1024 * 1024:
                return jsonify({
                    "error": "Image is too large. Please use a smaller image."
                }), 400

            encoded = base64.b64encode(image_bytes).decode("utf-8")
            image_url = f"data:{mime_type};base64,{encoded}"

            current_message["content"] = [
                {
                    "type": "text",
                    "text": message or "Please describe this image."
                },
                {
                    "type": "image_url",
                    "image_url": {"url": image_url}
                }
            ]

        except Exception:
            return jsonify({
                "error": "The image could not be read. Please upload it again."
            }), 400

    messages.append(current_message)

    # Use built-in web search for text questions; preserve image support.
    payload = {
        "model": MODEL if image_data else "openai/gpt-oss-20b",
        "messages": messages,
        "stream": False,
        "max_completion_tokens": 1400,
        "temperature": 0.2 if image_data else 1.0
    }

    if not image_data:
        payload["tools"] = [{"type": "browser_search"}]

    try:
        req = urllib.request.Request(
            GROQ_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "NavAI/1.0"
            },
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))

        choices = result.get("choices", [])
        answer = ""

        if choices:
            answer = choices[0].get("message", {}).get("content", "")

        if not isinstance(answer, str) or not answer.strip():
            answer = "I couldn't generate a response. Please try again."

        return jsonify({
            "response": answer.strip(),
            "answer": answer.strip()
        })

    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")

        app.logger.warning(
            "Groq HTTP %s response: %s",
            error.code,
            details[:1000]
        )

        if error.code == 401:
            error_message = "Groq rejected the API key. Check your settings."
        elif error.code == 403:
            error_message = "Groq denied the request. Check the Render logs."
        elif error.code == 429:
            error_message = (
                "Groq rate limit reached. Please wait and try again. "
                "Check Render logs for the exact limit."
            )
        else:
            error_message = f"Groq returned HTTP {error.code}."

        return jsonify({"error": error_message}), 502

    except urllib.error.URLError:
        return jsonify({
            "error": "Could not reach Groq. Please try again later."
        }), 503

    except Exception:
        app.logger.exception("NavAI chat error")

        return jsonify({
            "error": "Something went wrong while generating the response."
        }), 500


@app.errorhandler(413)
def file_too_large(error):
    return jsonify({
        "error": "Request is too large. Please use a smaller image."
    }), 413


if __name__ == "__main__":
    print("NavAI server starting...", flush=True)
    print(f"AI model: {MODEL}", flush=True)
    app.run(host="127.0.0.1", port=5000, debug=False)
