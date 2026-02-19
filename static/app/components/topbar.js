import { Toast } from "../core/toast.js";
import { getCurrentUser } from "../core/auth.js";

let currentUser = null;

export function initTopbar(){

    const topbar = document.getElementById("topbar");
    if(!topbar) return;

    /* ---------- RENDER HTML ---------- */
    topbar.innerHTML = `
        <div class="topbar-left">
            <div class="page-title" id="pageName">Dashboard</div>
        </div>

        <div class="topbar-right">

            <div class="notification-bell" id="notifyBell">
                <span class="bell-icon">🔔</span>
                <span class="bell-badge hidden" id="notifyCount">0</span>
            </div>

            <div class="profile-chip">
                <div class="profile-avatar" id="avatar">
                    ?
                </div>

                <div class="profile-info">
                    <div class="profile-name" id="userName">Loading...</div>
                    <div class="profile-role" id="userRole"></div>
                </div>
            </div>

            <button id="logoutBtn" class="logout-btn">
                ⎋
            </button>

        </div>
    `;

    /* ---------- FILL USER IMMEDIATELY ---------- */
    const user = getCurrentUser();

    if(user){
        document.getElementById("userName").textContent = user.name;
        document.getElementById("userRole").textContent = user.role.toUpperCase();
    }
    const avatar = document.getElementById("avatar");
    if(user && avatar){
        avatar.textContent = user.name.charAt(0).toUpperCase();
    }

    /* ---------- LOGOUT ---------- */
    document.getElementById("logoutBtn").onclick = async ()=>{
        await fetch("/auth/logout",{credentials:"include"});
        Toast.show("Logged out","info");

        setTimeout(()=>{
            window.location.href="/auth/login?logout=1";
        },800);
    };
}


/* ---------- LISTEN FOR USER EVENT ---------- */
document.addEventListener("user-ready",(e)=>{

    currentUser = e.detail;

    const nameEl = document.getElementById("userName");
    const roleEl = document.getElementById("userRole");

    if(!nameEl || !roleEl) return;

    nameEl.textContent = currentUser.name;
    roleEl.textContent = currentUser.role.toUpperCase();
});


/* ---------- GLOBAL LOADING BAR ---------- */

let loadingBar = null;

function createLoader(){
    if(loadingBar) return;

    loadingBar = document.createElement("div");
    loadingBar.style.position="fixed";
    loadingBar.style.top="0";
    loadingBar.style.left="0";
    loadingBar.style.height="3px";
    loadingBar.style.width="0%";
    loadingBar.style.background="linear-gradient(90deg,#4f9cff,#00e1ff)";
    loadingBar.style.transition="width 0.25s ease";
    loadingBar.style.zIndex="9999";

    document.body.appendChild(loadingBar);
}

document.addEventListener("request-start",()=>{
    createLoader();
    loadingBar.style.width="60%";
});

document.addEventListener("request-end",()=>{
    if(!loadingBar) return;

    loadingBar.style.width="100%";

    setTimeout(()=>{
        loadingBar.style.width="0%";
    },300);
});
/* update page title when route changes */
function updatePageTitle(path){

    const pageName = document.getElementById("pageName");
    if(!pageName) return;

    const map = {
        "/admin":"Dashboard",
        "/admin/users":"Users",
        "/admin/departments":"Departments",
        "/admin/courses":"Courses",
        "/admin/security":"Security Logs",
        "/admin/analytics":"Analytics",
        "/faculty":"Dashboard",
        "/faculty/sessions":"Sessions",
        "/student":"Dashboard",
        "/student/face-register":"Face Registration",
        "/student/attendance":"Mark Attendance",
        "/student/courses":"My Courses",
        "/student/report":"Attendance Report",
        "/student/feedback":"Feedback"
    };

    pageName.textContent = map[path] || "Smart Presence";
}

/* SPA navigation */
document.addEventListener("route-changed",(e)=>{
    updatePageTitle(e.detail.path);
});

/* FIRST LOAD FIX */
document.addEventListener("user-ready",()=>{
    updatePageTitle(window.location.pathname);
});
