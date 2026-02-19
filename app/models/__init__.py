from app.models.user import User
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.attendance_session import AttendanceSession
from app.models.attendance_record import AttendanceRecord
from app.models.feedback import Feedback
from app.models.security_log import SecurityLog
from .department import Department
from app.models.security_alert import SecurityAlert
from app.models.attendance_token import AttendanceToken

# Important: expose db metadata
from app.extensions import db

def register_models():
    return db.Model.metadata