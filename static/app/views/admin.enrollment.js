import { api } from "../services/api.js";
import { Toast } from "../core/toast.js";
import { Modal } from "../core/modal.js";

export async function openEnrollment(course){

    Modal.show(`
        <h2>Manage Enrollment — ${course.name}</h2>

        <div class="enrollment-container">

            <div class="enroll-col">
                <h3>All Students</h3>
                <ul id="allStudents" class="enroll-list"></ul>
            </div>

            <div class="enroll-col">
                <h3>Enrolled Students</h3>
                <ul id="courseStudents" class="enroll-list"></ul>
            </div>

        </div>
    `);

    await loadStudents(course.id);
}

async function loadStudents(courseId){

    const allRes = await api("/api/admin/students");
    const enrolledRes = await api(`/api/admin/course/${courseId}/students`);

    if(!allRes?.success || !enrolledRes?.success){
        Toast.show("Failed to load students","error");
        return;
    }

    const allStudents = allRes.data;
    const enrolledStudents = enrolledRes.data;

    const enrolledIds = new Set(enrolledStudents.map(s=>s.id));

    const allList = document.getElementById("allStudents");
    const courseList = document.getElementById("courseStudents");

    allList.innerHTML = "";
    courseList.innerHTML = "";

    /* LEFT SIDE — AVAILABLE */
    allStudents.forEach(s=>{
        if(enrolledIds.has(s.id)) return;

        const li = document.createElement("li");
        li.innerHTML = `
            <span>${s.name}</span>
            <button class="btn-small success">Enroll</button>
        `;

        li.querySelector("button").onclick = ()=> enrollStudent(courseId, s.id);

        allList.appendChild(li);
    });

    /* RIGHT SIDE — ENROLLED */
    enrolledStudents.forEach(s=>{
        const li = document.createElement("li");
        li.innerHTML = `
            <span>${s.name}</span>
            <button class="btn-small danger">Remove</button>
        `;

        li.querySelector("button").onclick = ()=> removeStudent(courseId, s.id);

        courseList.appendChild(li);
    });
}

async function enrollStudent(courseId, studentId){

    const res = await api("/api/admin/enroll-student",{
        method:"POST",
        body: JSON.stringify({
            course_id:courseId,
            student_id:studentId
        })
    });

    if(res?.success){
        Toast.show("Student enrolled","success");
        loadStudents(courseId);
    }
}

async function removeStudent(courseId, studentId){

    const res = await api("/api/admin/remove-enrollment",{
        method:"DELETE",
        body: JSON.stringify({
            course_id:courseId,
            student_id:studentId
        })
    });

    if(res?.success){
        Toast.show("Student removed","info");
        loadStudents(courseId);
    }
}