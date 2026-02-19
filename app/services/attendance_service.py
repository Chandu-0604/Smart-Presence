from datetime import datetime
import cv2
import numpy as np

from flask_login import current_user

from app.extensions import db
from app.models.attendance_session import AttendanceSession
from app.models.attendance_record import AttendanceRecord
from app.models.enrollment import Enrollment

from app.services.face_service import verify_face
from app.services.geo_service import validate_geo
from app.services.liveness_service import detect_liveness
from app.services.token_service import verify_attendance_token
from app.services.threat_detection import record_threat, THREAT_SCORES
from app.utils.ip_utils import get_client_ip
from app.utils.rate_limiter import is_rate_limited, get_retry_after, register_failed_biometric


def process_attendance(session_id, image_file, latitude, longitude, token):

    # ---------------- RATE LIMIT ----------------
    if is_rate_limited(current_user.id, "attendance"):
        retry = get_retry_after(current_user.id, "attendance")
        return False, f"Too many attempts. Try again in {retry} seconds."

    # ---------------- SESSION VALIDATION ----------------
    session = AttendanceSession.query.get(session_id)
    if not session:
        return False, "Session not found"

    now = datetime.utcnow()

    if not session.is_active or not (session.start_time <= now <= session.end_time):
        return False, "Session is not active"

    # ---------------- ENROLLMENT ----------------
    enrollment = Enrollment.query.filter_by(
        student_id=current_user.id,
        course_id=session.course_id,
        is_active=True
    ).first()

    if not enrollment:
        return False, "You are not enrolled in this course"

    # ---------------- TOKEN ----------------
    valid, msg = verify_attendance_token(token, current_user.id, session_id)
    if not valid:
        record_threat(current_user.id, THREAT_SCORES["Replay Attack Attempt"], msg, session_id=session_id)
        return False, msg

    # ---------------- IMAGE ----------------
    file_bytes = np.frombuffer(image_file.read(), np.uint8)
    image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    if image is None:
        return False, "Invalid image"

    # ---------------- LIVENESS ----------------
    live, reason = detect_liveness(image)
    if not live:
        register_failed_biometric(current_user.id)
        record_threat(current_user.id, THREAT_SCORES["Spoofing Attempt (Photo/Video)"], reason, session_id=session_id)
        return False, "Liveness check failed"

    # ---------------- FACE ----------------
    user, similarity = verify_face(image, [current_user])
    if not user:
        register_failed_biometric(current_user.id)
        record_threat(current_user.id, THREAT_SCORES["Face Impersonation Attempt"], "Face mismatch", session_id=session_id, similarity=similarity)
        return False, "Face verification failed"

    # ---------------- GEO ----------------
    geo_ok, distance = validate_geo(session.course.department, float(latitude), float(longitude))
    if not geo_ok:
        record_threat(current_user.id, THREAT_SCORES["Location Spoof Attempt"], "Outside campus", session_id=session_id, distance=distance)
        return False, "Outside allowed campus area"

    # ---------------- SAVE ----------------
    record = AttendanceRecord(
        student_id=current_user.id,
        session_id=session_id,
        similarity_score=similarity,
        geo_distance_meters=distance,
        ip_address=get_client_ip(),
        verification_method="face+geo+token+liveness"
    )

    db.session.add(record)
    db.session.commit()

    return True, {
        "similarity": round(similarity, 3),
        "distance_meters": round(distance, 2)
    }