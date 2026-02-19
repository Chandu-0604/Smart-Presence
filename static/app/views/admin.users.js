import { api } from "../services/api.js";
import { Toast } from "../core/toast.js";
import { Modal } from "../core/modal.js";
let currentRoleFilter = "all";
let showAcademic = false;
/* ================= PAGE ================= */

export async function adminUsers(view){
    showAcademic = (filters.role === "student" || filters.role === "all");
    view.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">User Management</h1>

            <div class="user-filters">

            <div class="filter-group">
                <label>Role</label>
                <select id="roleFilter" class="filter-select">
                    <option value="all">All Users</option>
                    <option value="admin">Admin</option>
                    <option value="faculty">Faculty</option>
                    <option value="student">Students</option>
                </select>
            </div>

            <div class="filter-group">
                <label>Department</label>
                <select id="deptFilter" class="filter-select">
                    <option value="all">All Departments</option>
                </select>
            </div>

            <div class="filter-group academic-only">
                <label>Year</label>
                <select id="yearFilter" class="filter-select">
                    <option value="all">All Years</option>
                    <option value="1">1st</option>
                    <option value="2">2nd</option>
                    <option value="3">3rd</option>
                    <option value="4">4th</option>
                </select>
            </div>

            <div class="filter-group academic-only">
                <label>Semester</label>
                <select id="semFilter" class="filter-select">
                    <option value="all">All Semesters</option>
                    ${[1,2,3,4,5,6,7,8].map(s=>`<option value="${s}">${s}</option>`).join("")}
                </select>
            </div>

        </div>

            <button id="createFacultyBtn" class="btn btn-primary">
                + Create Faculty
            </button>
        </div>

        <div class="card">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th data-academic>Academic</th>
                    <th>Courses</th>
                    <th>Status</th>
                    <th style="width:260px;">Actions</th>
                </tr>
            </thead>
            <tbody id="usersBody">
                <tr><td colspan="7">Loading users...</td></tr>
            </tbody>
        </table>
    </div>
    `;

    document.getElementById("createFacultyBtn").onclick = openCreateFacultyModal;

    await loadUsers();
    await loadDepartmentFilter();
    attachFilterListeners();
    updateCreateButton();
    updateAcademicVisibility();
}

async function loadDepartmentFilter(){

    const res = await api("/api/admin/departments");
    if(!res?.success) return;

    const select = document.getElementById("deptFilter");

    res.data.forEach(d=>{
        const opt = document.createElement("option");
        opt.value = d.name;
        opt.textContent = d.name;
        select.appendChild(opt);
    });
}

function renderAcademic(user){

    if(user.role !== "student") return "";

    const a = user.academic || {};

    return `
        <div class="academic-block">
            <div class="acad-top">
                <span class="acad-badge">Year ${a.year || "-"}</span>
                <span class="acad-badge sem">Sem ${a.semester || "-"}</span>
            </div>

            <div class="acad-bottom">
                <span class="acad-section">Section ${a.section || "-"}</span>
                <span class="acad-usn">${a.usn || ""}</span>
            </div>
        </div>
    `;
}
/* ================= LOAD USERS ================= */

async function loadUsers(){

    const res = await api("/api/admin/users");
    if(!res || !res.success) return;

    const tbody = document.getElementById("usersBody");
    tbody.innerHTML = "";

    res.data
    .filter(u => {  

        if(filters.role !== "all" && u.role !== filters.role)
            return false;

        if(filters.department !== "all" && u.department !== filters.department)
            return false;

        if(filters.role === "student" && u.role === "student"){

            if(filters.year !== "all" && String(u.academic?.year) !== filters.year)
                return false;

            if(filters.semester !== "all" && String(u.academic?.semester) !== filters.semester)
                return false;
        }

        return true;
    })
    .forEach(user=>{

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>
                <div class="user-primary">
                    <div class="user-avatar">${user.name[0]}</div>
                    <div>
                        <div class="user-name">${user.name}</div>
                        <div class="user-email">${user.email}</div>
                    </div>
                </div>
            </td>

            <td>
                <span class="role ${user.role}">${user.role}</span>
            </td>

            <td>${user.department || "-"}</td>

            <td data-academic>
                ${renderAcademic(user)}
            </td>

            <td><strong>${user.course_count}</strong></td>

            <td>
                <span class="status ${user.is_enabled ? "active":"disabled"}">
                    ${user.is_enabled ? "Active":"Disabled"}
                </span>
            </td>

            <td class="actions">
                ${
                    user.role === "faculty"
                    ? `<button class="btn-small primary deptBtn" data-id="${user.id}">Change Dept</button>`
                    : ""
                }

                ${
                    user.role === "student"
                    ? `
                    <button class="btn-small primary acadBtn" data-id="${user.id}">Academic</button>
                    <button class="btn-small secondary stuDeptBtn" data-id="${user.id}">Dept</button>
                    `
                    : ""
                }

                ${
                    user.role !== "admin"
                    ? `
                    <button class="btn-small ${user.is_enabled ? "warn":"success"}"
                        data-action="toggle" data-id="${user.id}" data-enabled="${user.is_enabled}">
                        ${user.is_enabled ? "Disable":"Enable"}
                    </button>

                    <button class="btn-small danger"
                        data-action="delete" data-id="${user.id}">
                        Delete
                    </button>`
                    : `<span class="protected">Protected</span>`
                }
            </td>
        `;

        tbody.appendChild(tr);
    });

    attachActions();
}

