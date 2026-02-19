import { api } from "../services/api.js";
import { Toast } from "../core/toast.js";

let selectedRating = 0;
let submitting = false;

export async function studentFeedback(view){

    view.innerHTML = `
        <div class="page-container">

            <h1 class="page-title">Feedback Center</h1>

            <!-- ===== SUMMARY CARDS ===== -->
            <div class="feedback-stats">
                <div class="stat-card">
                    <div class="stat-title">Total Feedback Submitted</div>
                    <div id="statTotal" class="stat-value">0</div>
                </div>

                <div class="stat-card">
                    <div class="stat-title">Average Rating</div>
                    <div id="statAverage" class="stat-value">0 ⭐</div>
                </div>

                <div class="stat-card">
                    <div class="stat-title">Pending Feedback</div>
                    <div id="statPending" class="stat-value">0</div>
                </div>
            </div>

            <!-- ===== FORM ===== -->
            <div class="card feedback-card">
                <h3 class="section-title">Submit Class Feedback</h3>

                <div class="form-group">
                    <label>Attended Class</label>
                    <select id="sessionSelect" class="form-input"></select>
                </div>

                <div class="form-group">
                    <label>Rating</label>
                    <div id="ratingStars" class="rating-stars">
                        ${[1,2,3,4,5].map(n =>
                            `<span class="star" data-value="${n}">★</span>`
                        ).join("")}
                    </div>
                </div>

                <div class="form-group">
                    <label>Your Feedback</label>
                    <textarea id="feedbackText" class="form-input" rows="4"></textarea>
                </div>

                <button id="submitBtn" class="btn btn-primary">
                    Submit Feedback
                </button>
            </div>

            <!-- ===== RECENT FEEDBACK ===== -->
            <div class="card recent-feedback">
                <h3 class="section-title">Recent Feedback</h3>
                <div id="feedbackHistory"></div>
            </div>

        </div>
    `;
    // load data AFTER DOM exists
    await loadSessions();
    await loadHistory();
    await loadFeedbackStats();
    setupStars();

    document.getElementById("submitBtn").onclick = submitFeedback;
}

async function loadSessions(){

    const res = await api("/api/student/feedback-sessions");
    if(!res?.success) return;

    const select = document.getElementById("sessionSelect");

    select.innerHTML = res.data.map(s =>
        `<option value="${s.session_id}" data-course="${s.course_id}">
            ${s.course} • ${new Date(s.date).toLocaleString()}
        </option>`
    ).join("");
}

function setupStars(){

    document.querySelectorAll(".star").forEach(star=>{
        star.onclick = ()=>{
            selectedRating = star.dataset.value;
            updateStars();
        };
    });
}

function updateStars(){
    document.querySelectorAll(".star").forEach(star=>{
        star.classList.toggle(
            "active",
            star.dataset.value <= selectedRating
        );
    });
}

async function submitFeedback(){

    if(submitting) return;
    submitting = true;

    const select = document.getElementById("sessionSelect");
    const session_id = select.value;
    const course_id = select.selectedOptions[0].dataset.course;
    const message = document.getElementById("feedbackText").value.trim();

    if(!session_id || !course_id){
        Toast.show("Please select an attended class","error");
        submitting=false;
        btn.disabled=false;
        btn.innerText="Submit Feedback";
        return;
    }

    if(!selectedRating){
        Toast.show("Please select rating","error");
        submitting=false;
        return;
    }

    if(!message){
        Toast.show("Please write feedback","error");
        submitting=false;
        return;
    }
    
    const btn = document.getElementById("submitBtn");
    btn.disabled = true;
    btn.innerText = "Submitting...";

    try{

        const res = await api("/api/student/submit-feedback",{
            method:"POST",
            body: JSON.stringify({
                course_id,
                session_id,
                rating: selectedRating,
                message
            })
        });

        if(!res || !res.success){
            throw new Error(res?.error || "Submission failed");
        }

        Toast.show("Feedback submitted","success");

        /* authoritative refresh */
        await loadHistory();

        /* reset */
        document.getElementById("feedbackText").value="";
        selectedRating=0;
        updateStars();

    }catch(err){
        Toast.show(err.message,"error");
    }

    btn.disabled=false;
    btn.innerText="Submit Feedback";
    submitting=false;
}

async function loadHistory(){

    const res = await api("/api/student/feedback-history");
    if(!res?.success) return;
    const total = res.data.length;
    document.getElementById("statTotal").innerText = total;

    if(total){
        const avg = (
            res.data.reduce((a,b)=>a+b.rating,0)/total
        ).toFixed(2);
        document.getElementById("statAvg").innerText = avg + " ★";
    }else{
        document.getElementById("statAvg").innerText = "0";
    }

    const container = document.getElementById("feedbackHistory");
    container.replaceChildren();

    if(!res.data || res.data.length === 0){
        container.innerHTML = `
            <div class="empty-state">
                No feedback submitted yet
            </div>
        `;
        return;
    }
    document.getElementById("statPending").innerText = res.data.length;
    res.data.slice(0,5).forEach(addFeedbackToHistory);
}

function addFeedbackToHistory(f){

    const container = document.getElementById("feedbackHistory");
    if(!container) return;

    const submittedDate = new Date(f.submitted);
    const classDate = f.session_time ? new Date(f.session_time) : null;

    const submittedStr = submittedDate.toLocaleString("en-IN",{
        day:"2-digit",
        month:"short",
        hour:"2-digit",
        minute:"2-digit"
    });

    const classStr = classDate
        ? classDate.toLocaleString("en-IN",{
            day:"2-digit",
            month:"short",
            hour:"2-digit",
            minute:"2-digit"
        })
        : "Session unavailable";

    /* stars */
    let starsHTML="";
    for(let i=1;i<=5;i++){
        starsHTML+=`<span class="${i<=f.rating?'star-filled':'star-empty'}">★</span>`;
    }

    const card=document.createElement("div");
    card.className="feedback-item";

    card.innerHTML=`
        <div class="feedback-left">
            <div class="feedback-course">${f.course}</div>
            <div class="feedback-message">${f.message}</div>
            <div class="feedback-meta">
                <span>📚 ${classStr}</span>
                <span>🕓 ${submittedStr}</span>
            </div>
        </div>

        <div class="feedback-right">
            <div class="feedback-rating">${starsHTML}</div>
        </div>
    `;

    container.appendChild(card);
}
async function loadFeedbackStats(){

    const res = await api("/api/student/feedback-stats");
    if(!res?.success) return;

    document.getElementById("statTotal").innerText =
        res.data.total_feedback;

    document.getElementById("statAverage").innerText =
        res.data.average_rating + " ⭐";

    document.getElementById("statPending").innerText =
        res.data.pending_feedback;
}
