import { api } from "../services/api.js";
import { Toast } from "../core/toast.js";
import { Modal } from "../core/modal.js";

export async function adminDepartments(view){

    view.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">Departments</h1>
            <button id="createDeptBtn" class="btn btn-primary">+ Create Department</button>
        </div>

        <div class="card">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Code</th>
                        <th>Radius (m)</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="deptBody">
                    <tr><td colspan="4">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    document.getElementById("createDeptBtn").onclick = openCreateModal;

    loadDepartments();
}

async function loadDepartments(){

    const res = await api("/api/admin/departments");
    if(!res?.success) return;

    const tbody = document.getElementById("deptBody");
    tbody.innerHTML = "";

    res.data.forEach(d=>{

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${d.name}</td>
            <td>${d.code}</td>
            <td>${d.radius}</td>
            <td>
                <button class="btn-small danger" data-id="${d.id}">Delete</button>
            </td>
        `;

        tr.querySelector("button").onclick = ()=>deleteDept(d.id);

        tbody.appendChild(tr);
    });
}

function openCreateModal(){

    Modal.show(`
        <h2>Create Department</h2>

        <div class="form-group">
            <label>Name</label>
            <input id="deptName" class="form-input">
        </div>

        <div class="form-group">
            <label>Code</label>
            <input id="deptCode" class="form-input">
        </div>

        <div class="form-group">
            <label>Radius (meters)</label>
            <input id="deptRadius" class="form-input" type="number" value="300">
        </div>

        <div class="modal-actions">
            <button id="createDeptSubmit" class="btn btn-primary">Create</button>
        </div>
    `);

    document.getElementById("createDeptSubmit").onclick = createDept;
}

async function createDept(){

    const name = document.getElementById("deptName").value.trim();
    const code = document.getElementById("deptCode").value.trim();
    const radius = document.getElementById("deptRadius").value;

    const res = await api("/api/admin/create-department",{
        method:"POST",
        body: JSON.stringify({name,code,radius})
    });

    if(!res?.success){
        Toast.show(res?.error || "Failed","error");
        return;
    }

    Toast.show("Department created","success");
    Modal.close();
    loadDepartments();
}

async function deleteDept(id){

    Modal.confirm("Delete this department?", async ()=>{

        const res = await api(`/api/admin/delete-department/${id}`,{
            method:"DELETE"
        });

        if(res?.success){
            Toast.show("Department deleted","success");
            loadDepartments();
        }
    });
}