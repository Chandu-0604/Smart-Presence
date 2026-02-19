import { api } from "../services/api.js";
import { Toast } from "../core/toast.js";
import { onViewDestroyed } from "../core/view-lifecycle.js";
import { renderPage } from "../core/page.js";

let notifySource = null;

window.addEventListener("beforeunload", ()=>{
    if(notifySource){
        notifySource.close();
        notifySource = null;
    }
});


export async function studentDashboard(view){

    if(notifySource){
        notifySource.close();
        notifySource = null;
    }

    view.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">Student Dashboard</h1>
        </div>

        <div class="card">
            <h3>Active Class</h3>
            <div id="activeClass">Checking...</div>
        </div>

        <div class="card">
            <h3>Overall Attendance</h3>
            <div id="overallAttendance">Loading...</div>
        </div>
    `;

    loadActive();
    loadStats();
    startNotificationStream();

    onViewDestroyed(view, ()=>{
        if(notifySource){
            notifySource.close();
            notifySource = null;
        }
    });
}

async function loadActive(){

    const res = await api("/api/student/active-session");
    const box = document.getElementById("activeClass");

    if(!res.success || !res.data.active){
        box.innerHTML = `<div class="status-badge gray">No active class</div>`;
        return;
    }

    let actionHtml = "";

    if(res.data.already_marked){
        actionHtml = `
            <div class="status-badge blue">
                Attendance Already Marked
            </div>
        `;
    }else{
        actionHtml = `
            <a class="btn btn-primary" href="/student/attendance">
                Mark Attendance
            </a>
        `;
    }

    box.innerHTML = `
        <div class="status-badge green">LIVE NOW</div>
        <strong>${res.data.course_name}</strong><br>
        Ends: ${res.data.end_time}<br><br>
        ${actionHtml}
    `;
}

async function loadStats(){

    const res = await api("/api/student/dashboard");

    document.getElementById("overallAttendance").innerHTML = `
        <h2>${res.data.average_attendance}%</h2>
        <small>Across ${res.data.total_courses} courses</small>
    `;
}

function startNotificationStream(){

    if(!location.pathname.startsWith("/student")) return;

    if(notifySource){
        notifySource.close();
    }

    notifySource = new EventSource("/api/student/live-notifications");

    notifySource.onmessage = (event)=>{

        // IMPORTANT: only act if on dashboard
        if(location.pathname !== "/student") return;

        const data = JSON.parse(event.data);

        if(data.type === "session_started"){

            Toast.show(
                `${data.course} attendance started!`,
                "success",
                6000
            );

            loadActive(); // refresh UI only
        }
    };
}
