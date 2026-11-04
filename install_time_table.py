from pathlib import Path
import shutil

base = Path.cwd()
index = base / "index.html"
server = base / "server.py"

html = index.read_text(encoding="utf-8-sig")
old = '''<a class="tool" href="/student-question-helper.html" id="navai-study-planner-card">
      <div class="tool-icon"><span aria-hidden="true">ðŸŽ¯</span></div>
      <h2>NavAI Exam Predictor</h2>
      <p>Build exam-focused question papers with priority levels, tough practice and answer explanations.</p>
      <div class="tool-bottom"><span>Predict &amp; practise</span><span class="tool-arrow" aria-hidden="true" aria-label="Open">&#8599;</span></div>
    </a>'''

new = '''<a class="tool" href="/time-table-maker.html" id="navai-time-table-maker-card">
      <div class="tool-icon"><span aria-hidden="true">&#128197;</span></div>
      <h2>Time Table Maker</h2>
      <p>Let NavAI create a personalized daily and weekly timetable around your routine and goals.</p>
      <div class="tool-bottom"><span>Create my timetable</span><span class="tool-arrow" aria-hidden="true" aria-label="Open">&#8599;</span></div>
    </a>'''

if 'id="navai-time-table-maker-card"' not in html:
    if old not in html:
        raise SystemExit("Dashboard Exam Predictor card did not match exactly. No dashboard changes made.")
    html = html.replace(old, new, 1)
    index.write_text(html, encoding="utf-8")

source = server.read_text(encoding="utf-8-sig")
marker = '@app.route("/<path:filename>")'
if '@app.route("/api/timetable/generate"' not in source:
    if marker not in source:
        raise SystemExit("Could not find static route insertion point. Backend was not modified.")
    route = r'''

@app.route("/api/timetable/generate", methods=["POST"])
def generate_timetable():
    data = request.get_json(silent=True) or {}

    allowed = ("school", "coaching", "gym", "library")
    routine = {}
    for name in allowed:
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
        return jsonify({"error": "The AI service is not configured on the server."}), 500

    prompt = (
        "Create a practical, realistic, personalized weekly student timetable. "
        "Return ONLY valid JSON, no Markdown or code fences, with this exact shape: "
        '{"summary":"short helpful summary","days":[{"day":"Monday","items":'
        '[{"start":"06:00 AM","end":"06:30 AM","activity":"Activity name",'
        '"notes":"Short useful detail"}]}]}. '
        "Include all seven days Monday through Sunday. Use 12-hour time labels. "
        "Schedule study sessions, subject rotation, revision, homework, meals, "
        "short breaks and reasonable rest. Do not overpack the day. "
        "Treat the supplied school/coaching/gym/library ranges as fixed occupied "
        "time and never schedule study over them. Do not invent a timing for an "
        "activity whose timing was not supplied. If a user's class or goal is "
        "blank, make a sensible general student timetable without asking questions. "
        "Do not ask the user anything. Avoid assuming a specific school start, "
        "bedtime or wake time when not supplied; use flexible labels or reasonable "
        "clearly-labelled suggestions rather than pretending they were provided. "
        "Make the plan balanced and age-appropriate. Each day should have a "
        "manageable number of blocks. Keep all output in the requested JSON shape. "
        "\nStudent class: " + (student_class or "Not provided") +
        "\nStudent goal: " + (goal or "Not provided") +
        "\nFixed routine timings (blank means not applicable): " +
        __import__("json").dumps(routine, ensure_ascii=False)
    )

    try:
        response = requests.post(
            GROQ_URL,
            headers={"Authorization": "Bearer " + api_key,
                     "Content-Type": "application/json"},
            json={"model": TEXT_MODEL,
                  "messages":[
                      {"role":"system","content":"You are NavAI, an expert student timetable planner. Follow the requested JSON schema exactly."},
                      {"role":"user","content":prompt}
                  ],
                  "temperature":0.4,
                  "max_completion_tokens":3500},
            timeout=90
        )
        if response.status_code != 200:
            print("Timetable Groq error:", response.status_code, response.text[:500])
            if response.status_code == 429:
                return jsonify({"error":"AI usage limit reached. Please try again later."}), 502
            return jsonify({"error":"AI could not generate the timetable right now. Please try again."}), 502

        content = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
        content = str(content).strip()
        content = re.sub(r"^```(?:json)?\s*", "", content, flags=re.I)
        content = re.sub(r"\s*```$", "", content)
        result = __import__("json").loads(content)
        if not isinstance(result, dict) or not isinstance(result.get("days"), list):
            raise ValueError("Invalid timetable structure")
        return jsonify(result)
    except requests.Timeout:
        return jsonify({"error":"Timetable generation took too long. Please try again."}), 504
    except requests.RequestException:
        return jsonify({"error":"Could not connect to the AI service."}), 502
    except (ValueError, KeyError, IndexError, TypeError):
        return jsonify({"error":"AI returned an unreadable timetable. Please regenerate."}), 502
    except Exception as exc:
        print("Timetable generation error:", type(exc).__name__)
        return jsonify({"error":"Something went wrong while creating your timetable."}), 500

'''
    source = source.replace(marker, route + "\n" + marker, 1)
    server.write_text(source, encoding="utf-8")

print("Dashboard and AI backend updated.")