function updateAcademicVisibility(){

    const academicHeader = document.querySelector("th[data-academic]");
    const academicCells = document.querySelectorAll("td[data-academic]");

    const visible = (filters.role === "student" || filters.role === "all");

    if(academicHeader){
        academicHeader.style.display = visible ? "" : "none";
    }

    academicCells.forEach(td=>{
        td.style.display = visible ? "" : "none";
    });

    // also toggle year/sem filters
    document.querySelectorAll(".academic-only")
    .forEach(el=>{
        el.style.display = filters.role === "student" ? "block":"none";
    });
}

/* ================= ACTION BUTTONS ================= */

function attachActions(){

    // Enable / Disable
    document.querySelectorAll("[data-action='toggle']").forEach(btn=>{
        btn.onclick = async ()=>{

            const id = btn.dataset.id;
            const enabled = btn.dataset.enabled === "true";

            const endpoint = enabled
                ? `/api/admin/disable-user/${id}`
                : `/api/admin/enable-user/${id}`;

            const res = await api(endpoint,{method:"POST"});

            if(res?.success){
                Toast.show("User updated","success");
                loadUsers();
            }
        };
    });

    // Delete
    document.querySelectorAll("[data-action='delete']").forEach(btn=>{
        btn.onclick = ()=>{
            const id = btn.dataset.id;

            Modal.confirm("Delete this user permanently?", async ()=>{
                const res = await api(`/api/admin/delete-user/${id}`,{
                    method:"DELETE"
                });

                if(res?.success){
                    Toast.show("User deleted","success");
                    loadUsers();
                }
            });
        };
    });
}

/* ================= CREATE FACULTY MODAL ================= */

function openCreateFacultyModal(){

    Modal.show(`
        <h2>Create Faculty Account</h2>

        <div class="form-group">
            <label>Name</label>
            <input id="facName" class="form-input" type="text">
        </div>

        <div class="form-group">
            <label>Email</label>
            <input id="facEmail" class="form-input" type="email">
        </div>

        <div class="form-group">
            <label>Password</label>
            <div class="password-wrapper">
                <input type="password" id="facultyPassword" class="form-input">
                <button type="button" id="toggleFacultyPassword" class="toggle-password">👁</button>
            </div>
        </div>

        <div class="modal-actions">
            <button id="createFacultySubmit" class="btn btn-primary">
                Create Faculty
            </button>
        </div>
    `);

    /* WAIT UNTIL MODAL EXISTS */
    setTimeout(()=>{

        // attach submit
        document.getElementById("createFacultySubmit").onclick = createFaculty;

        // password toggle
        const toggle = document.getElementById("toggleFacultyPassword");
        const input = document.getElementById("facultyPassword");

        toggle.onclick = ()=>{
            const hidden = input.type === "password";
            input.type = hidden ? "text":"password";
            toggle.textContent = hidden ? "🙈":"👁";
        };

    },50);
}

/* ================= CREATE FACULTY ================= */

async function createFaculty(){

    const nameEl = document.getElementById("facName");
    const emailEl = document.getElementById("facEmail");
    const passEl = document.getElementById("facultyPassword");

    if(!nameEl || !emailEl || !passEl){
        Toast.show("Form failed to load. Reopen modal.","error");
        return;
    }

    const name = nameEl.value.trim();
    const email = emailEl.value.trim();
    const password = passEl.value.trim();

    if(!name || !email || !password){
        Toast.show("All fields are required","error");
        return;
    }

    const res = await api("/api/admin/create-faculty",{
        method:"POST",
        body: JSON.stringify({name,email,password})
    });

    if(!res){
        Toast.show("Server unreachable","error");
        return;
    }

    if(!res.success){
        Toast.show(res.error || "Failed to create faculty","error");
        return;
    }

    Toast.show("Faculty account created successfully","success");

    Modal.close();
    loadUsers();
}
document.addEventListener("click", async (e)=>{

    if(e.target.classList.contains("deptBtn")){

        const id = e.target.dataset.id;

        const deptRes = await api("/api/admin/departments");
        if(!deptRes?.success) return;

        const options = deptRes.data.map(d =>
            `<option value="${d.id}">${d.name}</option>`
        ).join("");

        Modal.show(`
            <h2>Assign Faculty Department</h2>

            <select id="newDept" class="form-input">
                ${options}
            </select>

            <div class="modal-actions">
                <button id="saveDept" class="btn btn-primary">Update</button>
            </div>
        `);

        document.getElementById("saveDept").onclick = async ()=>{

            const department_id = document.getElementById("newDept").value;

            const res = await api(`/api/admin/update-faculty-department/${id}`,{
                method:"PUT",
                body:JSON.stringify({department_id})
            });

            if(res?.success){
                Toast.show("Department updated","success");
                Modal.close();
            }
        };
    }
});

