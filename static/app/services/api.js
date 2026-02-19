import { Toast } from "../core/toast.js";

let authChecking = false;

export async function api(url, options = {}) {

    const csrfToken = sessionStorage.getItem("csrf_token");

    const opts = {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken
        },
        ...options
    };

    if(options.headers){
        opts.headers = {...opts.headers, ...options.headers};
    }

    try{

        // Automatically attach API prefix when needed
        const finalUrl = url.startsWith("/api") ? url : "/api" + url;

        let res = await fetch(finalUrl, opts);


        /* ---------- SESSION EXPIRED ---------- */

        if(res.status === 401){

            if(authChecking) return null;
            authChecking = true;

            Toast.show("Session expired. Please login again.","error");

            setTimeout(()=>{
                sessionStorage.clear();
                window.location.href="/auth/login";
            },800);

            return null;
        }

        /* ---------- FORBIDDEN (REAL PERMISSION ISSUE) ---------- */

        if(res.status === 403){

            let errorMsg = "Access denied";

            try{
                const data = await res.json();
                console.error("SERVER 403 RESPONSE:", data);
                if(data && data.error){
                    errorMsg = data.error;
                }
            }catch(e){
                console.error("Could not parse 403 response");
            }

            Toast.show(errorMsg,"error");
            return null;
        }

        const text = await res.text();

        try{
            return text ? JSON.parse(text) : null;
        }catch(e){
            console.error("Invalid JSON response:", text);
            Toast.show("Unexpected server response","error");
            return null;
        }


    }catch(err){
        Toast.show("Server unreachable","error");
        return null;
    }
}