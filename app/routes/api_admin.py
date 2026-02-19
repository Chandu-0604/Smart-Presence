from flask import Blueprint, jsonify, request
from flask_login import current_user
from sqlalchemy.exc import IntegrityError
from app.extensions import db
from app.utils.decorators import role_required_api
from app.utils.responses import success_response, error_response
from app.utils.logger import log_event
from app.models.user import User
from app.models.course import Course
from app.models.attendance_session import AttendanceSession
from app.models.security_log import SecurityLog
from app.models.enrollment import Enrollment
from app.models.attendance_record import AttendanceRecord
from app.models.security_alert import SecurityAlert
from datetime import datetime
from sqlalchemy import func

api_admin = Blueprint("api_admin", __name__)

@api_admin.route("/analytics")
@role_required_api("admin")
def analytics():

    total_users = User.query.count()
    total_sessions = AttendanceSession.query.count()
    total_courses = Course.query.count()
    total_logs = SecurityLog.query.count()

    course_data = []

    courses = Course.query.all()

    for course in courses:
        total_sessions_course = AttendanceSession.query.filter_by(
            course_id=course.id
        ).count()

        enrolled = Enrollment.query.filter_by(
            course_id=course.id
        ).count()

        attended = AttendanceRecord.query.join(
            AttendanceSession
        ).filter(
            AttendanceSession.course_id == course.id
        ).count()

        percentage = 0
        if total_sessions_course > 0 and enrolled > 0:
            percentage = round(
                (attended / (total_sessions_course * enrolled)) * 100, 2
            )

        course_data.append({
            "name": course.name,
            "percentage": percentage
        })

    log_event("Viewed analytics dashboard")

    return success_response({
        "total_users": total_users,
        "total_sessions": total_sessions,
        "total_courses": total_courses,
        "total_logs": total_logs,
        "courses": course_data
    })

# ================= ADVANCED ANALYTICS =================

@api_admin.route("/analytics-advanced")
@role_required_api("admin")
def analytics_advanced():

    from sqlalchemy import func, cast, Date, extract
    from datetime import datetime, timedelta
    from app.models.department import Department

    # ----------------------------------------
    # 1️⃣ DAILY TREND (last 7 days)
    # ----------------------------------------
    seven_days_ago = datetime.utcnow() - timedelta(days=6)

    daily = (
        db.session.query(
            func.date(AttendanceRecord.marked_at).label("day"),
            func.count(AttendanceRecord.id).label("count")
        )
        .filter(AttendanceRecord.marked_at >= seven_days_ago)
        .group_by(func.date(AttendanceRecord.marked_at))
        .order_by(func.date(AttendanceRecord.marked_at))
        .all()
    )

    trend_labels = []
    trend_data = []

    for row in daily:
        # row.day is string in SQLite
        day_str = row.day
        formatted = datetime.strptime(day_str, "%Y-%m-%d").strftime("%d %b")
        trend_labels.append(formatted)
        trend_data.append(row.count)


    # ----------------------------------------
    # 2️⃣ DEPARTMENT ATTENDANCE COMPARISON
    # ----------------------------------------
    dept_stats = []

    departments = Department.query.all()

    for dept in departments:

        students = User.query.filter_by(role="student", department_id=dept.id).all()
        student_ids = [s.id for s in students]

        total_sessions = AttendanceSession.query.join(Course).filter(
            Course.department_id == dept.id
        ).count()

        total_attendance = AttendanceRecord.query.filter(
            AttendanceRecord.student_id.in_(student_ids)
        ).count()

        max_possible = total_sessions * len(student_ids)

        percentage = 0
        if max_possible > 0:
            percentage = round((total_attendance / max_possible) * 100, 2)

        dept_stats.append({
            "name": dept.code,
            "percentage": percentage
        })

    # ----------------------------------------
    # 3️⃣ PEAK ATTENDANCE HOUR
    # ----------------------------------------
    peak = (
        db.session.query(
            extract("hour", AttendanceRecord.marked_at).label("hour"),
            func.count(AttendanceRecord.id).label("count")
        )
        .group_by("hour")
        .order_by(func.count(AttendanceRecord.id).desc())
        .first()
    )

    peak_hour = int(peak.hour) if peak else None

    # ----------------------------------------
    # 4️⃣ LATE RATE (10 min threshold)
    # ----------------------------------------
    late_count = 0
    all_records = AttendanceRecord.query.join(
        AttendanceSession
    ).with_entities(
        AttendanceRecord.marked_at,
        AttendanceSession.start_time
    ).all()

    for r in all_records:
        if r.marked_at > (r.start_time + timedelta(minutes=10)):
            late_count += 1

    late_rate = 0
    if len(all_records) > 0:
        late_rate = round((late_count / len(all_records)) * 100, 2)

    # ----------------------------------------
    # 5️⃣ MOST RISKY COURSE (highest alerts)
    # ----------------------------------------
    risky = (
        db.session.query(
            SecurityAlert.course_name,
            func.count(SecurityAlert.id).label("count")
        )
        .group_by(SecurityAlert.course_name)
        .order_by(func.count(SecurityAlert.id).desc())
        .first()
    )

    risky_course = risky.course_name if risky else None

    return success_response({
        "trend": {
            "labels": trend_labels,
            "data": trend_data
        },
        "departments": dept_stats,
        "peak_hour": peak_hour,
        "late_rate": late_rate,
        "most_risky_course": risky_course
    })

