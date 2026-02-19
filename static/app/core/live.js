import { Toast } from "./toast.js";

let eventSource = null;
let notificationCount = 0;

/* remembers already displayed students */
let knownRecords = new Set();

/* ================= CONNECT LIVE SESSION ================= */

export function connectLiveSession(sessionId){

    disconnectLiveSession();
    knownRecords.clear();

    eventSource = new EventSource(`/api/faculty/session-live/${sessionId}`);

    eventSource.onmessage = async (event)=>{

        try{
            const data = JSON.parse(event.data);

            if(data.type !== "attendance_update") return;

            /* ---------- BELL + TOAST ---------- */

            notificationCount++;

            const badge = document.getElementById("notifyCount");
            if(badge){
                badge.textContent = notificationCount;
                badge.classList.remove("hidden");

                const bell = document.getElementById("notifyBell");
                if(bell) bell.classList.add("has-alert");
            }

            const latest = data.students[data.students.length-1];
            if(latest){
                Toast.show(`${latest.name} marked attendance`,"success",3500);
            }

            /* ---------- LIVE REPORT UPDATE ---------- */

            const container = document.getElementById("attendanceList");
            if(!container) return; // report not open

            // dynamically import studentCard renderer
            const module = await import("../views/faculty.sessions.js");

            data.students.forEach(student=>{

                // unique key
                const key = `${student.usn}-${student.time}`;

                if(knownRecords.has(key)) return;
                knownRecords.add(key);

                const cardHTML = module.studentCard(student);

                const wrapper = document.createElement("div");
                wrapper.innerHTML = cardHTML;
                const card = wrapper.firstElementChild;

                /* animation start */
                card.style.opacity = "0";
                card.style.transform = "translateY(-20px) scale(.96)";

                container.prepend(card);

                requestAnimationFrame(()=>{
                    card.style.transition = "all .35s cubic-bezier(.22,1,.36,1)";
                    card.style.opacity = "1";
                    card.style.transform = "translateY(0) scale(1)";
                });

                /* glow effect */
                card.classList.add("live-arrival");
                setTimeout(()=>{
                    card.classList.remove("live-arrival");
                },2500);

            });

            updatePresentCount(data.count);

        }catch(e){
            console.error("SSE parse error:",e);
        }
    };

    eventSource.onerror = ()=>{
        console.warn("Live connection lost");
    };
}

/* ================= UPDATE COUNT ================= */

function updatePresentCount(count){
    const present = document.querySelector(".stat.present span");
    if(present) present.textContent = count;
}

/* ================= DISCONNECT ================= */

export function disconnectLiveSession(){
    if(eventSource){
        eventSource.close();
        eventSource = null;
    }
    knownRecords.clear();
}

/* ================= BELL RESET ================= */

document.addEventListener("click",(e)=>{

    const bell = e.target.closest("#notifyBell");
    if(!bell) return;

    notificationCount = 0;

    const badge = document.getElementById("notifyCount");
    if(badge){
        badge.textContent = "0";
        badge.classList.add("hidden");
    }

    const b = document.getElementById("notifyBell");
    if(b) b.classList.remove("has-alert");
});

/* ================= SPA PAGE LEAVE CLEANUP ================= */

document.addEventListener("view-destroy", ()=>{
    disconnectLiveSession();
});
