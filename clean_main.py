import re

with open("functions/main.py", "r") as f:
    content = f.read()

# Remove the fix endpoints
content = re.sub(r'elif path == "/api/fix".*?headers=headers\)', '', content, flags=re.DOTALL)
content = re.sub(r'elif path == "/api/fix2".*?headers=headers\)', '', content, flags=re.DOTALL)
content = re.sub(r'elif path == "/api/fix3".*?headers=headers\)', '', content, flags=re.DOTALL)

# Update timeouts
content = content.replace('timeout_sec=540', 'timeout_sec=1800')

with open("functions/main.py", "w") as f:
    f.write(content)
print("Cleaned main.py")
