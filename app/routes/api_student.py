from flask import Blueprint, request, session as flask_session
from flask_login import current_user
from datetime import datetime
from sqlalchemy.exc import IntegrityError
from app.extensions import db
from app.utils.decorators import role_required_api
from app.utils.responses import success_response, error_response
from app.utils.logger import log_event
from app.models.enrollment import Enrollment
from app.models.course import Course
from app.models.attendance_session import AttendanceSession
from app.models.attendance_record import AttendanceRecord
from app.models.feedback import Feedback
import cv2
import numpy as np
from app.services.face_service import verify_face
from app.utils.ip_utils import get_client_ip
from app.services.geo_service import validate_geo
from app.services.face_service import register_face
from app.utils.rate_limiter import is_rate_limited, get_retry_after,register_failed_biometric
from app.utils.csrf import validate_csrf
from app.services.liveness_service import detect_liveness
from app.utils.email_utils import send_alert_async
from app.services.token_service import generate_attendance_token
from app.services.token_service import verify_attendance_token
from app.services.security_service import security_alert
from app.services.threat_detection import record_threat, THREAT_SCORES
from app.utils.time_utils import format_ist
from app.services.attendance_permission_service import is_student_enrolled
from flask import Response, stream_with_context
import json
import time
from app.utils.api_time import to_api_time
from datetime import timedelta,timezone
from app.utils.email_time import format_ist

api_student = Blueprint("api_student", __name__)

@api_student.route("/dashboard")
@role_required_api("student")
def dashboard():

    enrollments = Enrollment.query.filter_by(
        student_id=current_user.id
    ).all()

    courses_data = []
    total_percent = 0

    for enrollment in enrollments:

        course = enrollment.course

        sessions = AttendanceSession.query.filter_by(
            course_id=course.id
        ).count()

        attended = AttendanceRecord.query.join(
            AttendanceSession
        ).filter(
            AttendanceSession.course_id == course.id,
            AttendanceRecord.student_id == current_user.id
        ).count()

        percent = 0
        if sessions > 0:
            percent = round((attended / sessions) * 100, 2)

        total_percent += percent

        courses_data.append({
            "id": course.id,
            "name": course.name,
            "percentage": percent,
            "total_sessions": sessions,
            "attended": attended
        })

    average = 0
    if courses_data:
        average = round(total_percent / len(courses_data), 2)

    return success_response({
        "total_courses": len(courses_data),
        "average_attendance": average,
        "courses": courses_data
    })

@api_student.route("/active-session")
@role_required_api("student")
def active_session():

    now = datetime.utcnow()
    GRACE_SECONDS = 30

    session_obj = (
        AttendanceSession.query
        .join(Course)
        .join(Enrollment)
        .filter(
            Enrollment.student_id == current_user.id,
            AttendanceSession.start_time <= now,
        )
        .order_by(AttendanceSession.start_time.desc())
        .first()
    )

    if not session_obj:
        return success_response({"active": False})

    grace_end = session_obj.end_time + timedelta(seconds=GRACE_SECONDS)

    if now > grace_end:
        return success_response({"active": False})

    record = AttendanceRecord.query.filter_by(
        student_id=current_user.id,
        session_id=session_obj.id
    ).first()

    token = None
    if not record:
        token = generate_attendance_token(current_user.id, session_obj.id)

    return success_response({
        "active": True,
        "grace": now > session_obj.end_time,
        "already_marked": record is not None,
        "session_id": session_obj.id,
        "course_name": session_obj.course.name,
        "end_time": to_api_time(grace_end),
        "attendance_token": token
    })