@api_admin.route("/create-faculty", methods=["POST"])
@role_required_api("admin")
def create_faculty():

    data = request.get_json()

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not name or not email or not password:
        return error_response("All fields are required")

    if User.query.filter_by(email=email).first():
        return error_response("Email already exists")

    # -------------------------------------------------
    # IMPORTANT: Faculty MUST have department
    # -------------------------------------------------
    from app.models.department import Department

    default_dept = Department.query.filter_by(code="UNASSIGNED").first()

    # auto create if missing (safety)
    if not default_dept:
        default_dept = Department(
            name="Unassigned",
            code="UNASSIGNED",
            latitude=0.0,
            longitude=0.0,
            allowed_radius_meters=1
        )
        db.session.add(default_dept)
        db.session.commit()

    # create faculty
    user = User(
        name=name,
        email=email,
        role="faculty",
        department_id=default_dept.id,
        is_enabled=True
    )

    user.set_password(password)

    try:
        db.session.add(user)
        db.session.commit()

        log_event(f"Created faculty account: {email}")

        return success_response(message="Faculty created successfully")

    except Exception as e:
        db.session.rollback()
        print("CREATE FACULTY ERROR:", e)
        return error_response("Database error", 500)
    
@api_admin.route("/users")
@role_required_api("admin")
def list_users():

    users = User.query.all()

    data = []

    for u in users:

        # -------- COURSE COUNTS --------
        if u.role.lower() == "faculty":
            course_count = Course.query.filter_by(faculty_id=u.id).count()

        elif u.role.lower() == "student":
            course_count = Enrollment.query.filter_by(student_id=u.id).count()

        else:
            course_count = 0

        academic = None
        if u.role.lower() == "student":
            academic = {
                "year": int(u.year) if u.year else None,
                "semester": int(u.semester) if u.semester else None,
                "section": u.section or "",
                "usn": u.usn or ""
            }

        data.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role.lower(),
            "is_enabled": u.is_enabled,
            "department": u.department.name if u.department else "Unassigned",
            "course_count": course_count,
            "academic": academic
        })

    return jsonify({
        "success": True,
        "data": data
    })

