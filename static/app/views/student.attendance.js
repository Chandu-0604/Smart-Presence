import { Toast } from "../core/toast.js";
import {
    loadFaceModels,
    startVideo,
    detectSingleFace,
    cropAlignedFace,
    stopStream
} from "../core/face-capture.js";
import { onViewDestroyed } from "../core/view-lifecycle.js";


let stream = null;
let sessionData = null;
let verifying = false;

/* ================= SESSION CHECK ================= */

async function checkSession(view){

    const res = await fetch("/api/student/active-session",{
        credentials:"include"
    });

    const data = await res.json();

    const info = view.querySelector("#sessionInfo");

    if(!data.success || !data.data.active){

        info.innerHTML = `
            <div class="status-badge gray">
                No Active Attendance Session
            </div>
            <small>Wait for your faculty to start attendance</small>
        `;
        return false;
    }

    sessionData = data.data;

    if(data.data.already_marked){

        info.innerHTML = `
            <div class="status-badge blue">
                Attendance Already Marked
            </div>
            <small>You have already attended this class</small>
        `;
        // immediately go back to dashboard
        setTimeout(()=>{
            window.location.href = "/student";
        },1500);

        return false;
    }

    info.innerHTML = `
            <div class="status-badge green">Active Session</div>
            <strong>${data.data.course_name}</strong>

            <div id="studentCountdown" class="student-session-timer">
                Calculating remaining time...
            </div>
        `;

        /* start countdown ONLY after DOM exists */
        setTimeout(()=>{
            startStudentCountdown(data.data.end_time, view);
        },50);
    return true;
}

/* ================= START CAMERA ================= */

async function openCamera(view){

    const video = view.querySelector("#camera");

    await loadFaceModels();

    stream = await startVideo(video);
}

/* ================= GPS FIRST ================= */

async function getLocation(){

    return new Promise((resolve,reject)=>{

        navigator.geolocation.getCurrentPosition(
            pos=>{
                resolve({
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude
                });
            },
            ()=>reject("Location permission required"),
            { enableHighAccuracy:true, timeout:10000 }
        );
    });
}

/* ================= CAPTURE & MARK ================= */

async function markAttendance(view){

    if(verifying) return;
    verifying = true;

    const btn = view.querySelector("#captureBtn");
    btn.disabled = true;
    btn.innerText = "Verifying...";

    try{

        if(!sessionData){
            throw "Session expired";
        }

        Toast.show("Getting location...","info");

        const location = await getLocation();

        const video = view.querySelector("#camera");

        Toast.show("Align your face...","info");

        const detection = await detectSingleFace(video);
        if(!detection.ok){
            throw detection.reason;
        }

        const blob = await cropAlignedFace(video, detection.face);
        if(!blob){
            throw "Camera capture failed";
        }

        Toast.show("Verifying face...","info");

        const form = new FormData();
        form.append("image",blob,"face.jpg");
        form.append("session_id",sessionData.session_id);
        form.append("attendance_token",sessionData.attendance_token);
        form.append("latitude",location.lat);
        form.append("longitude",location.lon);

        const res = await fetch("/api/student/mark-attendance",{
            method:"POST",
            body:form,
            credentials:"include",
            headers:{
                "X-CSRFToken": window.CSRF_TOKEN
            }
        });

        const data = await res.json();

        if(!data.success){
            throw data.error || "Verification failed";
        }

        Toast.show("Attendance Marked Successfully","success");

        if(stream){
            stream.getTracks().forEach(t=>t.stop());
            stream = null;
        }

        view.innerHTML = `
            <div class="card success-card">
                <h2>Attendance Recorded</h2>
                <p>You may close this page.</p>
                <a href="/student" class="btn btn-primary">
                    Back to Dashboard
                </a>
            </div>
        `;

    }catch(err){

        Toast.show(err,"error");

        btn.disabled = false;
        btn.innerText = "Verify & Mark Attendance";

        verifying = false;
    }
}

/* ================= PAGE ================= */

export async function studentAttendance(view){

    // hard safety stop
    if(stream){
        stopStream(stream);
        stream = null;
    }

    view.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">Mark Attendance</h1>
        </div>

        <div class="card">
            <div id="sessionInfo">Checking session...</div>
        </div>
    `;

    const ok = await checkSession(view);

    // 🚨 IMPORTANT: do nothing if session not active
    if(!ok){
        return;
    }

    /* ---------- NOW create camera UI ---------- */

    const camCard = document.createElement("div");
    camCard.className = "card";
    camCard.innerHTML = `
        <video id="camera" autoplay playsinline></video>
        <button id="captureBtn" class="btn btn-primary">
            Verify & Mark Attendance
        </button>
    `;

    view.prepend(camCard);

    await openCamera(view);

    /* ---------- PAGE CLEANUP ---------- */

    document.addEventListener("view-destroy", ()=>{
        if(stream){
            stopStream(stream);
            stream = null;
        }

        if(countdownInterval){
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        verifying = false;
        sessionData = null;

    }, { once:true });

    /* ---------- TAB SWITCH CLEANUP ---------- */

    document.addEventListener("visibilitychange", ()=>{
        if(document.hidden && stream){
            stopStream(stream);
            stream = null;
        }
    });

    view.querySelector("#captureBtn").onclick = ()=>{
        markAttendance(view);
    };
}

/* ================= STUDENT COUNTDOWN ================= */

let countdownInterval = null;

function startStudentCountdown(endTime, view){

    const end = new Date(endTime).getTime();
    const label = view.querySelector("#studentCountdown");
    const btn = view.querySelector("#captureBtn");

    if(countdownInterval){
        clearInterval(countdownInterval);
    }

    countdownInterval = setInterval(()=>{

        const remaining = end - Date.now();

        if(remaining <= 0){

            clearInterval(countdownInterval);

            if(label){
                label.innerHTML = `
                    <span style="color:#ef4444;font-weight:600">
                        Attendance Session Closed
                    </span>
                `;
            }

            // disable capture
            if(btn){
                btn.disabled = true;
                btn.innerText = "Session Closed";
            }

            // stop camera
            if(stream){
                stream.getTracks().forEach(t=>t.stop());
                stream = null;
            }

            Toast.show("Attendance session closed","info",4000);
            return;
        }

        const min = Math.floor(remaining/60000);
        const sec = Math.floor((remaining%60000)/1000);

        if(label){
            label.textContent = `⏳ Attendance closes in ${min}:${sec.toString().padStart(2,'0')}`;
        }

    },1000);
}