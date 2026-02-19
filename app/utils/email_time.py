from datetime import timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))

def format_ist(dt):
    if dt is None:
        return "N/A"

    # if naive -> assume UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(IST).strftime("%d %b %Y, %I:%M %p IST")
