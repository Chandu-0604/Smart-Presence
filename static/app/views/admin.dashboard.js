import { Toast } from "../core/toast.js";
import { api } from "../services/api.js";
import { renderPage } from "../core/page.js";

let trendChart = null;
let courseChart = null;
let deptChart = null;

export async function adminDashboard(view){

    renderPage(view,{
        title:"System Control Center",
        subtitle:"Monitor platform health, users, and attendance analytics",

        content:`

            <!-- ===== STAT CARDS ===== -->
            <div class="stats-grid">

                <div class="stat-box">
                    <div class="stat-title">System Status</div>
                    <div class="stat-value" id="sysStatus">...</div>
                </div>

                <div class="stat-box">
                    <div class="stat-title">Total Users</div>
                    <div class="stat-value" id="totalUsers">...</div>
                </div>

                <div class="stat-box">
                    <div class="stat-title">Courses</div>
                    <div class="stat-value" id="totalCourses">...</div>
                </div>

                <div class="stat-box">
                    <div class="stat-title">Active Sessions</div>
                    <div class="stat-value" id="activeSessions">...</div>
                </div>

                <div class="stat-box">
                    <div class="stat-title">Today's Attendance</div>
                    <div class="stat-value" id="todayAttendance">...</div>
                </div>

            </div>

            <!-- ===== ANALYTICS ===== -->

            <div class="card">
                <h3>Attendance Trend (Last 7 Days)</h3>
                <div class="chart-container large">
                    <canvas id="trendChart"></canvas>
                </div>
            </div>

            <div class="analytics-grid">

                <div class="card">
                    <h3>Course Attendance Percentage</h3>
                    <div class="chart-container medium">
                        <canvas id="courseChart"></canvas>
                    </div>
                </div>

                <div class="card">
                    <h3>Department Comparison</h3>
                    <div class="chart-container medium">
                        <canvas id="deptChart"></canvas>
                    </div>
                </div>

            </div>

        `
    });

    await loadDashboardStats();
    await loadAnalytics();
    await loadAdvancedAnalytics();
}

async function loadDashboardStats(){

    const json = await api("/api/admin/dashboard-stats");
    if(!json || !json.success){
        Toast.show("Failed to load dashboard","error");
        return;
    }

    const data = json.data;

    document.getElementById("sysStatus").textContent = data.system;
    document.getElementById("totalUsers").textContent = data.users;
    document.getElementById("totalCourses").textContent = data.courses;
    document.getElementById("activeSessions").textContent = data.active_sessions;
    document.getElementById("todayAttendance").textContent = data.today_attendance;
}

async function loadAnalytics(){

    const json = await api("/api/admin/analytics");
    if(!json.success) return;

    const labels = json.data.courses.map(c=>c.name);
    const values = json.data.courses.map(c=>c.percentage);

    const ctx = document.getElementById("courseChart");

    if(courseChart) courseChart.destroy();

    courseChart = new Chart(ctx,{
        type:"bar",
        data:{
            labels:labels,
            datasets:[{
                data:values,
                backgroundColor:"#22c55e",
                borderRadius:8,
                barThickness:40
            }]
        },
        options:{
            plugins:{legend:{display:false}},
            scales:{
                x:{grid:{display:false}},
                y:{beginAtZero:true,max:100}
            }
        }
    });
}

async function loadAdvancedAnalytics(){

    const json = await api("/api/admin/analytics-advanced");
    if(!json || !json.success) return;

    /* ===== TREND CHART ===== */

    const trendCtx = document.getElementById("trendChart");
    if(!trendCtx) return;

    const trendLabels = json.data.trend.labels || [];
    const trendValues = json.data.trend.data || [];

    if(trendLabels.length === 0){
        console.warn("No trend data available");
        return;
    }

    if(trendChart) trendChart.destroy();

    trendChart = new Chart(trendCtx,{
        type:"line",
        data:{
            labels:trendLabels,
            datasets:[{
                label:"Attendance",
                data:trendValues,
                fill:true,
                backgroundColor:"rgba(59,130,246,0.15)",
                borderColor:"#3b82f6",
                pointBackgroundColor:"#60a5fa",
                tension:0.35
            }]
        },
        options:{
            responsive:true,
            maintainAspectRatio:false,
            plugins:{
                legend:{display:false}
            },
            scales:{
                y:{
                    beginAtZero:true,
                    ticks:{precision:0}
                }
            }
        }
    });

    /* ===== DEPARTMENT CHART ===== */

    const deptCtx = document.getElementById("deptChart");
    if(!deptCtx) return;

    const deptLabels = json.data.departments.map(d=>d.name);
    const deptValues = json.data.departments.map(d=>d.percentage);

    if(deptChart) deptChart.destroy();

    deptChart = new Chart(deptCtx,{
        type:"doughnut",
        data:{
            labels:deptLabels,
            datasets:[{
                data:deptValues,
                backgroundColor:[
                    "#3b82f6",
                    "#f59e0b",
                    "#10b981",
                    "#ef4444",
                    "#8b5cf6"
                ],
                borderWidth:0,
                cutout:"70%"
            }]
        },
        options:{
            responsive:true,
            maintainAspectRatio:false,
            plugins:{
                legend:{position:"bottom"}
            }
        }
    });
}
