import { Toast } from "../core/toast.js";

const form = document.getElementById("registerForm");
const btn = document.getElementById("registerBtn");

const text = btn.querySelector(".btn-text");
const loader = btn.querySelector(".btn-loader");

let loading = false;

function startLoading(){
    loading = true;
    btn.disabled = true;
    text.textContent = "Creating account...";
    loader.classList.remove("hidden");
}

function stopLoading(){
    loading = false;
    btn.disabled = false;
    text.textContent = "Create Account";
    loader.classList.add("hidden");
}

/* ================= SUBMIT ================= */

form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if(loading) return;

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirmPassword = document.getElementById("confirmPassword").value.trim();

    // ---- validation ----
    if(name.length < 3){
        Toast.show("Name must be at least 3 characters","error");
        return;
    }

    if(password.length < 6){
        Toast.show("Password must be at least 6 characters","error");
        return;
    }

    if(password !== confirmPassword){
        Toast.show("Passwords do not match","error");
        return;
    }

    startLoading();

    try{

        const res = await fetch("/auth/api-register",{
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body:JSON.stringify({
                name,
                email,
                password,
                confirm_password: confirmPassword
            })
        });

        const data = await res.json();

        if(!res.ok || !data.success){
            Toast.show(data.error || "Registration failed","error");
            stopLoading();
            return;
        }

        Toast.show("Account created successfully!","success",3500);

        setTimeout(()=>{
            window.location.href="/auth/login?registered=1";
        },1600);

    }catch(err){
        console.error(err);
        Toast.show("Server unreachable","error");
        stopLoading();
    }
});

/* ================= PASSWORD TOGGLE ================= */

function attachToggle(toggleId, inputId){
    const toggle = document.getElementById(toggleId);
    const input = document.getElementById(inputId);

    if(!toggle || !input) return;

    toggle.addEventListener("click",()=>{
        const hidden = input.type === "password";
        input.type = hidden ? "text" : "password";
        toggle.textContent = hidden ? "🙈" : "👁";
        input.focus();
    });
}

attachToggle("togglePassword","password");
attachToggle("toggleConfirmPassword","confirmPassword");