@api_admin.route("/disable-user/<int:user_id>", methods=["POST"])
@role_required_api("admin")
def disable_user(user_id):

    user = User.query.get_or_404(user_id)

    if user.id == current_user.id:
        return error_response("You cannot disable your own account", 403)

    if user.role == "admin":
        return error_response("Cannot disable another admin", 403)

    user.is_enabled = False
    db.session.commit()

    log_event(f"Disabled user: {user.email}")

    return success_response(message="User disabled successfully")

@api_admin.route("/delete-user/<int:user_id>", methods=["DELETE"])
@role_required_api("admin")
def delete_user(user_id):

    user = User.query.get_or_404(user_id)

    if user.role == "admin":
        return error_response("Cannot delete an admin", 403)

    if user.id == current_user.id:
        return error_response("You cannot delete your own account", 403)

    db.session.delete(user)
    db.session.commit()

    log_event(f"Deleted user: {user.email}")

    return success_response(message="User deleted successfully")

@api_admin.route("/enable-user/<int:user_id>", methods=["POST"])
@role_required_api("admin")
def enable_user(user_id):

    from flask_login import current_user

    user = User.query.get_or_404(user_id)

    if user.role == "admin":
        return error_response("Cannot modify admin account")

    user.is_enabled = True
    db.session.commit()

    return success_response(message="User enabled")

@api_admin.route("/create-course", methods=["POST"])
@role_required_api("admin")
def create_course():

    data = request.get_json()

    name = data.get("name")
    code = data.get("code")
    faculty_id = data.get("faculty_id")
    department_id = data.get("department_id")

    if not name or not code or not department_id:
        return error_response("Name, code and department are required")

    # Course code unique
    if Course.query.filter_by(code=code).first():
        return error_response("Course code already exists")

    # Validate department
    from app.models.department import Department
    department = Department.query.get(department_id)

    if not department:
        return error_response("Invalid department")

    # Validate faculty (optional)
    faculty = None
    if faculty_id:
        faculty = User.query.filter_by(id=faculty_id, role="faculty").first()
        if not faculty:
            return error_response("Invalid faculty selected")

    # Create course
    course = Course(
        name=name,
        code=code,
        faculty_id = data.get("faculty_id"),
        department_id=department.id
    )

    db.session.add(course)
    db.session.commit()

    log_event(f"Created course: {code} in department {department.code}")

    return success_response(message="Course created successfully")

@api_admin.route("/delete-course/<int:course_id>", methods=["DELETE"])
@role_required_api("admin")
def delete_course(course_id):

    from app.models.attendance_session import AttendanceSession
    from app.models.attendance_record import AttendanceRecord
    from app.models.enrollment import Enrollment
    from app.models.feedback import Feedback

    course = Course.query.get_or_404(course_id)

    # Delete attendance records linked to sessions
    sessions = AttendanceSession.query.filter_by(course_id=course.id).all()

    for session in sessions:
        AttendanceRecord.query.filter_by(session_id=session.id).delete()
        db.session.delete(session)

    # Delete enrollments
    Enrollment.query.filter_by(course_id=course.id).delete()

    # Delete feedback
    Feedback.query.filter_by(course_id=course.id).delete()

    # Finally delete course
    db.session.delete(course)

    db.session.commit()

    return success_response(message="Course deleted successfully")

@api_admin.route("/logs")
@role_required_api("admin")
def logs():

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    pagination = SecurityLog.query.order_by(
        SecurityLog.created_at.desc()
    ).paginate(page=page, per_page=per_page, error_out=False)

    logs_data = []

    for log in pagination.items:
        logs_data.append({
            "id": log.id,
            "user": log.user.name if log.user else "System",
            "event": log.event,
            "ip_address": log.ip_address,
            "time": log.created_at.isoformat()
        })

    return success_response({
        "logs": logs_data,
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": page
    })

@api_admin.route("/faculty-list")
@role_required_api("admin")
def faculty_list():

    faculty = User.query.filter_by(role="faculty", is_enabled=True).all()

    data = [
        {
            "id": f.id,
            "name": f.name,
            "email": f.email
        }
        for f in faculty
    ]

    return success_response(data)

