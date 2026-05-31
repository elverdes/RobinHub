const defaultMenuConfig = [
    { id: 'tema', label: '🌓 Modo claro/oscuro', visible: true, lock: false },
    { id: 'notif', label: '🔔 Notificaciones', visible: true, lock: false },
    { id: 'edit', label: '✏️ Editar', visible: true, lock: true },
    { id: 'more', label: '⚙️ Más ajustes', visible: true, lock: true }
];

import { collection, getDocs, limit, onSnapshot, orderBy, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_EMAIL = 'robinhub@robinhub.com';
const ADMIN_NAME = 'RobinHub';
const NOTIFICATION_SOUND_SRC = 'flecha_disparada.mp3';
const notificationAudio = new Audio(NOTIFICATION_SOUND_SRC);
notificationAudio.volume = 0.7;
let notificationContainer = null;
let notificationState = {
    chatRequestsReady: false,
    chatsReady: false,
    listeners: {
        chatRequests: null,
        chats: null
    },
    chatTimestamps: {}
};

function createNotificationContainer() {
    if (notificationContainer) return notificationContainer;
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.style.cssText = 'position: fixed; right: 20px; bottom: 20px; z-index: 99999; display: flex; flex-direction: column; gap: 10px; align-items: flex-end; pointer-events: none;';
    document.body.appendChild(notificationContainer);
    return notificationContainer;
}

function showNotification(title, message, { duration = 4500, sound = true } = {}) {
    const container = createNotificationContainer();
    const notification = document.createElement('div');
    notification.style.cssText = 'pointer-events:auto; min-width: 260px; max-width: 320px; background: rgba(27, 130, 70, 0.95); color: white; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.18); padding: 14px 18px; font-family: sans-serif; opacity: 0; transform: translateY(20px); transition: transform 0.25s ease, opacity 0.25s ease;';
    notification.innerHTML = `<strong style="display:block; margin-bottom:6px;">${title}</strong><span style="font-size:14px; line-height:1.4;">${message}</span>`;
    container.appendChild(notification);
    requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    });
    if (sound) {
        try {
            notificationAudio.currentTime = 0;
            notificationAudio.play().catch(() => {});
        } catch {}
    }
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(20px)';
        setTimeout(() => notification.remove(), 260);
    }, duration);
}

function playClickSound() {
    try {
        notificationAudio.currentTime = 0;
        notificationAudio.play().catch(() => {});
    } catch {}
}

function startRealtimeNotificationListeners(db, currentUserUid) {
    if (!db || !currentUserUid) return;
    if (notificationState.listeners.chatRequests || notificationState.listeners.chats) return;

    const requestsQuery = query(
        collection(db, 'chatRequests'),
        where('toUid', '==', currentUserUid),
        where('status', '==', 'pending')
    );

    notificationState.listeners.chatRequests = onSnapshot(requestsQuery, (snapshot) => {
        if (!notificationState.chatRequestsReady) {
            notificationState.chatRequestsReady = true;
            return;
        }
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                showNotification('Solicitud de chat', 'Has recibido una nueva solicitud de chat.');
            }
        });
    });

    const chatsQuery = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', currentUserUid)
    );

    notificationState.listeners.chats = onSnapshot(chatsQuery, async (snapshot) => {
        if (!notificationState.chatsReady) {
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                notificationState.chatTimestamps[docSnap.id] = data.lastMessageAt?.toMillis() || 0;
            });
            notificationState.chatsReady = true;
            return;
        }

        snapshot.docChanges().forEach(async (change) => {
            const chatId = change.doc.id;
            const data = change.doc.data();
            const previous = notificationState.chatTimestamps[chatId] || 0;
            const current = data.lastMessageAt?.toMillis() || 0;
            notificationState.chatTimestamps[chatId] = current;
            if (change.type === 'modified' && current > previous) {
                const messagesQuery = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(1));
                try {
                    const latestSnap = await getDocs(messagesQuery);
                    if (!latestSnap.empty) {
                        const latest = latestSnap.docs[0].data();
                        if (latest.senderId !== currentUserUid) {
                            showNotification('Nuevo mensaje', 'Has recibido un nuevo mensaje en el chat.');
                        }
                    }
                } catch {}
            }
        });
    });
}

function isAdminProfile(profile) {
    return profile?.role === 'admin' || profile?.nombre === ADMIN_NAME;
}

function getRegistrationRole(nombre, email) {
    const normalizedName = String(nombre || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    return normalizedName === ADMIN_NAME && normalizedEmail === ADMIN_EMAIL ? 'admin' : 'user';
}

function loadMenuConfig() {
    const raw = localStorage.getItem('robinMenuConfig');
    let parsed;

    if (raw) {
        try {
            parsed = JSON.parse(raw);
        } catch {
            parsed = null;
        }
    }

    if (!Array.isArray(parsed)) {
        return defaultMenuConfig.map(item => ({ ...item }));
    }

    const merged = defaultMenuConfig.map(defaultItem => {
        const savedItem = parsed.find(saved => saved.id === defaultItem.id);
        return {
            ...defaultItem,
            visible: savedItem?.visible ?? defaultItem.visible,
            label: savedItem?.label ?? defaultItem.label,
            lock: defaultItem.lock
        };
    });

    if (!merged.some(item => item.visible)) {
        const resetConfig = defaultMenuConfig.map(item => ({ ...item }));
        saveMenuConfig(resetConfig);
        return resetConfig;
    }

    return merged;
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

function createShellLauncherStyles() {
    if (document.getElementById('shell-launcher-styles')) return;
    const style = document.createElement('style');
    style.id = 'shell-launcher-styles';
    style.textContent = `
        .open-audio-shell {
            margin-left: auto;
            padding: 10px 14px;
            border: none;
            border-radius: 999px;
            background: rgba(255,255,255,0.2);
            color: white;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s ease, transform 0.2s ease;
        }
        .open-audio-shell:hover {
            background: rgba(255,255,255,0.35);
            transform: translateY(-1px);
        }
        @media (max-width: 840px) {
            .open-audio-shell {
                display: none;
            }
        }
    `;
    document.head.appendChild(style);
}

function addShellLauncherButton() {
    // Intencionalmente desactivado: el shell se abre automáticamente.
    // Si en el futuro deseas reactivar el lanzador, elimina este early return.
    return;
}

function toggleMenu() {
    document.getElementById('bodyTag')?.classList.toggle('menu-open');
    playClickSound();
}

document.addEventListener('DOMContentLoaded', () => {
    createShellLauncherStyles();
    addShellLauncherButton();
});

function toggleSubmenu() {
    const container = document.getElementById('submenuAjustes');
    if (!container) return;
    const isExpanded = container.classList.toggle('submenu-active');
    container.style.overflow = 'hidden';
    container.style.maxHeight = isExpanded ? `${container.scrollHeight}px` : '0';
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
    createEditPanel,
    isAdminProfile,
    getRegistrationRole,
    showNotification,
    startRealtimeNotificationListeners,
    playClickSound
};
