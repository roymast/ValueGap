import google.auth
from google.auth.transport.requests import Request
import json
import urllib.request
try:
    credentials, project = google.auth.default()
    credentials.refresh(Request())
    req = urllib.request.Request(f"https://firestore.googleapis.com/v1/projects/{project}/databases", headers={"Authorization": f"Bearer {credentials.token}"})
    with urllib.request.urlopen(req) as response:
        print(response.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)
