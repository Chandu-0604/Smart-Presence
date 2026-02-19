import { api } from "../services/api.js";
import { Toast } from "../core/toast.js";
import { Modal } from "../core/modal.js";
import { openEnrollment } from "./admin.enrollment.js";

export async function adminCourses(view){

    view.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">Courses</h1>
            <button id="createCourseBtn" class="btn btn-primary">+ Create Course</button>
        </div>

        <div class="card">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Code</th>
                        <th>Faculty</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="courseBody">
                    <tr><td colspan="4">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    document.getElementById("createCourseBtn").onclick = openCreateModal;

    loadCourses();
}

async function loadCourses(){

    const res = await api("/api/admin/courses");
    if(!res?.success) return;

    const tbody = document.getElementById("courseBody");
    tbody.innerHTML = "";

    res.data.forEach(c=>{

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${c.name}</td>
            <td>${c.code}</td>
            <td>${c.faculty}</td>
            <td class="actions">

                <button class="btn-small primary assignBtn"
                    data-id="${c.id}">
                    Change Faculty
                </button>

                <button class="btn-small primary enrollBtn"
                    data-id="${c.id}"
                    data-name="${c.name}">
                    Students
                </button>

                <button class="btn-small danger deleteBtn"
                    data-id="${c.id}">
                    Delete
                </button>

            </td>
        `;

        tr.querySelector(".deleteBtn").onclick = ()=>deleteCourse(c.id);

        tbody.appendChild(tr);
    });
}

async function openCreateModal(){

    const deptRes = await api("/api/admin/departments");

    const deptOptions = deptRes.data.map(d =>
        `<option value="${d.id}">${d.name}</option>`
    ).join("");

    Modal.show(`
        <h2>Create Course</h2>

        <div class="form-group">
            <label>Name</label>
            <input id="courseName" class="form-input">
        </div>

        <div class="form-group">
            <label>Code</label>
            <input id="courseCode" class="form-input">
        </div>

        <div class="form-group">
            <label>Department</label>
            <select id="courseDept" class="form-input">
                ${deptOptions}
            </select>
        </div>

        <div class="form-group">
            <label>Faculty</label>
            <select id="courseFaculty" class="form-input">
                <option value="">Select department first</option>
            </select>
        </div>

        <div class="modal-actions">
            <button id="createCourseSubmit" class="btn btn-primary">Create</button>
        </div>
    `);
    const deptSelect = document.getElementById("courseDept");
    const facultySelect = document.getElementById("courseFaculty");

    deptSelect.addEventListener("change", async ()=>{

        const deptId = deptSelect.value;

        facultySelect.innerHTML = `<option>Loading...</option>`;

        const res = await api(`/api/admin/faculty-by-department/${deptId}`);

        if(!res || !res.success || res.data.length === 0){
            facultySelect.innerHTML = `<option value="">No faculty in this department</option>`;
            return;
        }

        facultySelect.innerHTML = `<option value="">Unassigned</option>`;

        res.data.forEach(f=>{
            const opt = document.createElement("option");
            opt.value = f.id;
            opt.textContent = f.name;
            facultySelect.appendChild(opt);
        });
    });

    document.getElementById("createCourseSubmit").onclick = createCourse;
}

async function createCourse(){

    const name = document.getElementById("courseName").value.trim();
    const code = document.getElementById("courseCode").value.trim();
    const department_id = document.getElementById("courseDept").value;
    const faculty_id = document.getElementById("courseFaculty").value || null;

    if(!name || !code || !department_id){
        Toast.show("All fields required","error");
        return;
    }

    const res = await api("/api/admin/create-course",{
        method:"POST",
        body: JSON.stringify({name,code,department_id,faculty_id})
    });

    if(!res?.success){
        Toast.show(res?.error || "Failed to create course","error");
        return;
    }

    Toast.show("Course created","success");
    Modal.close();
    loadCourses();
}

async function deleteCourse(id){

    Modal.confirm("Delete this course?", async ()=>{

        const res = await api(`/api/admin/delete-course/${id}`,{
            method:"DELETE"
        });

        if(res?.success){
            Toast.show("Course deleted","success");
            loadCourses();
        }
    });
}
document.addEventListener("click",(e)=>{

    if(e.target.classList.contains("enrollBtn")){

        const id = e.target.dataset.id;
        const name = e.target.dataset.name;

        openEnrollment({id,name});
    }
});
document.addEventListener("click", async (e)=>{

    if(e.target.classList.contains("assignBtn")){

        const id = e.target.dataset.id;

        const facultyRes = await api("/api/admin/faculty-list");
        if(!facultyRes?.success) return;

        const options = `<option value="">Unassigned</option>` +
            facultyRes.data.map(f =>
                `<option value="${f.id}">${f.name}</option>`
            ).join("");

        Modal.show(`
            <h2>Change Faculty</h2>
            <select id="newFaculty" class="form-input">
                ${options}
            </select>
            <div class="modal-actions">
                <button id="assignFacultySubmit" class="btn btn-primary">Update</button>
            </div>
        `);

        document.getElementById("assignFacultySubmit").onclick = async ()=>{

            const faculty_id = document.getElementById("newFaculty").value || null;

            const res = await api(`/api/admin/assign-course-faculty/${id}`,{
                method:"PUT",
                body:JSON.stringify({faculty_id})
            });

            if(res?.success){
                Toast.show("Faculty updated","success");
                Modal.close();
                loadCourses();
            }
        };
    }
});
