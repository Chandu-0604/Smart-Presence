import { Toast } from "../core/toast.js";
import {
    loadFaceModels,
    startVideo,
    detectSingleFace,
    cropAlignedFace,
    stopStream
} from "../core/face-capture.js";

let stream = null;
let cameraActive = false;
let frameRequest = null;
let destroyed = false;
let captures = [];
let faceDetector = null;
let faceValid = false;

/* ================= CAMERA ================= */

async function startCamera(view){
    const pageId = window.__ACTIVE_VIEW_ID;

    destroyed = false;
    cameraActive = true;

    const video = view.querySelector("#regCamera");
    if(!video) return;

    try{

        await loadFaceModels();
        stream = await startVideo(video);

        const guideLoop = async ()=>{

            /* page changed → instantly die */
            if(pageId !== window.__ACTIVE_VIEW_ID){
                await stopCamera(video);
                return;
            }

            if(destroyed || !cameraActive || !document.body.contains(view)){
                await stopCamera(video);
                return;
            }

            try{

                const result = await detectSingleFace(video);

                /* check again AFTER await (very important) */
                if(pageId !== window.__ACTIVE_VIEW_ID){
                    await stopCamera(video);
                    return;
                }

                if(result.ok){
                    showGuide(view,"Perfect ✔ — Capture now");
                    faceValid = true;
                }else{
                    showGuide(view,result.reason);
                    faceValid = false;
                }

            }catch(e){
                return;
            }

            frameRequest = requestAnimationFrame(guideLoop);
        };

        frameRequest = requestAnimationFrame(guideLoop);

    }catch(e){
        console.error("Camera error:",e);
        Toast.show("Camera initialization failed","error");
    }
}

function showGuide(view, msg){

    if(!view) return;

    /* page already replaced */
    if(!document.body.contains(view)) return;

    /* page lifecycle changed */
    if(!window.__ACTIVE_VIEW_ID) return;

    const container = view.querySelector(".card");
    if(!container) return;

    let g = view.querySelector("#faceGuide");

    if(!g){
        g = document.createElement("div");
        g.id = "faceGuide";
        g.className = "face-guide";
        container.appendChild(g);
    }

    g.innerText = msg;
}

async function stopCamera(video){

    destroyed = true;
    cameraActive = false;

    if(frameRequest){
        cancelAnimationFrame(frameRequest);
        frameRequest = null;
    }

    if(stream){
        await stopStream(stream, video);
        stream = null;
    }

    const guide = document.getElementById("faceGuide");
    if(guide) guide.remove();
}

/* ================= CAPTURE ================= */

async function captureImage(view){

    if(!faceValid){
        Toast.show("Align your face properly first","error");
        return;
    }

    const video = view.querySelector("#regCamera");

    // detect again to get landmarks
    const detection = await detectSingleFace(video);

    if(!detection.ok){
        Toast.show(detection.reason,"error");
        return;
    }

    // crop aligned face
    const blob = await cropAlignedFace(video, detection.face);

    if(!blob){
        Toast.show("Capture failed","error");
        return;
    }

    captures.push(blob);
    renderPreview(view);

    if(captures.length === 3){
        view.querySelector("#uploadBtn").disabled = false;
        Toast.show("Great! Now submit registration","success");
    }
}


/* ================= PREVIEW ================= */

function renderPreview(view){

    const box = view.querySelector("#previewBox");
    box.innerHTML = "";

    captures.forEach((blob,i)=>{
        const img = document.createElement("img");
        img.src = URL.createObjectURL(blob);
        img.className = "preview-thumb";
        box.appendChild(img);
    });

    view.querySelector("#captureCount").innerText = captures.length;
}

/* ================= RESET ================= */

function resetCaptures(view){
    captures = [];
    renderPreview(view);
    view.querySelector("#uploadBtn").disabled = true;
}

/* ================= UPLOAD ================= */

async function uploadFaces(view){

    if(captures.length < 3){
        Toast.show("Capture 3 samples first","error");
        return;
    }

    Toast.show("Registering face... please wait","info");

    const form = new FormData();

    captures.forEach((blob,i)=>{
        form.append("images",blob,`face${i}.jpg`);
    });

    const res = await fetch("/api/student/register-face",{
        method:"POST",
        body:form,
        credentials:"include",
        headers: new Headers({
            "X-CSRFToken": window.CSRF_TOKEN
        })
    });

    const data = await res.json();

    if(data.success){

        Toast.show("Face Registered Successfully!","success");

        await stopCamera(view.querySelector("#regCamera"));

        view.innerHTML = `
            <div class="card success-card">
                <h2>Registration Complete</h2>
                <p>You can now mark attendance.</p>
                <a href="/student/attendance" class="btn btn-primary">
                    Go to Attendance
                </a>
            </div>
        `;

    }else{
        Toast.show(data.error || "Registration failed","error");
    }
}

/* ================= MAIN PAGE ================= */

export async function studentFaceRegister(view){

    view.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">Face Registration</h1>
        </div>

        <div class="card">
            <p>Capture 3 clear face samples.</p>

            <video id="regCamera" autoplay playsinline class="reg-camera"></video>

            <div class="reg-actions">
                <button id="captureBtn" class="btn btn-primary">
                    Capture Sample (<span id="captureCount">0</span>/3)
                </button>

                <button id="resetBtn" class="btn btn-secondary">
                    Reset
                </button>
            </div>

            <div id="previewBox" class="preview-box"></div>

            <button id="uploadBtn" class="btn btn-success" disabled>
                Submit Registration
            </button>
        </div>
    `;

    await startCamera(view);

    view.querySelector("#captureBtn").onclick = ()=>captureImage(view);
    view.querySelector("#resetBtn").onclick = ()=>resetCaptures(view);
    view.querySelector("#uploadBtn").onclick = ()=>uploadFaces(view);

    // stop camera if user navigates away
    const observer = new MutationObserver(()=>{
        if(!document.body.contains(view)){
            stopCamera(view.querySelector("#regCamera"));
            observer.disconnect();
        }
    });

    observer.observe(document.body,{childList:true,subtree:true});
}
