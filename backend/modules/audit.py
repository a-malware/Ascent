import time
from collections import deque

_audit_logs = deque(maxlen=200)

def log_event(category: str, title: str, details: str):
    _audit_logs.append({
        "timestamp": time.time(),
        "category": category,
        "title": title,
        "details": details
    })

def get_logs(limit: int = 50) -> list:
    return list(_audit_logs)[-limit:]
