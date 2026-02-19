let currentUser = null;

/* receive user from bootloader */
document.addEventListener("user-ready", (e)=>{
    currentUser = e.detail;
    renderSidebar();
});

export function initSidebar(){
    // nothing here anymore
}

/* build menu based on role */
function renderSidebar(){

    const sidebar = document.getElementById("sidebar");
    if(!sidebar || !currentUser) return;

    let links = [];

    if(currentUser.role === "admin"){
        links = [
            {name:"Dashboard", path:"/admin"},
            {name:"Users", path:"/admin/users"},
            {name:"Departments", path:"/admin/departments"},
            {name:"Courses", path:"/admin/courses"},
            {name:"Security Logs", path:"/admin/security"},
            {name:"Analytics", path:"/admin/analytics"}
        ];
    }
    else if(currentUser.role === "faculty"){
        links = [
            {name:"Dashboard", path:"/faculty"},
            {name:"Sessions", path:"/faculty/sessions"}
        ];
    }
    else{
        links = [
            {name:"Dashboard", path:"/student"},
            {name:"Face Registration", path:"/student/face-register"},
            {name:"Mark Attendance", path:"/student/attendance"},
            {name:"My Courses", path:"/student/courses"},
            {name:"Attendance Report", path:"/student/report"},
            {name:"Feedback", path:"/student/feedback"},
        ];
    }

    sidebar.innerHTML = `
        <div class="sidebar-header">
            <div class="brand">Smart Presence</div>
            <div class="role-badge ${currentUser.role}">
                ${currentUser.role.toUpperCase()}
            </div>
        </div>

        <nav class="nav">
            ${links.map(l=>`
                <a class="nav-item ${window.location.pathname === l.path ? "active" : ""}" 
                href="${l.path}" 
                data-link>
                <span class="nav-text">${l.name}</span>
                </a>
            `).join("")}
        </nav>
    `;
}
/* update active link when SPA route changes */
document.addEventListener("route-changed",(e)=>{

    const path = e.detail.path;

    document.querySelectorAll(".nav-item").forEach(link=>{
        if(link.getAttribute("href") === path){
            link.classList.add("active");
        }else{
            link.classList.remove("active");
        }
    });

});
