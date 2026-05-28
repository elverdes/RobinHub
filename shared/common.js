const defaultMenuConfig = [
    { id: 'tema', label: '🌓 Modo claro/oscuro', visible: true, lock: false },
    { id: 'notif', label: '🔔 Notificaciones', visible: true, lock: false },
    { id: 'edit', label: '✏️ Editar', visible: true, lock: true },
    { id: 'more', label: '⚙️ Más ajustes', visible: true, lock: true }
];

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

function toggleMenu() {
    document.getElementById('bodyTag')?.classList.toggle('menu-open');
}

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

const defaultMusicPlaylist = [
    { title: 'Chopin - Nocturne Op. 9 No. 2', src: 'Classicals.de - Chopin - Nocturne Op. 9, No. 2 in E-flat major.mp3' }
];

const musicStateStorageKey = 'robinMusicPlayerState';
let musicPlaylist = [...defaultMusicPlaylist];
let musicAudio = null;
let musicState = { index: 0, time: 0, playing: false };
let musicPendingPlay = false;

function loadMusicState() {
    const raw = localStorage.getItem(musicStateStorageKey);
    if (!raw) return;
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.index === 'number') musicState.index = parsed.index;
        if (typeof parsed.time === 'number') musicState.time = parsed.time;
        if (typeof parsed.playing === 'boolean') musicState.playing = parsed.playing;
    } catch {
        // ignore invalid state
    }
}

function saveMusicState() {
    localStorage.setItem(musicStateStorageKey, JSON.stringify(musicState));
}

function syncMusicState(event) {
    if (event.key !== musicStateStorageKey || !event.newValue) return;
    try {
        const remote = JSON.parse(event.newValue);
        if (typeof remote.index !== 'number' || typeof remote.time !== 'number' || typeof remote.playing !== 'boolean') return;

        const hasTrackChange = remote.index !== musicState.index;
        const hasTimeDrift = Math.abs(remote.time - musicState.time) > 1;
        const hasPlayingChange = remote.playing !== musicState.playing;

        if (hasTrackChange) {
            musicState.index = remote.index;
            setMusicTrack(remote.index, false);
        }

        if (hasTimeDrift) {
            musicState.time = remote.time;
            if (musicAudio && musicAudio.readyState > 0) {
                musicAudio.currentTime = Math.min(remote.time, musicAudio.duration || remote.time);
            }
        }

        if (hasPlayingChange) {
            musicState.playing = remote.playing;
        }

        updateMusicUI();
    } catch {
        // ignore invalid storage events
    }
}

function attemptResumePlayback() {
    if (!musicAudio || !musicState.playing) return;
    const playPromise = musicAudio.play();
    if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(() => {
            const resumeOnInteraction = () => {
                if (musicState.playing) {
                    musicAudio.play().catch(() => {});
                }
                document.removeEventListener('click', resumeOnInteraction);
            };
            document.addEventListener('click', resumeOnInteraction, { once: true });
        });
    }
}

function createMusicPlayerStyles() {
    if (document.getElementById('music-player-styles')) return;
    const style = document.createElement('style');
    style.id = 'music-player-styles';
    style.textContent = `
        .nav-top {
            position: relative;
        }
        .music-player {
            position: absolute;
            top: 50%;
            left: calc(100vw / 6);
            transform: translateY(-50%);
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 10px;
            border-radius: 999px;
            background: transparent;
            color: white;
            font-size: 14px;
            max-width: 340px;
            overflow: hidden;
            flex-shrink: 0;
            z-index: 10;
        }
        .music-player-button {
            width: 34px;
            height: 34px;
            border: none;
            border-radius: 50%;
            background: rgba(255,255,255,0.18);
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            flex-shrink: 0;
        }
        .music-player-scroll {
            position: relative;
            width: 12ch;
            min-width: 12ch;
            overflow: hidden;
        }
        .music-player-scroll::before,
        .music-player-scroll::after {
            content: '';
            position: absolute;
            top: 0;
            bottom: 0;
            width: 2ch;
            pointer-events: none;
            background: linear-gradient(to right, rgba(27,130,70,0), rgba(27,130,70,0.22));
        }
        .music-player-scroll::after {
            right: 0;
            left: auto;
            background: linear-gradient(to left, rgba(27,130,70,0), rgba(27,130,70,0.22));
        }
        .music-player-title {
            display: inline-block;
            white-space: nowrap;
            padding-left: 0.15ch;
            animation: none;
            will-change: transform;
        }
        .music-player-title.long {
            animation: scrollTrack 12s linear infinite;
        }
        @keyframes scrollTrack {
            0% { transform: translateX(100%); }
            10% { transform: translateX(0%); }
            90% { transform: translateX(calc(-100% + 12ch)); }
            100% { transform: translateX(calc(-100% + 12ch)); }
        }
        @media (max-width: 900px) {
            .music-player {
                max-width: 260px;
            }
        }
        @media (max-width: 640px) {
            .music-player {
                display: none;
            }
        }
    `;
    document.head.appendChild(style);
}

