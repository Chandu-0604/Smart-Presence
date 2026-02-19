import { Sidebar } from "../components/sidebar.js";
import { Topbar } from "../components/topbar.js";

export const UI = {

    init(){
        Sidebar.render();
        Topbar.render();
    }

};