document.addEventListener("click", async (e)=>{

    if(e.target.classList.contains("acadBtn")){

        const id = e.target.dataset.id;

        Modal.show(`
            <h2>Student Academic Details</h2>

            <div class="form-group">
                <label>USN / Roll No</label>
                <input id="usn" class="form-input">
            </div>

            <div class="form-group">
                <label>Year</label>
                <select id="year" class="form-input">
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                </select>
            </div>

            <div class="form-group">
                <label>Semester</label>
                <select id="semester" class="form-input">
                    ${[1,2,3,4,5,6,7,8].map(s=>`<option value="${s}">${s}</option>`).join("")}
                </select>
            </div>

            <div class="form-group">
                <label>Section</label>
                <input id="section" class="form-input">
            </div>

            <div class="modal-actions">
                <button id="saveAcademic" class="btn btn-primary">Save</button>
            </div>
        `);

        document.getElementById("saveAcademic").onclick = async ()=>{

            const data = {
                usn: document.getElementById("usn").value,
                year: document.getElementById("year").value,
                semester: document.getElementById("semester").value,
                section: document.getElementById("section").value
            };

            const res = await api(`/api/admin/update-student-academic/${id}`,{
                method:"PUT",
                body:JSON.stringify(data)
            });

            if(res?.success){
                Toast.show("Academic details updated","success");
                Modal.close();
                loadUsers();
            }
        };
    }
});
document.addEventListener("click",(e)=>{

    if(e.target.classList.contains("tab")){

        document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
        e.target.classList.add("active");

        currentRoleFilter = e.target.dataset.role;
        loadUsers();
    }
});

let filters = {
    role: "all",
    department: "all",
    year: "all",
    semester: "all"
};

function attachFilterListeners(){

    document.getElementById("roleFilter").onchange = (e)=>{

        filters.role = e.target.value;

        // RESET dependent filters
        filters.department = "all";
        filters.year = "all";
        filters.semester = "all";

        // Reset UI dropdowns
        document.getElementById("deptFilter").value = "all";
        document.getElementById("yearFilter").value = "all";
        document.getElementById("semFilter").value = "all";

        // show/hide academic filters
        document.querySelectorAll(".academic-only")
        .forEach(el=>{
            el.style.display = filters.role === "student" ? "block":"none";
        });
        updateCreateButton();
        updateAcademicVisibility();
        loadUsers();
};

    document.getElementById("deptFilter").onchange = e=>{
        filters.department = e.target.value;

        // reset academic filters
        filters.year = "all";
        filters.semester = "all";
        document.getElementById("yearFilter").value = "all";
        document.getElementById("semFilter").value = "all";

        loadUsers();
    };

    document.getElementById("yearFilter").onchange = e=>{
        filters.year = e.target.value;
        loadUsers();
    };

    document.getElementById("semFilter").onchange = e=>{
        filters.semester = e.target.value;
        loadUsers();
    };
}
document.addEventListener("click", async (e)=>{

    if(e.target.classList.contains("stuDeptBtn")){

        const id = e.target.dataset.id;

        const deptRes = await api("/api/admin/departments");
        if(!deptRes?.success) return;

        const options = deptRes.data.map(d =>
            `<option value="${d.id}">${d.name}</option>`
        ).join("");

        Modal.show(`
            <h2>Assign Student Department</h2>

            <select id="studentDept" class="form-input">
                ${options}
            </select>

            <div class="modal-actions">
                <button id="saveStudentDept" class="btn btn-primary">Update</button>
            </div>
        `);

        document.getElementById("saveStudentDept").onclick = async ()=>{

            const department_id = document.getElementById("studentDept").value;

            const res = await api(`/api/admin/update-student-department/${id}`,{
                method:"PUT",
                body:JSON.stringify({department_id})
            });

            if(res?.success){
                Toast.show("Student department updated","success");
                Modal.close();
                loadUsers();
            }
        };
    }
});
function updateCreateButton(){

    const btn = document.getElementById("createFacultyBtn");
    if(!btn) return;

    if(filters.role === "student"){
        btn.style.display = "none";
    }else{
        btn.style.display = "inline-flex";
    }
}