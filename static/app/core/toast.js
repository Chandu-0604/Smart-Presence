export class Toast {

    static show(message, type="info", duration=3500){

        let root = document.getElementById("toastRoot");

        // if layout not loaded yet
        if(!root){
            root = document.createElement("div");
            root.id = "toastRoot";
            document.body.appendChild(root);
        }

        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        toast.textContent = message;

        root.appendChild(toast);

        // force reflow for animation
        requestAnimationFrame(()=>{
            toast.classList.add("show");
        });

        setTimeout(()=>{
            toast.classList.remove("show");

            setTimeout(()=>{
                toast.remove();
            },300);

        },duration);
    }
}