from app.models.enrollment import Enrollment

def is_student_enrolled(student_id, course_id):
    enrollment = Enrollment.query.filter_by(
        student_id=student_id,
        course_id=course_id
    ).first()

    return enrollment is not None