@api_student.route("/mark-attendance", methods=["POST"])
@role_required_api("student")
def mark_attendance():

    if not validate_csrf():
        return error_response("Security token expired. Refresh the page.", 403)

    session_id = request.form.get("session_id")
    latitude = request.form.get("latitude")
    longitude = request.form.get("longitude")
    token = request.form.get("attendance_token")

    if not session_id or not latitude or not longitude or not token:
        return error_response("Missing attendance data", 400)

    from app.services.intrusion_service import is_account_locked
    if is_account_locked(current_user):
        return error_response("Account temporarily locked", 403)

    attendance_session = AttendanceSession.query.get_or_404(session_id)
    now = datetime.utcnow()

    # ================= SESSION VALIDATION (TIME-BASED ONLY) =================
    GRACE_SECONDS = 30
    grace_end = attendance_session.end_time + timedelta(seconds=GRACE_SECONDS)

    if now < attendance_session.start_time:
        return error_response("Session has not started yet", 400)

    if now > grace_end:
        return error_response("Attendance window closed", 400)

    # ================= ENROLLMENT =================
    if not is_student_enrolled(current_user.id, attendance_session.course_id):
        record_threat(current_user.id, 2, "Unenrolled attendance attempt",
                      session_id=attendance_session.id)
        return error_response("Not enrolled in this course", 403)

    # ================= DUPLICATE =================
    existing = AttendanceRecord.query.filter_by(
        student_id=current_user.id,
        session_id=attendance_session.id
    ).first()

    if existing:
        return error_response("Attendance already marked", 400)

    # ================= RATE LIMIT =================
    if is_rate_limited(current_user.id, "attendance"):
        retry_after = get_retry_after(current_user.id, "attendance")
        return error_response(f"Too many attempts. Wait {retry_after}s", 429)

    # ================= TOKEN =================
    valid, message = verify_attendance_token(token, current_user.id, int(session_id))
    if not valid:
        register_failed_biometric(current_user.id)
        record_threat(current_user.id, 3, "Replay Attack Attempt",
                      session_id=attendance_session.id)
        return error_response(message, 403)

    # ================= FACE REGISTERED =================
    if not current_user.face_registered:
        return error_response("Face not registered", 400)

    # ================= IMAGE =================
    if "image" not in request.files:
        return error_response("Face image required", 400)

    file = request.files["image"]
    file_bytes = np.frombuffer(file.read(), np.uint8)
    image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    if image is None:
        register_failed_biometric(current_user.id)
        return error_response("Invalid image", 400)

    # ================= LIVENESS =================
    is_live, reason = detect_liveness(image)
    if not is_live:
        register_failed_biometric(current_user.id)
        record_threat(current_user.id, 3, "Spoofing Attempt",
                      session_id=attendance_session.id)
        return error_response("Liveness check failed", 403)

    # ================= FACE VERIFY =================
    matched_user, similarity = verify_face(image, [current_user])
    if not matched_user:
        register_failed_biometric(current_user.id)
        record_threat(current_user.id, 1, "Face Impersonation",
                      session_id=attendance_session.id,
                      similarity=similarity)
        return error_response("Face verification failed", 403)

    # ================= GEO VALIDATION (FIXED) =================
    geo_valid, distance = validate_geo(
        attendance_session.course.department,
        float(latitude),
        float(longitude)
    )

    if not geo_valid:
        register_failed_biometric(current_user.id)
        record_threat(current_user.id, 2, "Location validation failed",
                      session_id=attendance_session.id,
                      distance=distance)
        return error_response("Outside allowed campus", 403)

    # ================= SUCCESS =================
    record = AttendanceRecord(
        student_id=current_user.id,
        session_id=attendance_session.id,
        similarity_score=similarity,
        geo_distance_meters=distance,
        ip_address=get_client_ip(),
        verification_method="face+geo"
    )

    db.session.add(record)
    db.session.commit()

    flask_session["attended_session_id"] = attendance_session.id
    flask_session.modified = True

    from app.services.threat_detection import USER_THREATS
    USER_THREATS.pop(current_user.id, None)

    log_event(f"Attendance success: user {current_user.id}")

    return success_response("Attendance marked", {
        "similarity": round(similarity, 3),
        "distance_meters": round(distance, 2)
    })