function getCurrentMusicTrack() {
    return musicPlaylist[musicState.index] || musicPlaylist[0] || { title: 'Sin pista', src: '' };
}

function updateMusicUI() {
    const titleEl = document.getElementById('musicPlayerTitle');
    const button = document.getElementById('musicPlayPauseBtn');
    if (!titleEl || !button) return;
    const track = getCurrentMusicTrack();
    titleEl.textContent = track.title;
    const rawTitle = track.title || 'Sin pista';
    titleEl.dataset.rawTitle = rawTitle;
    if (rawTitle.length > 12) {
        titleEl.classList.add('long');
    } else {
        titleEl.classList.remove('long');
    }
    button.textContent = musicState.playing ? '⏸️' : '▶️';
}

function setMusicTrack(index, resetTime = true) {
    musicState.index = Math.max(0, Math.min(index, musicPlaylist.length - 1));
    if (resetTime) {
        musicState.time = 0;
    }
    saveMusicState();
    if (!musicAudio) return;
    const track = getCurrentMusicTrack();
    musicAudio.src = track.src;
    musicAudio.load();

    if (!resetTime && musicState.time > 0) {
        if (musicAudio.readyState > 0) {
            musicAudio.currentTime = Math.min(musicState.time, musicAudio.duration || musicState.time);
        } else {
            const restoreTime = () => {
                musicAudio.currentTime = Math.min(musicState.time, musicAudio.duration || musicState.time);
                musicAudio.removeEventListener('loadedmetadata', restoreTime);
            };
            musicAudio.addEventListener('loadedmetadata', restoreTime);
        }
    } else if (musicState.time > 0) {
        musicAudio.currentTime = musicState.time;
    }

    updateMusicUI();
}

function playMusic() {
    if (!musicAudio) return;
    musicPendingPlay = true;
    const playPromise = musicAudio.play();
    if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(() => {
            musicPendingPlay = false;
            musicState.playing = true;
            saveMusicState();
            updateMusicUI();
        }).catch(() => {
            musicState.playing = true;
            saveMusicState();
            updateMusicUI();
            const resumeOnInteraction = () => {
                if (musicPendingPlay) {
                    musicAudio.play().catch(() => {});
                }
                document.removeEventListener('click', resumeOnInteraction);
            };
            document.addEventListener('click', resumeOnInteraction, { once: true });
        });
    }
}

function pauseMusic() {
    if (!musicAudio) return;
    musicAudio.pause();
    musicState.playing = false;
    saveMusicState();
    updateMusicUI();
}

function toggleMusicPlayback() {
    if (musicState.playing) pauseMusic();
    else playMusic();
}

function nextMusicTrack() {
    musicState.index = (musicState.index + 1) % musicPlaylist.length;
    musicState.time = 0;
    saveMusicState();
    if (musicAudio) {
        const track = getCurrentMusicTrack();
        musicAudio.src = track.src;
        musicAudio.load();
        if (musicState.playing) playMusic();
    }
    updateMusicUI();
}

function initMusicPlayer(playlist = defaultMusicPlaylist) {
    musicPlaylist = Array.isArray(playlist) && playlist.length > 0 ? playlist : defaultMusicPlaylist;
    loadMusicState();

    if (!musicAudio) {
        musicAudio = document.createElement('audio');
        musicAudio.id = 'robinMusicAudio';
        musicAudio.preload = 'auto';
        musicAudio.style.display = 'none';
        musicAudio.addEventListener('ended', nextMusicTrack);
        musicAudio.addEventListener('timeupdate', () => {
            musicState.time = musicAudio.currentTime;
            saveMusicState();
        });
        document.body.appendChild(musicAudio);
    }

    createMusicPlayerStyles();

    const navTop = document.querySelector('.nav-top');
    if (!navTop) return;

    if (!document.getElementById('musicPlayer')) {
        const player = document.createElement('div');
        player.id = 'musicPlayer';
        player.className = 'music-player';
        player.innerHTML = `
            <button type="button" id="musicPlayPauseBtn" class="music-player-button" aria-label="Play/Pause">▶️</button>
            <div class="music-player-scroll"><span class="music-player-title" id="musicPlayerTitle">Restaurando música...</span></div>
        `;
        const titleElement = navTop.querySelector('.top-page-title');
        if (titleElement) {
            navTop.insertBefore(player, titleElement);
        } else {
            navTop.appendChild(player);
        }

        const playPauseBtn = player.querySelector('#musicPlayPauseBtn');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', (event) => {
                event.preventDefault();
                toggleMusicPlayback();
            });
        }
    }

    setMusicTrack(musicState.index, false);
    updateMusicUI();

    window.addEventListener('storage', syncMusicState);
    window.addEventListener('pagehide', saveMusicState);
    window.addEventListener('beforeunload', saveMusicState);
}

document.addEventListener('DOMContentLoaded', () => {
    initMusicPlayer();
});

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
    initMusicPlayer
};
