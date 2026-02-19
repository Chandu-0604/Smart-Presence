export function renderPage(view, options = {}) {

    const {
        title = "",
        subtitle = "",
        actions = "",
        content = ""
    } = options;

    view.innerHTML = `
        <div class="page-shell">

            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-heading">${title}</h1>
                    ${subtitle ? `<div class="page-subtitle">${subtitle}</div>` : ""}
                </div>

                <div class="page-header-actions">
                    ${actions}
                </div>
            </div>

            <div class="page-content">
                ${content}
            </div>

        </div>
    `;
}
