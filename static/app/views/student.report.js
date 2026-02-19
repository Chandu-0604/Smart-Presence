import { api } from "../services/api.js";

export async function studentReport(view){

    const res = await api("/api/student/dashboard");

    const rows = res.data.courses.map(c=>`
        <tr>
            <td>${c.name}</td>
            <td>${c.attended}</td>
            <td>${c.total_sessions}</td>
            <td>${c.percentage}%</td>
        </tr>
    `).join("");

    view.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">Attendance Report</h1>
        </div>

        <div class="card">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Course</th>
                        <th>Attended</th>
                        <th>Total</th>
                        <th>%</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}