@api_student.route("/courses")
@role_required_api("student")
def student_courses():

    enrollments = Enrollment.query.filter_by(
        student_id=current_user.id
    ).all()

    data = [
        {
            "id": e.course.id,
            "name": e.course.name,
            "code": e.course.code
        }
        for e in enrollments
    ]

    return success_response(data)

@api_student.route("/submit-feedback", methods=["POST"])
@role_required_api("student")
def submit_feedback():

    if not validate_csrf():
        return error_response("Security token expired. Refresh the page.", 403)

    data = request.get_json()

    course_id = data.get("course_id")
    message = data.get("message")
    rating = data.get("rating")

    # ---------------- INPUT VALIDATION ----------------

    if not course_id or not message or rating is None:
        return error_response("Course, rating and message are required", 400)

    try:
        rating = int(rating)
    except:
        return error_response("Rating must be a number", 400)

    if rating < 1 or rating > 5:
        return error_response("Rating must be between 1 and 5", 400)

    # ---------------- ENROLLMENT CHECK ----------------

    enrollment = Enrollment.query.filter_by(
        student_id=current_user.id,
        course_id=course_id
    ).first()

    if not enrollment:
        return error_response("Not enrolled in this course", 403)

    # ---------------- SAVE FEEDBACK ----------------

    session_id = data.get("session_id")

    # validate session
    session_obj = AttendanceSession.query.get(session_id)
    if not session_obj:
        return error_response("Invalid class session", 400)

    # must belong to selected course
    if session_obj.course_id != int(course_id):
        return error_response("Session does not belong to selected course", 400)

    # must have attended
    attended = AttendanceRecord.query.filter_by(
        student_id=current_user.id,
        session_id=session_id
    ).first()

    if not attended:
        return error_response("You can only give feedback after attending class", 403)

    # prevent duplicate feedback
    existing = Feedback.query.filter_by(
        student_id=current_user.id,
        session_id=session_id
    ).first()

    if existing:
        return error_response("You already submitted feedback for this class", 400)

    feedback = Feedback(
        student_id=current_user.id,
        course_id=course_id,
        session_id=session_id,
        message=message,
        rating=rating
    )

    db.session.add(feedback)
    db.session.commit()

    # ---------------- FIND LAST ATTENDED SESSION ----------------

    last_session = (
        AttendanceSession.query
        .join(AttendanceRecord,
              AttendanceRecord.session_id == AttendanceSession.id)
        .filter(AttendanceRecord.student_id == current_user.id)
        .order_by(AttendanceSession.start_time.desc())
        .first()
    )

    # ---------------- NEGATIVE FEEDBACK DETECTION ----------------

    if rating <= 2:

        feedback.is_flagged = True
        db.session.commit()

        # -------- FORMAT SESSION INFO --------

        if last_session:
            class_time = format_ist(last_session.start_time)
            session_id_text = last_session.id
        else:
            class_time = "Unknown"
            session_id_text = "N/A"

        submitted_time = format_ist(feedback.created_at)

        subject = "🚨 Negative Student Feedback Alert"

        body = f"""
Student: {current_user.name}
Email: {current_user.email}

Course: {feedback.course.name}
Session ID: {session_id_text}
Class Time: {class_time}

Rating: {rating}/5

Message:
{message}

Submitted At: {submitted_time}
"""

        send_alert_async(subject, body)

    # ---------------- SUCCESS RESPONSE ----------------

    return success_response(
        message="Feedback submitted successfully"
    )

@api_student.route("/feedback-history")
@role_required_api("student")
def feedback_history():

    feedbacks = (
        Feedback.query
        .filter_by(student_id=current_user.id)
        .order_by(Feedback.created_at.desc())
        .all()
    )

    result = []

    for f in feedbacks:

        # Safe session info
        session_time = None
        if f.session_id:
            session = AttendanceSession.query.get(f.session_id)
            if session:
                session_time = to_api_time(session.start_time)

        result.append({
            "id": f.id,
            "course": f.course.name,
            "rating": f.rating,
            "message": f.message,
            "session_time": session_time,
            "submitted": to_api_time(f.created_at)
        })

    return success_response(result)

