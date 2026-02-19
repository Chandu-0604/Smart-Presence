export function formatTime(iso){

    if(!iso) return "-";

    const date = new Date(iso);

    return date.toLocaleString("en-IN",{
        day:"2-digit",
        month:"short",
        year:"numeric",
        hour:"2-digit",
        minute:"2-digit",
        second:"2-digit",
        hour12:true
    });
}
