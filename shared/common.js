const defaultMenuConfig = [
    { id: 'tema', label: '🌓 Modo claro/oscuro', visible: true, lock: false },
    { id: 'notif', label: '🔔 Notificaciones', visible: true, lock: false },
    { id: 'edit', label: '✏️ Editar', visible: true, lock: true },
    { id: 'more', label: '⚙️ Más ajustes', visible: true, lock: true }
];

function loadMenuConfig() {
    const raw = localStorage.getItem('robinMenuConfig');
    if (!raw) return defaultMenuConfig.map(item => ({ ...item }));
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : defaultMenuConfig.map(item => ({ ...item }));
    } catch {
        return defaultMenuConfig.map(item => ({ ...item }));
    }
}

function saveMenuConfig(config) {
    localStorage.setItem('robinMenuConfig', JSON.stringify(config));
}

function applySavedTheme() {
    const tema = localStorage.getItem('robinTema') || 'claro';
    if (tema === 'oscuro') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.style.backgroundImage = "url('oscuro.png')";
    } else {
        document.documentElement.removeAttribute('data-theme');
        document.body.style.backgroundImage = "url('claro.png')";
    }
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    localStorage.setItem('robinTema', isDark ? 'claro' : 'oscuro');
    applySavedTheme();
}

function toggleMenu() {
    document.getElementById('bodyTag')?.classList.toggle('menu-open');
}

function toggleSubmenu() {
    document.getElementById('submenuAjustes')?.classList.toggle('submenu-active');
}

function closeMenu() {
    document.getElementById('bodyTag')?.classList.remove('menu-open');
}

function renderSubmenu({
    config = loadMenuConfig(),
    containerId = 'submenuAjustes',
    onEdit = () => {},
    onMore = () => { window.location.href = 'ajustes.html'; },
    onTheme = toggleTheme
} = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    config.forEach(item => {
        if (!item.visible) return;
        const a = document.createElement('a');
        a.textContent = item.label;
        a.href = 'javascript:void(0)';
        a.addEventListener('click', event => {
            event.preventDefault();
            if (item.id === 'tema') onTheme();
            else if (item.id === 'edit') onEdit();
            else if (item.id === 'more') onMore();
        });
        container.appendChild(a);
    });
}

function setupSidebar({
    config = loadMenuConfig(),
    onPerfil = () => {},
    onLogout = async () => {},
    onEdit = () => {},
    onMore = () => { window.location.href = 'ajustes.html'; }
} = {}) {
    document.querySelectorAll('.submenu-toggle').forEach(btn => {
        btn.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            toggleSubmenu();
        });
    });

    document.querySelectorAll('.sidebar a:not(#sideLogout):not(.submenu-toggle)').forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    const perfil = document.getElementById('sidePerfil');
    if (perfil) {
        perfil.addEventListener('click', event => {
            event.preventDefault();
            closeMenu();
            onPerfil();
        });
    }

    const logout = document.getElementById('sideLogout');
    if (logout) {
        logout.addEventListener('click', async event => {
            event.preventDefault();
            closeMenu();
            await onLogout();
        });
    }

    renderSubmenu({ config, onEdit, onMore });
}

function createEditPanel(config = loadMenuConfig(), containerId = 'editList', onChange = () => {}) {
    const list = document.getElementById(containerId);
    if (!list) return;
    list.innerHTML = '';

    config.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'edit-item';
        div.innerHTML = `
            <span>${item.label}</span>
            <div>
                <button class="btn-order" type="button">↑</button>
                <button class="btn-order" type="button">↓</button>
                <input type="checkbox" ${item.visible ? 'checked' : ''} ${item.lock ? 'disabled' : ''}>
            </div>
        `;

        const buttons = div.querySelectorAll('button');
        buttons[0].addEventListener('click', () => {
            moveEditItem(config, index, -1, onChange);
        });
        buttons[1].addEventListener('click', () => {
            moveEditItem(config, index, 1, onChange);
        });

        const checkbox = div.querySelector('input');
        if (checkbox) {
            checkbox.addEventListener('change', event => {
                if (!item.lock) {
                    item.visible = event.target.checked;
                    saveMenuConfig(config);
                    onChange();
                }
            });
        }

        list.appendChild(div);
    });
}

function moveEditItem(config, index, direction, onChange) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= config.length) return;
    [config[index], config[newIndex]] = [config[newIndex], config[index]];
    saveMenuConfig(config);
    onChange();
}

export {
    defaultMenuConfig,
    loadMenuConfig,
    saveMenuConfig,
    applySavedTheme,
    toggleTheme,
    toggleMenu,
    toggleSubmenu,
    closeMenu,
    renderSubmenu,
    setupSidebar,
    createEditPanel
};