@api_student.route("/feedback-stats")
@role_required_api("student")
def feedback_stats():

    # total feedback submitted
    total_feedback = Feedback.query.filter_by(
        student_id=current_user.id
    ).count()

    # average rating
    ratings = db.session.query(db.func.avg(Feedback.rating)).filter(
        Feedback.student_id == current_user.id
    ).scalar()

    avg_rating = round(float(ratings),2) if ratings else 0

    # total attended sessions
    attended_sessions = AttendanceRecord.query.filter_by(
        student_id=current_user.id
    ).count()

    # sessions already given feedback
    feedback_sessions = db.session.query(Feedback.session_id).filter(
        Feedback.student_id == current_user.id
    ).distinct().count()

    pending_feedback = attended_sessions - feedback_sessions

    return success_response({
        "total_feedback": total_feedback,
        "average_rating": avg_rating,
        "pending_feedback": max(pending_feedback,0)
    })

@api_student.route("/feedback-sessions")
@role_required_api("student")
def feedback_sessions():

    sessions = (
        db.session.query(AttendanceSession)
        .join(AttendanceRecord, AttendanceRecord.session_id == AttendanceSession.id)
        .filter(
            AttendanceRecord.student_id == current_user.id
        )
        .order_by(AttendanceSession.start_time.desc())
        .all()
    )

    result = []

    for s in sessions:
        result.append({
            "session_id": s.id,
            "course_id": s.course_id,
            "course": s.course.name,
            "date": to_api_time(s.start_time)
        })

    return success_response(result)

@api_student.route("/register-face", methods=["POST"])
@role_required_api("student")
def register_face_api():

    if "images" not in request.files:
        return error_response("No images received", 400)

    files = request.files.getlist("images")

    if len(files) < 3:
        return error_response("Capture at least 3 face samples", 400)

    images = []

    for file in files:
        file_bytes = np.frombuffer(file.read(), np.uint8)
        img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

        if img is None:
            return error_response("Invalid image capture", 400)

        images.append(img)

    success, message = register_face(current_user, images)

    if not success:
        return error_response(message, 400)

    return success_response("Face registered successfully")

@api_student.route("/live-notifications")
@role_required_api("student")
def live_notifications():

    user_id = current_user.id

    def event_stream():

        last_notified = None

        while True:
            try:
                now = datetime.utcnow()

                session_obj = (
                    db.session.query(AttendanceSession)
                    .join(Course, AttendanceSession.course_id == Course.id)
                    .join(Enrollment, Enrollment.course_id == Course.id)
                    .filter(
                        Enrollment.student_id == user_id,
                        AttendanceSession.is_active == True,
                        AttendanceSession.start_time <= now,
                        AttendanceSession.end_time >= now
                    )
                    .order_by(AttendanceSession.start_time.desc())
                    .first()
                )

                if session_obj:

                    attended = AttendanceRecord.query.filter_by(
                        student_id=user_id,
                        session_id=session_obj.id
                    ).first()

                    if not attended and session_obj.id != last_notified:

                        payload = {
                            "type": "session_started",
                            "course": session_obj.course.name,
                            "session_id": session_obj.id,
                            "end_time": to_api_time(session_obj.end_time)
                        }

                        last_notified = session_obj.id
                        yield f"data: {json.dumps(payload)}\n\n"

            except Exception as e:
                print("SSE ERROR:", e)
                db.session.rollback()

            finally:
                db.session.remove()

            time.sleep(4)

    return Response(
        stream_with_context(event_stream()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )

@api_student.route("/biometric-status")
@role_required_api("student")
def biometric_status():
    return success_response({
        "face_registered": current_user.face_registered
    })
