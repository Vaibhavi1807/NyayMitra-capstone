import requests
import json

URL = "http://localhost:8001/api/translate"

test_cases = [
    {"case_id": "demo", "source_text": "The present writ petition is disposed of.", "target_lang": "hi"},
    {"case_id": "demo", "source_text": "All the pending applications, if any, also stand disposed of.", "target_lang": "hi"},
    {"case_id": "demo", "source_text": "We have heard learned counsel for the parties and perused the whole records of the case.", "target_lang": "mr"},
    {"case_id": "demo", "source_text": "Challenge in the present petition is to notice dated 18.04.2024 issued under Section 148 of the Income Tax Act, 1961.", "target_lang": "hi"},
]

output_lines = []

for i, case in enumerate(test_cases, start=1):
    response = requests.post(URL, json=case)
    data = response.json()

    line = (
        f"----- Test {i} ({case['target_lang']}) -----\n"
        f"EN: {case['source_text']}\n"
        f"->  {data.get('translated_text', '[ERROR: ' + str(data) + ']')}\n"
    )
    print(line)
    output_lines.append(line)

with open("translation_quality_output.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(output_lines))

print("Saved readable results to translation_quality_output.txt")
