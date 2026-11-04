from pathlib import Path
import re

index = Path("index.html")
server = Path("server.py")

html = index.read_text(encoding="utf-8-sig")

pattern = re.compile(
    r'<a class="tool" href="/student-question-helper\.html" id="navai-study-planner-card">.*?</a>',
    re.S
)

replacement = '''<a class="tool" href="/time-table-maker.html" id="navai-time-table-maker-card">
      <div class="tool-icon"><span aria-hidden="true">&#128197;</span></div>
      <h2>Time Table Maker</h2>
      <p>Let NavAI create a personalized daily and weekly timetable around your routine and goals.</p>
      <div class="tool-bottom"><span>Create my timetable</span><span class="tool-arrow" aria-hidden="true" aria-label="Open">&#8599;</span></div>
    </a>'''

if 'id="navai-time-table-maker-card"' not in html:
    html, count = pattern.subn(lambda _: replacement, html, count=1)
    if count != 1:
        raise SystemExit("Dashboard card not found. No changes made.")
    index.write_text(html, encoding="utf-8")

source = server.read_text(encoding="utf-8-sig")
marker = '@app.route("/<path:filename>")'

if '@app.route("/api/timetable/generate"' not in source:
    if marker not in source:
        raise SystemExit("Backend insertion point not found.")

    route = r'''

@app.route("/api/timetable/generate", methods=["POST"])
def generate_timetable():
    data = request.get_json(silent=True) or {}
    routine = {}

    for name in ("school", "coaching", "gym", "library"):
        value = data.get(name) or {}
        if not isinstance(value, dict):
            return jsonify({"error": "Invalid timing information."}), 400

        start = str(value.get("start", "")).strip()
        end = str(value.get("end", "")).strip()

        if bool(start) != bool(end):
            return jsonify({"error": "Please provide both start and end times for " + name + "."}), 400
        if start and (len(start) != 5 or len(end) != 5 or end <= start):
            return jsonify({"error": "Please check the " + name + " timing."}), 400

        routine[name] = {"start": start, "end": end}

    student_class = str(data.get("studentClass", "")).strip()[:50]
    goal = str(data.get("goal", "")).strip()[:180]
    api_key = os.environ.get("GROQ_API_KEY", "").strip()

    if not api_key:
        return jsonify({"error": "AI service is not configured on the server."}), 500

    prompt = (
        "Create a practical personalized weekly student timetable. Return ONLY valid JSON "
        'with shape {"summary":"...","days":[{"day":"Monday","items":'
        '[{"start":"06:00 AM","end":"06:30 AM","activity":"...","notes":"..."}]}]}. '
        "Include all seven days Monday through Sunday. Use 12-hour time labels. "
        "Respect supplied school, coaching, gym and library timings as fixed occupied time. "
        "Never schedule study over them. Do not invent timings for activities not supplied. "
        "Include subject rotation, homework, revision, breaks, meals and rest. "
        "Keep the plan balanced and age-appropriate. Do not ask questions. "
        "If class or goal is blank, make a sensible general student plan. "
        "Do not assume the user's actual wake-up or bedtime. Use flexible suggestions "
        "where timings are unknown. "
        "\nClass: " + (student_class or "Not provided") +
        "\nGoal: " + (goal or "Not provided") +
        "\nFixed routine: " + __import__("json").dumps(routine)
    )

    try:
        response = requests.post(
            GROQ_URL,
            headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
            json={
                "model": TEXT_MODEL,
                "messages": [
                    {"role": "system", "content": "You are NavAI, an expert student timetable planner. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.4,
                "max_completion_tokens": 3500
            },
            timeout=90
        )

        if response.status_code != 200:
            print("Timetable AI error:", response.status_code, response.text[:500])
            return jsonify({"error": "AI could not generate the timetable right now. Please try again."}), 502

        content = str(response.json()["choices"][0]["message"]["content"]).strip()
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content, flags=re.I)
        result = __import__("json").loads(content)

        if not isinstance(result, dict) or not isinstance(result.get("days"), list):
            raise ValueError("Invalid timetable")

        return jsonify(result)

    except requests.Timeout:
        return jsonify({"error": "Timetable generation timed out. Please try again."}), 504
    except requests.RequestException:
        return jsonify({"error": "Could not connect to the AI service."}), 502
    except (ValueError, KeyError, IndexError, TypeError):
        return jsonify({"error": "AI returned an unreadable timetable. Please regenerate."}), 502
    except Exception as exc:
        print("Timetable error:", type(exc).__name__)
        return jsonify({"error": "Something went wrong while creating your timetable."}), 500

'''
    source = source.replace(marker, route + "\n" + marker, 1)
    server.write_text(source, encoding="utf-8")

print("Dashboard card and timetable API updated.")
