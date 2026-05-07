(async function() {
    const containerClass = 'div.c-image';

    // 🎯 ИЗМЕНЕНИЕ 1: Извлекаем ID из ссылки КиноПоиска, а не из location.href
    function extractIdFromLinkElement() {
        const linkElement = document.querySelector('.b-external_link.kinopoisk.b-menu-line');
        if (!linkElement) return null;
        
        const a = linkElement.querySelector('a');
        if (!a) return null;
        
        // Извлекаем ID из href, например https://www.kinopoisk.ru/series/5401195/
        const match = a.href.match(/(?:film|series)\/([a-z0-9]+)/i);
        return match ? match[1] : null;
    }

    function createButton() {
        const button = document.createElement('a');
        button.className = 'b-link_button dark';
        button.href = '#';
        button.textContent = '▶ Смотреть';
        button.style.marginLeft = '8px';
        return button;
    }

    function createIframe(src) {
        const iframe = document.createElement('iframe');
        iframe.src = src;
        iframe.allowFullscreen = true;
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        iframe.style.borderRadius = "12px";
        return iframe;
    }

    function createModal(players) {
        const overlay = document.createElement('div');
        overlay.className = "kino-overlay";

        const modal = document.createElement('div');
        modal.className = "kino-modal";

        const closeBtn = document.createElement('div');
        closeBtn.className = "kino-close";
        closeBtn.innerHTML = "✕";

        let currentSrc = players[0]?.translations?.[0]?.iframeUrl || players[0]?.iframeUrl;
        const playerWrapper = document.createElement('div');
        playerWrapper.className = "kino-player";

        const iframe = createIframe(currentSrc);
        playerWrapper.appendChild(iframe);

        const controls = document.createElement('div');
        controls.className = "kino-controls";

        players.forEach(player => {
            const btn = document.createElement('button');
            btn.className = "kino-player-btn";
            btn.textContent = player.type;

            btn.onclick = () => {
                const newSrc = player.translations?.[0]?.iframeUrl || player.iframeUrl;
                if (!newSrc) return;

                const newIframe = createIframe(newSrc);
                playerWrapper.innerHTML = '';
                playerWrapper.appendChild(newIframe);
            };

            controls.appendChild(btn);
        });

        modal.appendChild(closeBtn);
        modal.appendChild(playerWrapper);
        modal.appendChild(controls);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        closeBtn.onclick = () => overlay.remove();
        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.remove();
        };
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            .kino-overlay {
                position: fixed;
                top:0; left:0;
                width:100%;
                height:100%;
                background: rgba(0,0,0,0.85);
                display:flex;
                align-items:center;
                justify-content:center;
                z-index:99999;
            }

            .kino-modal {
                width: 80%;
                max-width: 1600px;
                height: 70%;
                max-heigth: 900px;
                background: #000;
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                position: relative;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            }

            .kino-player {
                flex: 1;
                background: black;
            }
			
            .kino-controls {
                display: flex;
                gap: 8px;
                padding: 10px;
                background: #111;
                overflow-x: auto;
            }

            .kino-player-btn {
                padding: 8px 12px;
                border-radius: 6px;
                border: none;
                background: #222;
                color: white;
                cursor: pointer;
                white-space: nowrap;
                transition: 0.2s;
            }

            .kino-player-btn:hover {
                background: #e50914;
            }

        `;
        document.head.appendChild(style);
    }

    async function init() {
        injectStyles();

        const container = document.querySelector(containerClass); 
        if (!container) return;

        // 🎯 ИЗМЕНЕНИЕ 2: Используем extractIdFromLinkElement() вместо extractIdFromUrl(location.href)
        const movieId = extractIdFromLinkElement();
        if (!movieId) return;

        const apiUrl = `https://fbphdplay.top/api/players?kinopoisk=${movieId}`;

        try {
            const res = await fetch(apiUrl);
            const data = await res.json();
            const players = data?.data;

            if (!players?.length) return;

            const button = createButton();

            button.onclick = (e) => {
                e.preventDefault();
                createModal(players);
            };

            container.appendChild(button);

        } catch (e) {
            console.error(e);
        }
    }

    init();
})();
