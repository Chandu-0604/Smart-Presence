// current authenticated user
let currentUser = null;

export function getCurrentUser(){
    return currentUser;
}
/* ------------------------------------------------
   Ask backend who is logged in
------------------------------------------------ */
export async function fetchSession(){

    try{
        const res = await fetch("/api/session/me",{
            credentials:"include"
        });

        if(!res.ok){
            currentUser = null;
            return null;
        }

        const data = await res.json();

        if(!data.success){
            currentUser = null;
            return null;
        }

        // 🔴 SAVE CSRF HERE
        window.CSRF_TOKEN = data.csrf_token;

        currentUser = data.data;
        return currentUser;

    }catch(err){
        console.error("Session fetch failed:",err);
        currentUser = null;
        return null;
    }
}
/* ------------------------------------------------
   Redirect user to correct dashboard
------------------------------------------------ */
export function redirectByRole(user){

    if(!user){
        window.location.href="/auth/login";
        return;
    }

    if(user.role === "admin"){
        window.location.href="/admin";
    }
    else if(user.role === "faculty"){
        window.location.href="/faculty";
    }
    else{
        window.location.href="/student";
    }
}