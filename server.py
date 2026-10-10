
import os
import json
import base64
import urllib.request
import urllib.error

from flask import Flask, jsonify, request, send_from_directory

APP_DIR = os.path.dirname(os.path.abspath(__file__))
OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
MODEL = "qwen2.5vl:3b"

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


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", "")).strip()
    image_data = data.get("image")
    history = data.get("history", [])

    if not message and not image_data:
        return jsonify({"error": "Please enter a message or attach an image."}), 400

    messages = [{
        "role": "system",
        "content": (
            "You are NavAI, a helpful AI assistant. "
            "Answer clearly and naturally. Support English and Hindi. "
            "If an image is attached, inspect it and answer based on what you can see. "
            "Never claim you cannot view images when an image is provided."
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
            if isinstance(image_data, str) and "," in image_data:
                image_data = image_data.split(",", 1)[1]
            image_bytes = base64.b64decode(image_data, validate=True)
            if len(image_bytes) > 10 * 1024 * 1024:
                return jsonify({"error": "Image is too large."}), 400
            current_message["images"] = [base64.b64encode(image_bytes).decode("utf-8")]
        except Exception:
            return jsonify({"error": "The image could not be read. Please upload it again."}), 400

    messages.append(current_message)

    payload = {
        "model": MODEL,
        "messages": messages,
        "stream": False,
        "options": {
            "num_ctx": 2048,
            "num_predict": 512,
            "temperature": 0.2,
            "repeat_penalty": 1.1
        }
    }

    try:
        req = urllib.request.Request(
            OLLAMA_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=300) as response:
            result = json.loads(response.read().decode("utf-8"))

        answer = result.get("message", {}).get("content", "").strip()
        if not answer:
            answer = "I couldn't generate a response. Please try again."

        return jsonify({"response": answer, "answer": answer})

    except urllib.error.URLError as error:
        return jsonify({
            "error": "Could not connect to Ollama. Please check that Ollama is running."
        }), 503
    except Exception as error:
        app.logger.exception("NavAI chat error")
        return jsonify({"error": f"Something went wrong: {error}"}), 500


if __name__ == "__main__":
    print("NavAI server starting...", flush=True)
    print(f"AI model: {MODEL}", flush=True)
    print("Website: http://127.0.0.1:5000", flush=True)
    app.run(host="127.0.0.1", port=5000, debug=False)
