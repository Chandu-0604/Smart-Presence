import { api } from "../services/api.js";
import { Toast } from "../core/toast.js";

let trendChart = null;
let courseChart = null;
let deptChart = null;

export async function adminAnalytics(view){

    view.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">System Analytics</h1>
        </div>

        <!-- KPI CARDS -->
        <div class="stats-grid" id="kpiCards">
            <div class="stat-card">
                <h3>Total Users</h3>
                <p id="k_users">...</p>
            </div>

            <div class="stat-card">
                <h3>Total Courses</h3>
                <p id="k_courses">...</p>
            </div>

            <div class="stat-card">
                <h3>Total Sessions</h3>
                <p id="k_sessions">...</p>
            </div>

            <div class="stat-card">
                <h3>Security Logs</h3>
                <p id="k_logs">...</p>
            </div>
        </div>

        <!-- TREND -->
        <div class="card">
            <h3>Attendance Trend (Last 7 Days)</h3>
            <div class="chart-container">
                <canvas id="trendChart"></canvas>
            </div>
        </div>

        <!-- COURSE PERFORMANCE -->
        <div class="card">
            <h3>Course Attendance Comparison</h3>
            <div class="chart-container">
                <canvas id="courseChart"></canvas>
            </div>
        </div>

        <!-- DEPARTMENT -->
        <div class="card">
            <h3>Department Performance</h3>
            <div class="chart-container">
                <canvas id="deptChart"></canvas>
            </div>
        </div>

        <!-- INSIGHTS -->
        <div class="card">
            <h3>System Insights</h3>
            <div id="insights"></div>
        </div>
    `;

    loadBasic();
    loadAdvanced();
}

async function loadBasic(){

    const res = await api("/api/admin/analytics");
    if(!res?.success){
        Toast.show("Analytics failed","error");
        return;
    }

    const d = res.data;

    document.getElementById("k_users").textContent = d.total_users;
    document.getElementById("k_courses").textContent = d.total_courses;
    document.getElementById("k_sessions").textContent = d.total_sessions;
    document.getElementById("k_logs").textContent = d.total_logs;

    // Course chart
    const labels = d.courses.map(c=>c.name);
    const values = d.courses.map(c=>c.percentage);

    requestAnimationFrame(()=>{

        const ctx = document.getElementById("courseChart").getContext("2d");

        if(courseChart) courseChart.destroy();

        courseChart = new Chart(ctx,{
            type:"bar",
            data:{
                labels,
                datasets:[{
                    data:values,
                    backgroundColor:"#22c55e",
                    borderRadius:10,
                    barThickness:45
                }]
            },
            options:{
                responsive:true,
                maintainAspectRatio:false,
                plugins:{legend:{display:false}},
                scales:{
                    x:{grid:{display:false}},
                    y:{
                        beginAtZero:true,
                        max:100,
                        ticks:{callback:v=>v+"%"}
                    }
                }
            }
        });
    });
}

async function loadAdvanced(){

    const res = await api("/api/admin/analytics-advanced");
    if(!res?.success) return;

    const d = res.data;

    /* ===== TREND CHART ===== */

    requestAnimationFrame(()=>{

        const canvas = document.getElementById("trendChart");
        if(!canvas) return;

        const ctx = canvas.getContext("2d");
        if(!ctx) return;

        if(trendChart){
            trendChart.destroy();
            trendChart = null;
        }

        const gradient = ctx.createLinearGradient(0,0,0,320);
        gradient.addColorStop(0,"rgba(59,130,246,0.35)");
        gradient.addColorStop(1,"rgba(59,130,246,0.02)");

        trendChart = new Chart(ctx,{
            type:"line",
            data:{
                labels:d.trend.labels,
                datasets:[{
                    data:d.trend.data,
                    fill:true,
                    backgroundColor:gradient,
                    borderColor:"#3b82f6",
                    pointBackgroundColor:"#60a5fa"
                }]
            },
            options:{
                responsive:true,
                maintainAspectRatio:false,
                plugins:{legend:{display:false}},
                scales:{
                    y:{beginAtZero:true, ticks:{precision:0}},
                    x:{grid:{display:false}}
                }
            }
        });

    });

    /* ===== DEPARTMENT ===== */

    requestAnimationFrame(()=>{

        const ctx = document.getElementById("deptChart").getContext("2d");

        if(deptChart) deptChart.destroy();

        deptChart = new Chart(ctx,{
            type:"doughnut",
            data:{
                labels:d.departments.map(x=>x.name),
                datasets:[{
                    data:d.departments.map(x=>x.percentage),
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
                    legend:{
                        position:"bottom"
                    }
                }
            }
        });

    });

    /* ===== INSIGHTS ===== */

    document.getElementById("insights").innerHTML = `
        <div class="insight-grid">

            <div class="insight-box">
                <span>Peak Hour</span>
                <strong>${d.peak_hour ?? "--"}:00</strong>
            </div>

            <div class="insight-box">
                <span>Late Rate</span>
                <strong>${d.late_rate}%</strong>
            </div>

            <div class="insight-box">
                <span>Most Risky Course</span>
                <strong>${d.most_risky_course ?? "None"}</strong>
            </div>

        </div>
    `;

}

