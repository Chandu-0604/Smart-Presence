import math
from app.utils.ip_utils import is_ip_allowed


def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000  # meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)

    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi/2)**2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    )

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c


def validate_geo(department, user_lat, user_lon):
    """
    Smart geo validation for real college environments.

    Accept attendance if ANY of:
    1) Accurate GPS inside campus
    2) Campus network IP
    3) Coarse GPS but near campus (laptops without GPS)
    """

    distance = haversine_distance(
        department.latitude,
        department.longitude,
        user_lat,
        user_lon
    )

    network_valid = is_ip_allowed()

    campus_radius = department.allowed_radius_meters

    # ---------- 1. STRONG GPS ----------
    if distance <= campus_radius:
        return True, distance

    # ---------- 2. CAMPUS WIFI ----------
    # If on campus network, allow even if GPS unavailable
    if network_valid:
        return True, distance

    # ---------- 3. COARSE LOCATION (Laptop users) ----------
    # Browser IP-based geolocation is usually off by 0.5–3km
    # Accept within 3km of campus
    if distance <= 3000:
        return True, distance

    # ---------- 4. REAL OUTSIDE ----------
    return False, distance
