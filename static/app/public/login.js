import { fetchSession, redirectByRole } from "../core/auth.js";
import { Toast } from "../core/toast.js";

/* =========================================================
   SECURITY: CLEAR OLD CSRF (VERY IMPORTANT)
   prevents previous user token causing 403
========================================================= */
sessionStorage.removeItem("csrf_token");

/* ================= PAGE ENTRY NOTIFICATIONS ================= */

const params = new URLSearchParams(window.location.search);

if(params.get("registered")){
    Toast.show("Account created successfully. Please login.","success");
}

if(params.get("logout")){
    Toast.show("You have been logged out.","info");
}

if(params.get("expired")){
    Toast.show("Session expired. Please login again.","error");
}

/* ================= DOM ================= */

const form = document.getElementById("loginForm");
const btn = document.getElementById("loginBtn");

const text = btn.querySelector(".btn-text");
const loader = btn.querySelector(".btn-loader");

let loading = false;

/* ================= LOADING UI ================= */

function startLoading(){
    loading = true;
    btn.disabled = true;
    text.textContent = "Signing in...";
    loader.classList.remove("hidden");
}

function stopLoading(){
    loading = false;
    btn.disabled = false;
    text.textContent = "Login";
    loader.classList.add("hidden");
}

/* ================= LOGIN SUBMIT ================= */

form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if(loading) return;

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if(!email || !password){
        Toast.show("Email and password are required","error");
        return;
    }

    startLoading();

    try{

        /* -------- CALL LOGIN API -------- */

        const res = await fetch("/auth/api-login",{
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            credentials:"include",              // REQUIRED FOR SESSION COOKIE
            body:JSON.stringify({email,password})
        });

        let data = null;

        try{
            data = await res.json();
        }catch{
            throw new Error("Invalid server response");
        }

        /* ---------- LOGIN FAILED ---------- */

        if(!res.ok || !data.success){

            if(res.status===403){
                Toast.show("Account temporarily locked. Try again later.","error");
            }
            else if(res.status===401){
                Toast.show("Invalid email or password","error");
            }
            else{
                Toast.show(data?.error || "Login failed","error");
            }

            stopLoading();
            return;
        }

        /* ======================================================
           CRITICAL FIX: STORE CSRF TOKEN
           (This fixes ALL 403 on POST/DELETE APIs)
        ====================================================== */

        if(data.csrf_token){
            sessionStorage.setItem("csrf_token", data.csrf_token);
        }else{
            Toast.show("Security initialization failed. Refresh and login again.","error");
            stopLoading();
            return;
        }

        /* -------- WAIT FOR FLASK SESSION COOKIE -------- */

        let user = null;

        // sometimes browser commits cookie slightly late
        for(let i=0;i<6;i++){
            user = await fetchSession();
            if(user) break;
            await new Promise(r=>setTimeout(r,300));
        }

        if(!user){
            Toast.show("Session could not be established. Please refresh.","error");
            stopLoading();
            return;
        }

        /* -------- SUCCESS -------- */

        sessionStorage.setItem("postLoginToast","Welcome back, " + user.name + "!");

        redirectByRole(user);

    }catch(err){
        console.error(err);
        Toast.show("Server unreachable","error");
    }
    finally{
        stopLoading();
    }
});

/* ================= PASSWORD VISIBILITY ================= */

const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

if(togglePassword){
    togglePassword.addEventListener("click",()=>{

        const isHidden = passwordInput.type === "password";

        passwordInput.type = isHidden ? "text" : "password";
        togglePassword.textContent = isHidden ? "🙈" : "👁";

        passwordInput.focus();
        passwordInput.setSelectionRange(passwordInput.value.length, passwordInput.value.length);
    });
}