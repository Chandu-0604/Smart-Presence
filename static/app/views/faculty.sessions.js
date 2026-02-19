import { api } from "../services/api.js";
import { Toast } from "../core/toast.js";
import { Modal } from "../core/modal.js";
import { formatTime } from "../core/time.js";
import { connectLiveSession, disconnectLiveSession } from "../core/live.js";
import { onViewDestroyed } from "../core/view-lifecycle.js";

/* ================= PAGE LOAD ================= */

export async function facultySessions(view){

    view.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">Attendance Sessions</h1>
            <button id="openBtn" class="btn btn-primary">
                + Start Session
            </button>
        </div>

        <div class="card">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Course</th>
                        <th>Status</th>
                        <th>Start</th>
                        <th>Present</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody id="sessionBody">
                    <tr><td colspan="5">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    document.getElementById("openBtn").onclick = openModal;
    loadSessions();
    /* ---------- session countdown timer ---------- */

    const timer = setInterval(updateSessionTimers, 1000);

    /* cleanup when leaving page */
    onViewDestroyed(view, ()=>{
        clearInterval(timer);
        disconnectLiveSession(); // also safety close SSE
    });

}

/* ================= START SESSION MODAL ================= */

async function openModal(){

    const res = await api("/api/faculty/courses");

    if(!res?.success){
        Toast.show("Failed to load courses","error");
        return;
    }

    const options = res.data.map(c =>
        `<option value="${c.id}">${c.name} (${c.code})</option>`
    ).join("");

    Modal.show(`
        <h2>Start Attendance Session</h2>

        <div class="form-group">
            <label>Course</label>
            <select id="courseSelect" class="form-input">
                ${options}
            </select>
        </div>

        <div class="form-group">
            <label>Duration (minutes)</label>
            <input id="durationInput" type="number" value="5"
                   min="1" max="120" class="form-input">
        </div>

        <div class="modal-actions">
            <button id="startBtn" class="btn btn-primary">
                Start Session
            </button>
        </div>
    `);

    document.getElementById("startBtn").onclick = startSession;
}

async function startSession(){

    const course_id = document.getElementById("courseSelect").value;
    const duration = document.getElementById("durationInput").value;

    const res = await api("/api/faculty/open-session",{
        method:"POST",
        body: JSON.stringify({course_id, duration})
    });

    if(!res?.success){
        Toast.show(res?.error || "Failed","error");
        return;
    }

    Toast.show("Session started","success");
    Modal.close();
    loadSessions();
}

/* ================= LOAD SESSION LIST ================= */

