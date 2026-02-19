import { api } from "../services/api.js";
import { Toast } from "../core/toast.js";

let attackChart = null;

export async function adminSecurity(view){

    if(attackChart){
        attackChart.destroy();
        attackChart = null;
    }

    view.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">Security Center</h1>
        </div>

        <div class="security-grid">

            <div class="card">
                <h3>System Health</h3>
                <div id="healthStats" class="stats"></div>
            </div>

            <div class="chart-container">
                <canvas id="attackChart"></canvas>
            </div>

            <div class="card wide">
                <h3>Recent Threats</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Student</th>
                            <th>Event</th>
                            <th>Course</th>
                            <th>Time</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody id="threatTable"></tbody>
                </table>
            </div>

            <div class="card wide">
                <h3>Suspicious Students</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Department</th>
                            <th>Violations</th>
                        </tr>
                    </thead>
                    <tbody id="suspiciousTable"></tbody>
                </table>
            </div>

        </div>
    `;

        loadHealth();
        loadThreats();
        loadSuspicious();

        // IMPORTANT: wait one frame for DOM
        requestAnimationFrame(loadAttackStats);
}

async function loadHealth(){

    const res = await api("/api/admin/security/system-health");
    if(!res?.success) return;

    const d = res.data;

    document.getElementById("healthStats").innerHTML = `
        <div class="stat">
            <span class="stat-value">${d.attendance_today}</span>
            <span class="stat-label">Attendances Today</span>
        </div>

        <div class="stat danger">
            <span class="stat-value">${d.threats_today}</span>
            <span class="stat-label">Threats Detected</span>
        </div>

        <div class="stat warn">
            <span class="stat-value">${d.locked_accounts}</span>
            <span class="stat-label">Locked Accounts</span>
        </div>
    `;
}

async function loadThreats(){

    const res = await api("/api/admin/security/recent-threats");
    if(!res?.success) return;

    const tbody = document.getElementById("threatTable");
    tbody.innerHTML = "";

    res.data.forEach(t=>{
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${t.student}</td>
            <td class="danger-text">${t.event}</td>
            <td>${t.course || "-"}</td>
            <td>${t.time}</td>
            <td>
                ${
                    t.status === "Active"
                    ? `<button class="btn-small success resolveBtn" data-id="${t.id}">Resolve</button>`
                    : `<span class="status resolved">Resolved</span>`
                }
            </td>
        `;

        tbody.appendChild(tr);
    });
}

async function loadSuspicious(){

    const res = await api("/api/admin/security/suspicious-students");
    if(!res?.success) return;

    const tbody = document.getElementById("suspiciousTable");
    tbody.innerHTML = "";

    res.data.forEach(u=>{
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${u.name}</td>
            <td>${u.email}</td>
            <td>${u.department}</td>
            <td class="danger-text">${u.violations}</td>
        `;

        tbody.appendChild(tr);
    });
}

async function loadAttackStats(){

    const res = await api("/api/admin/security/attack-stats");
    if(!res?.success) return;

    const labels = res.data.map(d => d.label);
    const values = res.data.map(d => d.value);

    // wait for DOM paint (CRITICAL for SPA)
    requestAnimationFrame(() => {

        const canvas = document.getElementById("attackChart");
        if(!canvas) return;

        const ctx = canvas.getContext("2d");
        if(!ctx) return;

        // destroy previous chart safely
        if(attackChart){
            attackChart.destroy();
            attackChart = null;
        }

        attackChart = new Chart(ctx,{
            type:"bar",
            data:{
                labels:labels,
                datasets:[{
                    label:"Attacks",
                    data:values,
                    borderWidth:1,
                    borderRadius:6
                }]
            },
            options:{
                responsive:true,
                maintainAspectRatio:false,
                animation:false,
                interaction:{
                    mode:"index",
                    intersect:false
                },
                scales:{
                    y:{
                        beginAtZero:true,
                        ticks:{
                            stepSize:1,
                            precision:0
                        }
                    },
                    x:{
                        grid:{display:false}
                    }
                },
                plugins:{
                    legend:{display:false}
                }
            }
        });

    });
}

document.addEventListener("click", async (e)=>{

    if(e.target.classList.contains("resolveBtn")){

        const id = e.target.dataset.id;

        const res = await api(`/api/admin/security/resolve-alert/${id}`,{
            method:"POST"
        });

        if(res?.success){
            Toast.show("Threat resolved","success");
            loadThreats();
            loadHealth();
        }
    }
});