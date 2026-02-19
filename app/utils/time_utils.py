from datetime import datetime
import pytz

IST = pytz.timezone("Asia/Kolkata")

def to_ist(utc_dt):
    """Convert UTC datetime to IST"""
    if utc_dt is None:
        return None

    return utc_dt.replace(tzinfo=pytz.utc).astimezone(IST)

def format_ist(utc_dt):
    """Return human readable IST time"""
    ist_time = to_ist(utc_dt)
    return ist_time.strftime("%d %b %Y, %I:%M:%S %p IST")