@api_admin.route("/courses")
@role_required_api("admin")
def list_courses():

    courses = Course.query.all()

    data = [
        {
            "id": c.id,
            "name": c.name,
            "code": c.code,
            "faculty": c.faculty.name if c.faculty else "Unassigned",
            "faculty_id": c.faculty_id,
            "department_id": c.department_id
        }
        for c in courses
    ]

    return success_response(data)

@api_admin.route("/students")
@role_required_api("admin")
def get_students():

    students = User.query.filter_by(role="student").all()

    data = [
        {
            "id": s.id,
            "name": s.name,
            "email": s.email
        }
        for s in students
    ]

    return success_response(data)

@api_admin.route("/course/<int:course_id>/students")
@role_required_api("admin")
def get_course_students(course_id):

    enrollments = Enrollment.query.filter_by(
        course_id=course_id
    ).all()

    data = [
        {
            "id": e.student.id,
            "name": e.student.name,
            "email": e.student.email
        }
        for e in enrollments
    ]

    return success_response(data)

@api_admin.route("/enroll-student", methods=["POST"])
@role_required_api("admin")
def enroll_student():

    data = request.get_json()

    student_id = data.get("student_id")
    course_id = data.get("course_id")

    if Enrollment.query.filter_by(
        student_id=student_id,
        course_id=course_id
    ).first():
        return error_response("Student already enrolled")

    enrollment = Enrollment(
        student_id=student_id,
        course_id=course_id
    )

    db.session.add(enrollment)
    db.session.commit()

    return success_response(message="Student enrolled")

@api_admin.route("/remove-enrollment", methods=["DELETE"])
@role_required_api("admin")
def remove_enrollment():

    data = request.get_json()

    student_id = data.get("student_id")
    course_id = data.get("course_id")

    enrollment = Enrollment.query.filter_by(
        student_id=student_id,
        course_id=course_id
    ).first_or_404()

    db.session.delete(enrollment)
    db.session.commit()

    return success_response(message="Student removed")

from app.utils.email_utils import send_alert_async
from flask_login import login_required
from app.utils.decorators import role_required_api
from app.utils.responses import success_response

@api_admin.route("/security-alerts")
@role_required_api("admin")
def security_alerts():

    alerts = SecurityAlert.query.order_by(
        SecurityAlert.created_at.desc()
    ).limit(50).all()

    data = []

    for a in alerts:
        data.append({
            "id": a.id,
            "user": a.user.name if a.user else "Unknown",
            "email": a.user.email if a.user else "Unknown",
            "event": a.event,
            "details": a.details,
            "course": a.course_name,
            "session_id": a.session_id,
            "ip": a.ip_address,
            "time": a.created_at.isoformat(),
            "resolved": a.is_resolved
        })

    return success_response(data)

@api_admin.route("/resolve-alert/<int:alert_id>", methods=["POST"])
@role_required_api("admin")
def resolve_alert(alert_id):

    alert = SecurityAlert.query.get_or_404(alert_id)

    alert.is_resolved = True
    db.session.commit()

    log_event(f"Resolved security alert #{alert_id}")

    return success_response(message="Alert marked as resolved")

# ================= DASHBOARD STATS =================

@api_admin.route("/dashboard-stats")
@role_required_api("admin")
def dashboard_stats():

    total_users = User.query.count()
    total_courses = Course.query.count()

    # active sessions
    active_sessions = AttendanceSession.query.filter_by(is_active=True).count()

    # -------- TODAY ATTENDANCE (FIXED) --------
    today = datetime.utcnow().date()

    today_attendance = AttendanceRecord.query.filter(
        func.date(AttendanceRecord.marked_at) == today
    ).count()

    return success_response({
        "users": total_users,
        "today_attendance": today_attendance,
        "courses": total_courses,
        "active_sessions": active_sessions,
        "system": "ONLINE"
    })

