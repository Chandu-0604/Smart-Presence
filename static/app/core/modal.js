export class Modal {

    /* =======================================================
       MAIN MODAL (FORM MODAL)
       ======================================================= */

    static show(content){

        // remove existing
        Modal.close();

        const overlay = document.createElement("div");
        overlay.id = "modalOverlay";
        overlay.className = "modal-overlay";

        overlay.innerHTML = `
            <div class="modal-window">
                <button class="modal-close" id="modalClose">&times;</button>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // close events
        document.getElementById("modalClose").onclick = Modal.close;

        overlay.addEventListener("click",(e)=>{
            if(e.target.id === "modalOverlay"){
                Modal.close();
            }
        });
    }

    static close(){
        const m = document.getElementById("modalOverlay");
        if(m) m.remove();
    }

    /* =======================================================
       CONFIRMATION MODAL (NO BROWSER ALERTS ANYMORE)
       ======================================================= */

    static confirm(message, onConfirm){

        Modal.show(`
            <h2>Confirm Action</h2>
            <p style="margin-top:10px">${message}</p>

            <div class="modal-actions">
                <button class="btn btn-danger" id="confirmYes">Delete</button>
                <button class="btn btn-secondary" id="confirmNo">Cancel</button>
            </div>
        `);

        document.getElementById("confirmYes").onclick = ()=>{
            Modal.close();
            onConfirm();
        };

        document.getElementById("confirmNo").onclick = Modal.close;
    }
}