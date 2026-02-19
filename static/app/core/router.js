export const Router = {

    routes:{},

    init(routes){
        this.routes = routes;

        // first page load
        this.load(location.pathname);

        // intercept navigation clicks
        document.body.addEventListener("click", e=>{

            const link = e.target.closest("a");
            if(!link) return;

            // allow new tab
            if(link.target === "_blank") return;

            // allow external links
            if(link.href.startsWith("mailto:")) return;

            const url = new URL(link.href);

            /* ================= IMPORTANT =================
               Only dashboard routes are SPA
               Auth pages must go to Flask
            ============================================= */

            const isDashboardRoute =
                url.pathname.startsWith("/admin") ||
                url.pathname.startsWith("/faculty") ||
                url.pathname.startsWith("/student");

            // NOT dashboard → let browser handle it
            if(!isDashboardRoute){
                return;   // ← THIS is the missing line
            }

            // SPA navigation
            e.preventDefault();
            if(location.pathname !== url.pathname){
                history.pushState(null,"",url.pathname);
                this.load(url.pathname);
            }
        });

        // browser back/forward
        window.addEventListener("popstate", ()=>{
            this.load(location.pathname);
        });
    },

    async load(path){

        const view = document.getElementById("view");
        if(!view) return;

        /* 🔥 CRITICAL: invalidate previous page scripts */
        window.__ACTIVE_VIEW_ID = Date.now();

        document.dispatchEvent(new CustomEvent("view-destroy"));

        if(window.stopAllStreams){
            window.stopAllStreams();
        }

        path = path.replace(/\/$/, "");
        const page = this.routes[path];

        if(!page){
            view.innerHTML = `<div style="padding:40px">Page not found</div>`;
            return;
        }

        view.innerHTML = "";
        await page(view);

        document.dispatchEvent(
            new CustomEvent("route-changed",{detail:{path}})
        );
    }

};
