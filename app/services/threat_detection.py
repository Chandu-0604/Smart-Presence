import time
from app.services.security_service import security_alert
from app.services.intrusion_service import register_biometric_violation
from app.models.user import User
from app.extensions import db

LAST_ALERT_TIME = {}  # (user_id, event)
ALERT_COOLDOWN = 600  # 10 minutes
USER_THREATS = {}
THREAT_WINDOW = 300   # 5 minutes
ALERT_THRESHOLD = 5

THREAT_SCORES = {
    "Face Impersonation Attempt": 1,
    "Location Spoof Attempt": 2,
    "Spoofing Attempt (Photo/Video)": 3,
    "Brute force attempt": 2,
    "Replay Attack Attempt": 3
}


def record_threat(user_id, points, event, session_id=None, similarity=None, distance=None):

    now = time.time()

    # -------- MEMORY CLEANUP (prevents RAM leak) --------
    if len(USER_THREATS) > 500:
        USER_THREATS.clear()

    if user_id not in USER_THREATS:
        USER_THREATS[user_id] = []

    # remove old events
    USER_THREATS[user_id] = [
        (t, p) for (t, p) in USER_THREATS[user_id]
        if now - t < THREAT_WINDOW
    ]

    # add new threat
    USER_THREATS[user_id].append((now, points))

    total_score = sum(p for (_, p) in USER_THREATS[user_id])

    # only alert when suspicious
    last = LAST_ALERT_TIME.get((user_id, event), 0)

    if total_score >= ALERT_THRESHOLD and now - last > ALERT_COOLDOWN:

        LAST_ALERT_TIME[(user_id, event)] = now

        # -------- SEND SECURITY ALERT --------
        security_alert(
            user_id=user_id,
            event="Repeated Suspicious Attendance Activity",
            details=f"Threat score: {total_score} | Cause: {event}",
            session_id=session_id,
            similarity=similarity,
            distance=distance
        )

        # escalate to biometric account lock
        user = User.query.get(user_id)
        if user:
            register_biometric_violation(user, event)

        # reset after alert
        USER_THREATS[user_id] = []