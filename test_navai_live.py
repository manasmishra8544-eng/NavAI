import json
import urllib.request
import urllib.error

url = "https://navai-kpyu.onrender.com/api/chat"
questions = [
    "Who made you?",
    "Tumhe kisne banaya?",
    "Tell me about Manas Mishra",
    "What is Manas Mishra's Instagram?"
]

for question in questions:
    print("\nQUESTION:", question)
    payload = json.dumps({"message": question}).encode("utf-8")
    request = urllib.request.Request(
        url, data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            data = json.loads(response.read().decode("utf-8"))
            print("HTTP:", response.status)
            print("ANSWER:", data.get("response") or data.get("answer") or data.get("reply") or data)
    except Exception as error:
        print("ERROR:", error)
