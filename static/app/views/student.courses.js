import { api } from "../services/api.js";

export async function studentCourses(view){

    view.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">My Courses</h1>
        </div>
        <div id="courseList"></div>
    `;

    const res = await api("/api/student/dashboard");

    const html = res.data.courses.map(c=>`
        <div class="card">
            <h3>${c.name}</h3>
            Attendance: <b>${c.percentage}%</b><br>
            Attended: ${c.attended} / ${c.total_sessions}
        </div>
    `).join("");

    document.getElementById("courseList").innerHTML = html;
}
