import { api } from "../services/api.js";
import { formatTime } from "../core/time.js";

let poller = null;
let liveSource = null;

export async function facultyDashboard(view){
    if(poller){
        clearInterval(poller);
        poller = null;
    }

    view.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">Faculty Dashboard</h1>
        </div>

        <div class="card">
            <h3>Live Session</h3>
            <div id="liveBox">Checking...</div>
            <div id="liveStudents" class="live-students"></div>
        </div>

        <div class="card">
            <h3>Quick Actions</h3>
            <a href="/faculty/sessions" class="btn btn-primary">
                Manage Attendance Sessions
            </a>
        </div>
    `;

    checkLive();
    poller = setInterval(checkLive, 5000);
        // stop polling if user navigates away
    const observer = new MutationObserver(()=>{
        if(!document.body.contains(view)){
            clearInterval(poller);
            poller = null;
            observer.disconnect();
        }
    });

    observer.observe(document.body,{childList:true,subtree:true});

}

async function checkLive(){

    const box = document.getElementById("liveBox");
    if(!box) return;

    const res = await api("/api/faculty/active-session");

    if(!res){
        box.innerHTML = `<div class="status-badge gray">Offline</div>`;
        return;
    }

    if(!res.success || !res.data){
        box.innerHTML = `
            <div class="status-badge gray">No Active Session</div>
            <small>You can start one from Attendance Sessions page</small>
        `;
        return;
    }

    const s = res.data;
    startLiveStream(s.id);

    box.innerHTML = `
        <div class="status-badge green">Active Session</div>
        <div class="live-info">
            <strong>${s.course_name}</strong><br>
            Present Students: ${s.present_count}<br>
            Ends: ${formatTime(s.end_time)}
        </div>
    `;
}

function startLiveStream(sessionId){

    if(liveSource){
        liveSource.close();
    }

    const list = document.getElementById("liveStudents");
    if(!list) return;

    list.innerHTML = "";

    liveSource = new EventSource(`/api/faculty/live-session-stream/${sessionId}`);

    liveSource.onmessage = (event)=>{

        const data = JSON.parse(event.data);

        const row = document.createElement("div");
        row.className = "live-entry";

        row.innerHTML = `
            <div class="live-name">${data.name}</div>
            <div class="live-time">${formatTime(data.time)}</div>
        `;

        list.prepend(row);
    };

    liveSource.addEventListener("close", ()=>{
        if(liveSource){
            liveSource.close();
            liveSource = null;
        }
    });
}
