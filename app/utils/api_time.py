from datetime import timezone

def to_api_time(dt):
    """
    Always return ISO 8601 UTC time for frontend.
    Safe for both naive and aware datetimes.
    """

    if dt is None:
        return None

    # If naive → assume UTC (legacy DB records)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)

    return dt.isoformat()
