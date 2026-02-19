import { Router } from "./router.js";
import { initSidebar } from "../components/sidebar.js";
import { initTopbar } from "../components/topbar.js";
import { fetchSession } from "./auth.js";

import { adminDashboard } from "../views/admin.dashboard.js";
import { adminUsers } from "../views/admin.users.js";
import { adminDepartments } from "../views/admin.departments.js";
import { adminCourses } from "../views/admin.courses.js";
import { adminSecurity } from "../views/admin.security.js";
import { adminAnalytics } from "../views/admin.analytics.js";
import { facultyDashboard } from "../views/faculty.dashboard.js";
import { facultySessions } from "../views/faculty.sessions.js";
import { studentDashboard } from "../views/student.dashboard.js";
import { studentFaceRegister } from "../views/student.face-register.js";
import { studentAttendance } from "../views/student.attendance.js";
import { studentCourses } from "../views/student.courses.js";
import { studentReport } from "../views/student.report.js";
import { studentFeedback } from "../views/student.feedback.js";

// Restore login toast after redirect
const pendingToast = sessionStorage.getItem("postLoginToast");
if(pendingToast){
    sessionStorage.removeItem("postLoginToast");

    setTimeout(()=>{
        import("./toast.js").then(({Toast})=>{
            Toast.show(pendingToast,"success",4000);
        });
    },500);
}

async function loadCSRF(){

    try{
        const res = await fetch("/api/security/csrf-token",{
            credentials:"include"
        });

        if(!res.ok) throw new Error();

        const data = await res.json();

        if(data.success && data.csrf_token){
            sessionStorage.setItem("csrf_token", data.csrf_token);
        }else{
            console.error("CSRF token not received");
        }

    }catch(e){
        console.error("Failed to load CSRF token");
    }
}

/* =========================================================
   APPLICATION BOOTLOADER
   The UI will NOT start until authentication is confirmed
   ========================================================= */

window.addEventListener("DOMContentLoaded", async ()=>{
    

    // 1️⃣ Verify login FIRST
    const user = await fetchSession();

    if(!user){
        window.location.href="/auth/login?expired=1";
        return;
    }

    /* 🔐 VERY IMPORTANT — establish CSRF session */
    await loadCSRF();

    /* now UI can safely start */
    startApplication(user);

});
/* =========================================================
   Start SPA AFTER authentication
   ========================================================= */

function startApplication(user){

    // Tell components who the user is
    document.dispatchEvent(
        new CustomEvent("user-ready",{detail:user})
    );

    // Layout
    initSidebar();
    initTopbar();

    // Router (actual SPA pages)
    Router.init({

    /* ADMIN */
    "/admin": adminDashboard,
    "/admin/users": adminUsers,
    "/admin/departments": adminDepartments,
    "/admin/courses": adminCourses,
    "/admin/security": adminSecurity,
    "/admin/analytics": adminAnalytics,

    /* Faculty*/
    "/faculty": facultyDashboard,
    "/faculty/sessions": facultySessions,

    /* STUDENT */
    "/student": studentDashboard,
    "/student/face-register": studentFaceRegister,
    "/student/attendance": studentAttendance,
    "/student/courses": studentCourses,
    "/student/report": studentReport,
    "/student/feedback": studentFeedback,
});
}
