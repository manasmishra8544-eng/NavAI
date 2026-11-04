from pathlib import Path

root = Path(__file__).resolve().parent
file = root / "server.py"
data = file.read_bytes()

anchor = b"You are NavAI, a helpful, clear and honest AI assistant."
if b"ANSWER_FORMATTING_RULES:" in data:
    print("Formatting rule already exists; no duplicate added.")
elif anchor in data:
    newline = b"\r\n" if b"\r\n" in data else b"\n"
    rule = newline.join([
        anchor,
        b"ANSWER_FORMATTING_RULES:",
        b"- Write clean, natural, copy-ready answers in plain text.",
        b"- Never show raw LaTeX delimiters such as \\\\(, \\\\), \\\\[ or \\\\].",
        b"- Avoid raw LaTeX commands such as \\\\frac and \\\\tfrac.",
        b"- Write formulas in readable notation, e.g. a = (v - u) / t.",
        b"- Use clear headings and numbered steps when useful.",
        b"- Keep correct units such as m/s and m/s^2.",
        b"- Avoid unnecessary decorative symbols; preserve required code and JSON formats."
    ])
    data = data.replace(anchor, rule, 1)
    file.write_bytes(data)
    print("Added formatting rules to normal NavAI chatbot.")
else:
    raise SystemExit("STOP: SYSTEM_PROMPT anchor not found; file left unchanged.")