# ================= DEPARTMENTS =================
from app.models.department import Department

@api_admin.route("/departments")
@role_required_api("admin")
def list_departments():

    depts = Department.query.all()

    data = [
        {
            "id": d.id,
            "name": d.name,
            "code": d.code,
            "radius": d.allowed_radius_meters
        }
        for d in depts
    ]

    return success_response(data)

@api_admin.route("/create-department", methods=["POST"])
@role_required_api("admin")
def create_department():

    data = request.get_json()

    name = data.get("name")
    code = data.get("code")
    radius = data.get("radius", 300)

    if not name or not code:
        return error_response("Name and code required")

    if Department.query.filter_by(code=code).first():
        return error_response("Department code already exists")

    dept = Department(
        name=name,
        code=code.upper(),
        latitude=0.0,
        longitude=0.0,
        allowed_radius_meters=radius
    )

    db.session.add(dept)
    db.session.commit()

    log_event(f"Created department {code}")

    return success_response(message="Department created")

@api_admin.route("/delete-department/<int:dept_id>", methods=["DELETE"])
@role_required_api("admin")
def delete_department(dept_id):

    dept = Department.query.get_or_404(dept_id)

    if dept.code == "UNASSIGNED":
        return error_response("Cannot delete default department")

    db.session.delete(dept)
    db.session.commit()

    log_event(f"Deleted department {dept.code}")

    return success_response(message="Department deleted")

@api_admin.route("/faculty-by-department/<int:dept_id>")
@role_required_api("admin")
def faculty_by_department(dept_id):

    from app.models.user import User

    faculty = User.query.filter_by(
        role="faculty",
        department_id=dept_id,
        is_enabled=True
    ).all()

    return jsonify({
        "success": True,
        "data": [
            {
                "id": f.id,
                "name": f.name
            } for f in faculty
        ]
    })

@api_admin.route("/assign-course-faculty/<int:course_id>", methods=["PUT"])
@role_required_api("admin")
def assign_course_faculty(course_id):

    data = request.get_json()
    faculty_id = data.get("faculty_id")

    course = Course.query.get_or_404(course_id)

    # allow unassign also
    if faculty_id:
        faculty = User.query.get(faculty_id)
        if not faculty or faculty.role.lower() != "faculty":
            return error_response("Invalid faculty", 400)

    course.faculty_id = faculty_id
    db.session.commit()

    return success_response("Faculty updated")

@api_admin.route("/update-faculty-department/<int:user_id>", methods=["PUT"])
@role_required_api("admin")
def update_faculty_department(user_id):

    data = request.get_json()
    department_id = data.get("department_id")

    from app.models.user import User
    from app.models.department import Department

    user = User.query.get_or_404(user_id)

    if user.role.lower() != "faculty":
        return error_response("User is not faculty", 400)

    dept = Department.query.get(department_id)
    if not dept:
        return error_response("Invalid department", 400)

    user.department_id = department_id
    db.session.commit()

    return success_response("Faculty department updated")

@api_admin.route("/update-student-academic/<int:user_id>", methods=["PUT"])
@role_required_api("admin")
def update_student_academic(user_id):

    data = request.get_json()

    user = User.query.get_or_404(user_id)

    if user.role.lower() != "student":
        return error_response("Not a student", 400)

    user.usn = data.get("usn")
    user.year = data.get("year")
    user.semester = data.get("semester")
    user.section = data.get("section")

    db.session.commit()

    return success_response("Student updated")
@api_admin.route("/update-student-department/<int:user_id>", methods=["PUT"])
@role_required_api("admin")
def update_student_department(user_id):

    data = request.get_json()
    department_id = data.get("department_id")

    user = User.query.get_or_404(user_id)

    if user.role != "student":
        return jsonify({
            "success": False,
            "error": "Only students allowed"
        }), 400

    user.department_id = department_id
    db.session.commit()

    return jsonify({"success": True})