async function loadSessions(){

    const res = await api("/api/faculty/sessions");

    const tbody = document.getElementById("sessionBody");
    tbody.innerHTML = "";

    if(!res?.success || res.data.sessions.length === 0){
        tbody.innerHTML = `<tr><td colspan="5">No sessions</td></tr>`;
        return;
    }

    res.data.sessions.forEach(s=>{

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${s.course_name}</td>
            <td>
                ${
                    s.status === "active"
                    ? `<div class="status-badge green active-badge">
                            <span>Active</span>
                            <span class="session-timer"
                                data-end="${s.end_time}">
                                ⏱ --:--
                            </span>
                    </div>`

                    : s.status === "closing"
                    ? `<div class="status-badge orange closing-badge">
                            <span>Closing</span>
                            <span class="session-timer"
                                data-end="${s.end_time}">
                                ⏳ Closing...
                            </span>
                    </div>`

                    : `<span class="status-badge gray">Closed</span>`
                }
            </td>
            <td>${formatTime(s.start_time)}</td>
            <td>${s.present_count}</td>
            <td>
                <button class="btn-small view-btn" data-id="${s.id}">
                    View
                </button>
                ${
                   s.status === "active"
                    ? `<button class="btn-small danger" data-close="${s.id}">Close</button>`
                    : ""
                }
            </td>
        `;

        tbody.appendChild(tr);
    });

    attachButtons();
    updateSessionTimers();
    // immediately start timer display
    setTimeout(updateSessionTimers, 50);
}

/* ================= BUTTON EVENTS ================= */

function attachButtons(){

    /* CLOSE SESSION */
    document.querySelectorAll("[data-close]").forEach(btn=>{
        btn.onclick = async ()=>{
            const id = btn.dataset.close;

            Modal.confirm("Close this session?", async ()=>{
                await api(`/api/faculty/close-session/${id}`,{
                    method:"POST"
                });
                loadSessions();
            });
        };
    });

    /* VIEW ATTENDANCE */
    document.querySelectorAll(".view-btn").forEach(btn=>{
        btn.onclick = async ()=>{

            const id = btn.dataset.id;
            connectLiveSession(id);

            const res = await api(`/api/faculty/session/${id}/students`);

            if(!res?.success){
                Toast.show("Failed to load attendance","error");
                return;
            }

            openAttendanceReport(res.data);
        };
    });
}

/* ================= ATTENDANCE REPORT ================= */

function openAttendanceReport(students){

    const total = students.length;
    const lowMatch = students.filter(s => s.similarity && s.similarity < 0.60).length;
    const outside = students.filter(s => s.distance && s.distance > 150).length;
    const lateStudents = students.filter(s => s.late).length;

    const trustScore = Math.max(
        0,
        100 - (lowMatch*18 + outside*22 + lateStudents*8)
    );

    let trustLabel = "SAFE";
    if(trustScore < 60) trustLabel = "HIGH RISK";
    else if(trustScore < 85) trustLabel = "WARNING";

    const sortedStudents = [...students].sort((a,b)=>{
        const riskScore = s=>{
            if(s.similarity && s.similarity < 0.60) return 3;
            if(s.distance && s.distance > 150) return 2;
            if(s.late) return 1;
            return 0;
        };
        return riskScore(b) - riskScore(a);
    });

    Modal.show(`
    <div class="attendance-report">

        <div class="report-header">
            <div class="report-title">
                <h2>Biometric Attendance Report</h2>
                <div class="integrity-score ${trustLabel.toLowerCase().replace(" ","-")}">
                    Session Integrity: ${trustScore}% • ${trustLabel}
                </div>
            </div>

            <div class="report-stats">
                <div class="stat present"><span>${total}</span><small>Present</small></div>
                <div class="stat warning"><span>${lateStudents}</span><small>Late</small></div>
                <div class="stat outside"><span>${outside}</span><small>Outside</small></div>
                <div class="stat danger"><span>${lowMatch}</span><small>Low Match</small></div>
            </div>
        </div>

        <div class="attendance-list" id="attendanceList"></div>

    </div>
    `);

    progressiveRender(sortedStudents);
    observeModalClose();
}

function liveUpdateAttendance(sessionId){

    const source = new EventSource(`/api/faculty/session-live/${sessionId}`);

    source.onmessage = (event)=>{
        try{
            const payload = JSON.parse(event.data);

            if(payload.type !== "attendance_update") return;

            const container = document.getElementById("attendanceList");
            if(!container) return;

            const latest = payload.students[payload.students.length - 1];
            if(!latest) return;

            // prepend new student
            container.insertAdjacentHTML(
                "afterbegin",
                studentCard(latest)
            );

        }catch(e){
            console.error("Live update parse error",e);
        }
    };

    // auto close when modal closes
    const modal = document.getElementById("modalRoot");
    const observer = new MutationObserver(()=>{
        if(modal.innerHTML.trim()===""){
            source.close();
            observer.disconnect();
        }
    });

    observer.observe(modal,{childList:true});
}
/* ================= PROGRESSIVE RENDERING ================= */

function progressiveRender(sortedStudents){

    const container = document.getElementById("attendanceList");
    if(!container) return;

    if(sortedStudents.length === 0){
        container.innerHTML = `<div class="empty">No students marked attendance</div>`;
        return;
    }

    let renderIndex = 0;
    const batchSize = 18;
    let loading = false;

    const renderBatch = ()=>{
        const next = sortedStudents.slice(renderIndex, renderIndex + batchSize);

        const fragment = document.createDocumentFragment();

        next.forEach(s=>{
            const wrapper = document.createElement("div");
            wrapper.innerHTML = studentCard(s);
            fragment.appendChild(wrapper.firstElementChild);
        });

        container.appendChild(fragment);
        renderIndex += batchSize;
    };

    renderBatch();

    const onScroll = ()=>{
        if(loading) return;

        if(container.scrollTop + container.clientHeight >= container.scrollHeight - 60){
            if(renderIndex < sortedStudents.length){
                loading = true;
                requestAnimationFrame(()=>{
                    renderBatch();
                    loading = false;
                });
            }
        }
    };

    container.addEventListener("scroll", onScroll);

    /* remove listener when modal closes */
    const modal = document.getElementById("modalRoot");
    const observer = new MutationObserver(()=>{
        if(modal.innerHTML.trim()===""){
            container.removeEventListener("scroll", onScroll);
            observer.disconnect();
        }
    });

    observer.observe(modal,{childList:true});
}

/* ================= CLEANUP ================= */

function observeModalClose(){

    setTimeout(()=>{
        const modal = document.getElementById("modalRoot");
        if(!modal) return;

        const observer = new MutationObserver(()=>{
            if(modal.innerHTML.trim() === ""){
                disconnectLiveSession();
                observer.disconnect();
            }
        });

        observer.observe(modal,{childList:true});
    },200);
}

/* ================= STUDENT CARD ================= */

export function studentCard(s){

    let status = "on-time";
    let statusText = "Verified";
    let warningText = "";
    let riskClass = "";

    if(s.similarity && s.similarity < 0.60){
        status = "danger";
        statusText = "Face Mismatch";
        warningText = "Possible proxy attendance";
        riskClass = "risk-high";
    }
    else if(s.distance && s.distance > 150){
        status = "suspicious";
        statusText = "Outside Campus";
        warningText = "GPS location abnormal";
        riskClass = "risk-medium";
    }
    else if(s.late){
        status = "late";
        statusText = "Late";
        warningText = "Marked after session start";
        riskClass = "risk-low";
    }

    const percent = s.similarity
        ? (s.similarity*100).toFixed(1)+"%"
        : "-";

    return `
        <div class="student-card ${status} ${riskClass}">
            <div class="avatar">${s.name.charAt(0)}</div>

            <div class="student-info">
                <div class="student-name">${s.name}</div>
                <div class="student-meta">
                    ${s.usn || "-"} • ${formatTime(s.time)}
                </div>
                ${warningText ? `<div class="student-warning">${warningText}</div>` : ""}
            </div>

            <div class="biometric">
                <div class="score">${percent}</div>
                <small>Face Match</small>
            </div>

            <div class="status-badge ${status}">
                ${statusText}
            </div>
        </div>
    `;
}

/* ================= SESSION COUNTDOWN ================= */
function updateSessionTimers(){

    const now = Date.now();

    document.querySelectorAll(".session-timer").forEach(el=>{

        const end = Date.parse(el.dataset.end);
        if(!end){
            el.textContent = "--:--";
            return;
        }

        // 30 sec grace period
        const closingTime = end + 30000;
        const remaining = closingTime - now;

        const badge = el.closest(".status-badge");
        const row = el.closest("tr");

        if(remaining <= 0){

            el.textContent = "Closed";

            if(badge){
                badge.classList.remove("green","orange");
                badge.classList.add("gray");
                badge.innerHTML = "Closed";
            }

            // remove close button
            const closeBtn = row?.querySelector("[data-close]");
            if(closeBtn) closeBtn.remove();

            // auto refresh sessions list
            setTimeout(loadSessions, 1500);

            return;
        }

        // inside grace period
        if(now >= end){

            const sec = Math.floor(remaining/1000);
            el.textContent = `Closing in ${sec}s`;

            if(badge){
                badge.classList.remove("green");
                badge.classList.add("orange");
                badge.querySelector("span").textContent = "Closing";
            }

            return;
        }

        // normal active countdown
        const min = Math.floor((end-now)/60000);
        const sec = Math.floor(((end-now)%60000)/1000);

        el.textContent = `⏱ ${min}:${sec.toString().padStart(2,'0')}`;
    });
}