import time
from app.models.user import User
from app.extensions import db

# (user_id, endpoint) -> timestamps
ATTEMPT_LOG = {}

MAX_ATTEMPTS = 3
BLOCK_WINDOW = 60  # seconds


def is_rate_limited(user_id, endpoint="attendance"):
    """
    Only CHECKS limit
    Does NOT register attempt
    """

    if len(ATTEMPT_LOG) > 1000:
        ATTEMPT_LOG.clear()

    now = time.time()
    key = (user_id, endpoint)

    if key not in ATTEMPT_LOG:
        ATTEMPT_LOG[key] = []

    # remove expired attempts
    ATTEMPT_LOG[key] = [
        t for t in ATTEMPT_LOG[key]
        if now - t < BLOCK_WINDOW
    ]

    return len(ATTEMPT_LOG[key]) >= MAX_ATTEMPTS

def register_failed_biometric(user_id, endpoint="attendance"):

    now = time.time()
    key = (user_id, endpoint)

    if key not in ATTEMPT_LOG:
        ATTEMPT_LOG[key] = []

    ATTEMPT_LOG[key].append(now)

    # 🔴 IMPORTANT: increase violation counter
    user = User.query.get(user_id)
    if user:
        user.biometric_violations = (user.biometric_violations or 0) + 1
        db.session.commit()

def get_retry_after(user_id, endpoint="attendance"):
    key = (user_id, endpoint)

    if key not in ATTEMPT_LOG or not ATTEMPT_LOG[key]:
        return 0

    oldest_attempt = min(ATTEMPT_LOG[key])
    retry_after = BLOCK_WINDOW - (time.time() - oldest_attempt)

    return max(0, int(retry_after))