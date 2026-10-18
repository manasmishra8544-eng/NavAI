
import os
import base64
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from flask import Flask, request, jsonify, send_from_directory

BASE_DIR = Path(__file__).resolve().parent

# Load .env without displaying or exposing secret keys.
env_file = BASE_DIR / ".env"
if env_file.exists():
    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value

app = Flask(__name__, static_folder=None)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
TEXT_MODEL = "openai/gpt-oss-20b"
IMAGE_MODEL = "qwen/qwen3.8-27b"


def india_date():
    try:
        return datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%d %B %Y")
    except Exception:
        return datetime.now().strftime("%d %B %Y")


SYSTEM_PROMPT = """
You are NavAI, a helpful, clear and honest AI assistant.

IMPORTANT RESPONSE RULES:
- Answer the user's actual question directly.
- Do not add a Sources section, citations, reference lists, or URLs
  unless the user explicitly asks for sources or citations.
- Do not attach source lists to ordinary greetings or simple questions.
- Never invent citations, URLs, sources, quotations, or verification.
- Never claim you searched the internet or checked live information
  unless an actual search tool was used.
- If you do not know a current fact, be transparent about uncertainty.
- Do not automatically claim your knowledge ends in 2021.
- Use readable Markdown when it improves the answer.
- Avoid unnecessary disclaimers and repetitive introductions.
- Follow the user's requested language and answer length.
- Be friendly, accurate and useful.
"""


@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/<path:filename>")
def static_files(filename):
    # Keep existing frontend files and assets accessible.
    requested = (BASE_DIR / filename).resolve()

    if not requested.is_relative_to(BASE_DIR):
        return jsonify({"error": "File not found"}), 404

    if requested.is_file():
        return send_from_directory(BASE_DIR, filename)

    return jsonify({"error": "File not found"}), 404


@app.route("/api/chat", methods=["POST"])
def chat():
    api_key = os.environ.get("GROQ_API_KEY", "").strip()

    if not api_key:
        return jsonify({
            "error": "GROQ_API_KEY is missing from the server environment."
        }), 500

    data = request.get_json(silent=True) or {}

    # Accept common message field names used by chat frontends.
    user_message = (
        data.get("message")
        or data.get("prompt")
        or data.get("text")
        or ""
    )

    # Support frontends that send the current user message in messages.
    history = data.get("history") or data.get("messages") or []

    if not user_message and isinstance(history, list):
        for item in reversed(history):
            if isinstance(item, dict) and item.get("role") == "user":
                user_message = item.get("content") or item.get("text") or ""
                break

    if not isinstance(user_message, str):
        user_message = str(user_message)

    user_message = user_message.strip()

    if not user_message:
        return jsonify({"error": "Please enter a message."}), 400

    messages = [{
        "role": "system",
        "content": (
            SYSTEM_PROMPT
            + "\nToday's date in India is "
            + india_date()
            + "."
        )
    }]

    # Keep recent conversation context without accepting system prompts
    # supplied by the browser.
    if isinstance(history, list):
        for item in history[-8:]:
            if not isinstance(item, dict):
                continue

            role = item.get("role")
            content = item.get("content", item.get("text", ""))

            if role not in ("user", "assistant"):
                continue

            # Avoid duplicating the current message if it is already
            # the last item in the supplied history.
            if (
                role == "user"
                and isinstance(content, str)
                and content.strip() == user_message
                and item is history[-1]
            ):
                continue

            if isinstance(content, str) and content.strip():
                messages.append({
                    "role": role,
                    "content": content.strip()
                })

    # Optional image input, when the frontend sends a base64 data URL.
    image_data = (
        data.get("image")
        or data.get("image_data")
        or data.get("imageData")
    )

    if image_data and isinstance(image_data, str):
        if image_data.startswith("data:image/") and ";base64," in image_data:
            image_type = image_data.split(";", 1)[0][5:]
            encoded = image_data.split(";base64,", 1)[1]

            messages.append({
                "role": "user",
                "content": [
                    {"type": "text", "text": user_message},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{image_type};base64,{encoded}"
                        }
                    }
                ]
            })
        else:
            messages.append({
                "role": "user",
                "content": user_message
            })
    else:
        messages.append({
            "role": "user",
            "content": user_message
        })

    payload = {
        "model": TEXT_MODEL,
        "messages": messages,
        "max_completion_tokens": 1400
    }

    try:
        response = requests.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=90
        )

        if response.status_code != 200:
            if response.status_code in (401, 403):
                message = "The AI service rejected the API key. Check the server configuration."
            elif response.status_code == 429:
                message = "The AI service is busy or its usage limit has been reached. Please try again later."
            else:
                message = f"The AI service returned an error (HTTP {response.status_code})."

            print("Groq API error:", response.status_code, response.text[:1000])
            return jsonify({"error": message}), 502

        result = response.json()
        choices = result.get("choices", [])

        if not choices:
            return jsonify({"error": "The AI returned an empty response."}), 502

        answer = choices[0].get("message", {}).get("content", "")

        if not isinstance(answer, str) or not answer.strip():
            return jsonify({"error": "The AI returned an empty response."}), 502

        answer = answer.strip()

        # Return the response field names used by existing NavAI frontends.
        return jsonify({
            "response": answer,
            "answer": answer,
            "reply": answer
        })

    except requests.Timeout:
        return jsonify({
            "error": "The AI took too long to respond. Please try again."
        }), 504

    except requests.RequestException as exc:
        print("Groq connection error:", str(exc))
        return jsonify({
            "error": "Could not connect to the AI service. Please try again."
        }), 502

    except Exception as exc:
        print("Chat error:", str(exc))
        return jsonify({
            "error": "Something went wrong while generating the response."
        }), 500


@app.route("/api/generate-image", methods=["POST"])
def generate_image():
    data = request.get_json(silent=True) or {}
    prompt = data.get("prompt", "")

    if not isinstance(prompt, str):
        return jsonify({"error": "Please enter a valid image prompt."}), 400

    prompt = prompt.strip()

    if not prompt:
        return jsonify({"error": "Please describe the image you want."}), 400

    hf_token = os.environ.get("HF_TOKEN", "").strip()

    if not hf_token:
        return jsonify({
            "error": "HF_TOKEN is missing from the server environment."
        }), 500

    try:
        from huggingface_hub import InferenceClient

        client = InferenceClient(
            provider="hf-inference",
            api_key=hf_token,
            timeout=120
        )

        image = client.text_to_image(
            prompt,
            model="black-forest-labs/FLUX.1-schnell"
        )

        import io

        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        image_url = f"data:image/png;base64,{encoded}"

        return jsonify({
            "success": True,
            "image": image_url,
            "image_url": image_url,
            "url": image_url
        })

    except Exception as exc:
        print("Image generation error:", str(exc))
        return jsonify({
            "error": "Image generation failed. Please try again later."
        }), 502


@app.errorhandler(404)
def not_found(_error):
    return jsonify({"error": "The requested route was not found."}), 404


@app.errorhandler(405)
def method_not_allowed(_error):
    return jsonify({"error": "This request method is not supported."}), 405


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
