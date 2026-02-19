let modelsLoaded = false;
let activeVideo = null;

/* GLOBAL STREAM REGISTRY (CRITICAL) */
if(!window.__activeStreams){
    window.__activeStreams = new Set();
}

window.stopAllStreams = function(){
    window.__activeStreams.forEach(stream=>{
        try{
            stream.getTracks().forEach(t=>t.stop());
        }catch(e){}
    });
    window.__activeStreams.clear();
};

/* ---------------- LOAD MODELS ---------------- */

export async function loadFaceModels(){

    if(modelsLoaded) return;

    const MODEL_URL = "/static/third_party/faceapi/models";

    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);

    modelsLoaded = true;
}

/* ---------------- START CAMERA ---------------- */

export async function startVideo(video){

    // kill any previous stream FIRST
    if(window.stopAllStreams){
        window.stopAllStreams();
    }

    const stream = await navigator.mediaDevices.getUserMedia({
        video:{
            facingMode:"user",
            width:{ideal:640},
            height:{ideal:480}
        },
        audio:false
    });

    video.srcObject = stream;
    await video.play();

    /* register stream globally */
    window.__activeStreams.add(stream);

    video._stream = stream;
    activeVideo = video;

    return stream;
}

/* ---------------- DETECT FACE ---------------- */

export async function detectSingleFace(video){

    if(!video || video.readyState !== 4){
        return { ok:false, reason:"Initializing camera..." };
    }

    const detection = await faceapi
        .detectAllFaces(
            video,
            new faceapi.TinyFaceDetectorOptions({
                inputSize: 416,
                scoreThreshold: 0.5
            })
        )
        .withFaceLandmarks();

    if(!detection || detection.length === 0){
        return { ok:false, reason:"No face detected" };
    }

    if(detection.length > 1){
        return { ok:false, reason:"Multiple faces detected" };
    }

    const face = detection[0];
    const box = face.detection.box;

    /* ---------- SIZE CHECK ---------- */

    if(box.width < 150 || box.height < 150){
        return { ok:false, reason:"Move closer to the camera" };
    }

    /* ---------- CENTER CHECK ---------- */

    const centerX = box.x + box.width/2;
    const videoCenter = video.videoWidth/2;

    if(Math.abs(centerX - videoCenter) > video.videoWidth * 0.20){
        return { ok:false, reason:"Center your face" };
    }

    return { ok:true, face };
}

/* ---------------- CROP FACE ---------------- */

export function cropAlignedFace(video, face){

    const box = face.detection.box;
    const padding = 0.35;

    const x = Math.max(0, box.x - box.width * padding);
    const y = Math.max(0, box.y - box.height * padding);
    const w = Math.min(video.videoWidth - x, box.width * (1 + padding*2));
    const h = Math.min(video.videoHeight - y, box.height * (1 + padding*2));

    const canvas = document.createElement("canvas");
    canvas.width = 224;
    canvas.height = 224;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(
        video,
        x, y, w, h,
        0, 0, 224, 224
    );

    return new Promise(resolve=>{
        canvas.toBlob(blob=>{
            resolve(blob);
        },"image/jpeg",0.92);
    });
}

/* ---------------- STOP CAMERA (CRITICAL FIX) ---------------- */

export async function stopStream(stream, videoElement=null){

    try{

        if(stream){
            stream.getTracks().forEach(track=>{
                try{ track.stop(); }catch{}
            });

            window.__activeStreams.delete(stream);
        }

        const video = videoElement || activeVideo;

        if(video){
            try{ video.pause(); }catch{}
            try{ video.srcObject = null; }catch{}
            try{ video.removeAttribute("src"); }catch{}
            try{ video.load(); }catch{}
        }

    }catch(e){
        console.warn("Stream cleanup warning:",e);
    }

    activeVideo = null;
}

/* HARD SAFETY — tab switch / reload / crash */
window.addEventListener("beforeunload", ()=>{
    if(window.stopAllStreams){
        window.stopAllStreams();
    }
});

document.addEventListener("visibilitychange", ()=>{
    if(document.hidden && window.stopAllStreams){
        window.stopAllStreams();
    }
});

/* global kill switch used by router */
window.stopAllStreams = async function(){
    try{
        if(activeVideo && activeVideo._stream){
            activeVideo._stream.getTracks().forEach(t=>t.stop());
        }
        activeVideo = null;
    }catch(e){}
};
