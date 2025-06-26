// ALFREDISGONE DEADCAT THEME v4.0 - Harmonized JavaScript

(function() {
    'use strict';
    
    // Configuration
    const config = {
        matrixRainEnabled: true,
        consoleLogs: true,
        easterEggs: true,
        debugMode: true,
        memorialMessages: [
            "il a rendu l'âme",
            "jlui ai donné un ptit comprimé",
            "ça l'a calmé",
            "il doit être au paradis mais jsuis dégouté"
        ],
        matrixChars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+-=[]{}|;:,.<>?/~`",
        catAscii: {
            dead: ' /\\_/\\\n( x.x )\n > ^ <',
            rip: '  /\\_/\\\n ( x.x )\n  > ^ <\n |  |  |\n(__|__)'
        },
        readabilityModes: {
            full: 'Full Terminal Effects',
            balanced: 'Balanced (Reduced FX)',
            high: 'High Readability'
        }
    };
    
    // Readability System Manager
    class ReadabilityManager {
        constructor() {
            this.currentMode = localStorage.getItem('alfredisgone-readability') || 'full';
            this.init();
        }
        
        init() {
            this.applyMode(this.currentMode);
            if (config.debugMode) {
                console.log(`[READABILITY] Mode: ${this.currentMode}`);
            }
        }
        
        applyMode(mode) {
            document.body.classList.remove('readability-full', 'readability-balanced', 'readability-high');
            if (mode !== 'full') {
                document.body.classList.add(`readability-${mode}`);
            }
            this.currentMode = mode;
            localStorage.setItem('alfredisgone-readability', mode);
        }
        
        toggleMode() {
            const modes = ['full', 'balanced', 'high'];
            const currentIndex = modes.indexOf(this.currentMode);
            const nextMode = modes[(currentIndex + 1) % modes.length];
            this.applyMode(nextMode);
            this.showNotification(`Readability: ${config.readabilityModes[nextMode]}`);
        }
        
        showNotification(message) {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--terminal-green);
                color: var(--terminal-black);
                padding: 10px 20px;
                font-weight: bold;
                z-index: 10001;
                border: 2px solid var(--terminal-black);
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => notification.remove(), 3000);
        }
    }
    
    // Matrix Rain Implementation (Fixed)
    function initMatrixRain() {
        if (!config.matrixRainEnabled) return;
        
        // Check if body has readability-high class
        if (document.body.classList.contains('readability-high')) {
            if (config.debugMode) {
                console.log('[MATRIX] Disabled in high readability mode');
            }
            return;
        }
        
        if (config.debugMode) {
            console.log('[DEBUG] Initializing matrix rain...');
        }
        
        let canvas = document.getElementById('matrix-rain');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'matrix-rain';
            document.body.insertBefore(canvas, document.body.firstChild);
            if (config.debugMode) {
                console.log('[DEBUG] Canvas created');
            }
        }
        
        const ctx = canvas.getContext('2d');
        
        // Set canvas size
        function setCanvasSize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        setCanvasSize();
        window.addEventListener('resize', setCanvasSize);
        
        // Matrix rain variables
        const fontSize = 12;
        const columns = Math.floor(canvas.width / fontSize);
        const drops = Array(columns).fill(0);
        const messageDrops = Array(columns).fill(null);
        let frameCount = 0;
        
        // Draw matrix rain
        function draw() {
            frameCount++;
            
            // Fade effect
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.font = fontSize + 'px monospace';
            
            for (let i = 0; i < drops.length; i++) {
                const x = i * fontSize;
                const y = drops[i] * fontSize;
                
                // Occasionally show memorial messages
                if (Math.random() > 0.995 && !messageDrops[i]) {
                    messageDrops[i] = {
                        message: config.memorialMessages[Math.floor(Math.random() * config.memorialMessages.length)],
                        charIndex: 0,
                        y: y
                    };
                }
                
                // Draw memorial message or regular matrix char
                if (messageDrops[i] && messageDrops[i].charIndex < messageDrops[i].message.length) {
                    ctx.fillStyle = '#ffb000'; // Amber for messages
                    ctx.fillText(messageDrops[i].message[messageDrops[i].charIndex], x, messageDrops[i].y);
                    messageDrops[i].charIndex++;
                    messageDrops[i].y += fontSize;
                    
                    if (messageDrops[i].charIndex >= messageDrops[i].message.length) {
                        messageDrops[i] = null;
                    }
                } else {
                    // Matrix green for regular chars
                    ctx.fillStyle = '#00ff41';
                    const char = config.matrixChars[Math.floor(Math.random() * config.matrixChars.length)];
                    ctx.fillText(char, x, y);
                }
                
                // Reset drop
                if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
            
            // Debug output every 60 frames (1 second at 60fps)
            if (config.debugMode && frameCount % 60 === 0) {
                console.log(`[MATRIX] Running... Frame: ${frameCount}`);
            }
        }
        
        const animationId = setInterval(draw, 50);
        
        // Store animation ID for cleanup
        window.matrixRainAnimation = animationId;
        
        if (config.consoleLogs) {
            console.log('%c[MATRIX] Rain initialized with memorial messages', 'color: #00ff00;');
        }
    }
    
    // Console Messages
    function initConsoleMessages() {
        if (!config.consoleLogs) return;
        
        console.log('%c╔══════════════════════════════════════════════╗', 'color: #00ff00;');
        console.log('%c║     ALFREDISGONE DEADCAT THEME v4.0          ║', 'color: #00ff00; font-weight: bold;');
        console.log('%c║     Harmonized Terminal Memorial             ║', 'color: #00ff00;');
        console.log('%c╚══════════════════════════════════════════════╝', 'color: #00ff00;');
        console.log('%c[SYSTEM] Theme loaded successfully', 'color: #00ff00;');
        console.log('%c[MEMORIAL] Alfred - "il doit être au paradis"', 'color: #ffb000;');
        console.log('%c[STATUS] CAT_PROCESS_TERMINATED', 'color: #00ff00;');
        console.log('%c[EXIT_CODE] 9_LIVES_EXCEEDED', 'color: #ff0040; font-weight: bold;');
        console.log('%c[READABILITY] Press Ctrl+Shift+R to toggle modes', 'color: #00ffff;');
        
        // Random memorial message every 30 seconds
        setInterval(() => {
            const msg = config.memorialMessages[Math.floor(Math.random() * config.memorialMessages.length)];
            console.log(`%c[MEMORIAL] ${msg}`, 'color: #ffb000; font-style: italic;');
        }, 30000);
    }
    
    // Force Terminal Green Cat Colors
    function enforceTerminalGreenCat() {
        const catElements = document.querySelectorAll('pre');
        catElements.forEach(el => {
            const text = el.textContent || el.innerText;
            if (text.includes('x.x') || text.includes('X.X') || text.includes('R.I.P')) {
                el.style.color = '#00ff00'; // Terminal green
                el.style.textShadow = '0 0 10px #00ff00, 0 0 20px #00ff00';
                el.classList.add('dead-cat-ascii');
            }
        });
    }
    
    // Add Mini Floating Cat
    function addMiniCat() {
        if (document.querySelector('.mini-dead-cat')) return;
        
        const miniCat = document.createElement('pre');
        miniCat.className = 'mini-dead-cat';
        miniCat.textContent = config.catAscii.dead;
        miniCat.title = 'Alfred - Forever in our hearts';
        document.body.appendChild(miniCat);
    }
    
    // Add Exit Code Easter Egg
    function addExitCode() {
        if (document.querySelector('.exit-code')) return;
        
        const exitCode = document.createElement('div');
        exitCode.className = 'exit-code';
        exitCode.textContent = '[EXIT_CODE: 9_LIVES_EXCEEDED]';
        document.body.appendChild(exitCode);
    }
    
    // Terminal Effects
    function addTerminalEffects() {
        // Add terminal window class to main containers
        const mainContainers = ['#main_results', '#main_index', '#main_preferences', '#main_about', '#main_stats'];
        mainContainers.forEach(selector => {
            const container = document.querySelector(selector);
            if (container && !container.querySelector('.terminal-window')) {
                container.classList.add('terminal-window');
                
                // Add terminal header
                const header = document.createElement('div');
                header.className = 'terminal-header';
                const pageName = selector.replace('#main_', '').toUpperCase();
                header.innerHTML = `
                    <span>ALFREDISGONE.EXE - ${pageName === 'INDEX' ? 'FELINE_MONITOR_v3.1.337' : pageName}</span>
                    <span>[■][□][×]</span>
                `;
                container.insertBefore(header, container.firstChild);
            }
        });
        
        // Add terminal body wrapper
        const searchForm = document.querySelector('#search_form');
        if (searchForm && !searchForm.querySelector('.search-prompt')) {
            const searchInput = searchForm.querySelector('#q');
            if (searchInput) {
                const wrapper = document.createElement('div');
                wrapper.className = 'search-prompt';
                searchInput.parentNode.insertBefore(wrapper, searchInput);
                wrapper.appendChild(searchInput);
            }
        }
    }
    
    // Easter Eggs
    function initEasterEggs() {
        if (!config.easterEggs) return;
        
        let keyBuffer = '';
        let konamiBuffer = '';
        const konamiCode = 'ArrowUpArrowUpArrowDownArrowDownArrowLeftArrowRightArrowLeftArrowRightba';
        
        // Initialize readability manager
        const readabilityManager = new ReadabilityManager();
        
        document.addEventListener('keydown', (e) => {
            // Konami code detection
            konamiBuffer += e.key;
            if (konamiBuffer.length > konamiCode.length) {
                konamiBuffer = konamiBuffer.slice(-konamiCode.length);
            }
            
            if (konamiBuffer === konamiCode) {
                activateKonamiEasterEgg();
                konamiBuffer = '';
            }
            
            // Readability toggle (Ctrl+Shift+R)
            if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                readabilityManager.toggleMode();
            }
        });
        
        document.addEventListener('keypress', (e) => {
            // "flip" easter egg
            keyBuffer += e.key;
            if (keyBuffer.length > 4) {
                keyBuffer = keyBuffer.slice(-4);
            }
            
            if (keyBuffer === 'flip') {
                flipCats();
                keyBuffer = '';
            }
            
            // "meow" easter egg
            if (keyBuffer.endsWith('meow')) {
                catMeow();
                keyBuffer = '';
            }
        });
    }
    
    function flipCats() {
        const cats = document.querySelectorAll('.dead-cat-ascii, .mini-dead-cat, pre');
        cats.forEach(cat => {
            if (cat.textContent.includes('x.x') || cat.textContent.includes('X.X')) {
                cat.style.transform = cat.style.transform === 'rotate(180deg)' ? 'none' : 'rotate(180deg)';
                cat.style.transition = 'transform 0.5s ease-in-out';
            }
        });
        
        if (config.consoleLogs) {
            console.log('%c[EASTER_EGG] Cats flipped! 🙃', 'color: #ff00ff; font-size: 16px;');
        }
    }
    
    function catMeow() {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE');
        audio.volume = 0.1;
        audio.play().catch(() => {});
        
        // Show meow message
        const meowMsg = document.createElement('div');
        meowMsg.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #00ff00;
            font-size: 48px;
            font-weight: bold;
            z-index: 10000;
            pointer-events: none;
            animation: fadeOut 2s ease-out forwards;
            text-shadow: 0 0 20px currentColor;
        `;
        meowMsg.textContent = 'MEOW!';
        document.body.appendChild(meowMsg);
        
        setTimeout(() => meowMsg.remove(), 2000);
        
        if (config.consoleLogs) {
            console.log('%c[EASTER_EGG] Ghost cat says MEOW! 👻🐱', 'color: #00ff00; font-size: 16px;');
        }
    }
    
    function activateKonamiEasterEgg() {
        document.body.style.animation = 'rainbow 2s linear infinite';
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes rainbow {
                0% { filter: hue-rotate(0deg); }
                100% { filter: hue-rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
        
        // Terminal-style hack message
        const hackMsg = document.createElement('div');
        hackMsg.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #00ff00;
            font-size: 32px;
            font-weight: bold;
            text-align: center;
            z-index: 10000;
            pointer-events: none;
            font-family: monospace;
            text-shadow: 0 0 20px currentColor;
        `;
        hackMsg.innerHTML = 'HACK THE PLANET!<br><span style="font-size: 16px;">Alfred approves</span>';
        document.body.appendChild(hackMsg);
        
        if (config.consoleLogs) {
            console.log('%c[KONAMI] 🌈 HACK THE PLANET! 🌈', 'color: #00ff00; font-size: 20px; font-weight: bold;');
        }
        
        setTimeout(() => {
            document.body.style.animation = '';
            style.remove();
            hackMsg.remove();
        }, 10000);
    }
    
    // Search Form Enhancements
    function enhanceSearchForm() {
        const searchInput = document.querySelector('#q');
        if (!searchInput) return;
        
        // Add cursor after input
        const cursor = document.createElement('span');
        cursor.className = 'cursor';
        cursor.style.marginLeft = '2px';
        searchInput.parentNode.insertBefore(cursor, searchInput.nextSibling);
        
        // Terminal-style placeholder cycling
        const placeholders = [
            'enter search query...',
            'cat /dev/search...',
            'grep -r "alfred"...',
            'find / -name "cat"...',
            'sudo search --meow...',
            './locate_cat.sh...',
            'ps aux | grep alfred...'
        ];
        
        let placeholderIndex = 0;
        setInterval(() => {
            if (searchInput && !searchInput.value) {
                searchInput.placeholder = placeholders[placeholderIndex];
                placeholderIndex = (placeholderIndex + 1) % placeholders.length;
            }
        }, 3000);
    }
    
    // Add Readability Mode UI (for preferences page)
    function addReadabilityUI() {
        const preferencesContainer = document.querySelector('.preferences-container');
        if (!preferencesContainer) return;
        
        const readabilitySection = document.createElement('div');
        readabilitySection.className = 'readability-selector';
        readabilitySection.innerHTML = `
            <h3>TERMINAL READABILITY MODE</h3>
            <div class="readability-option ${localStorage.getItem('alfredisgone-readability') === 'full' ? 'active' : ''}" data-mode="full">
                <strong>Full Terminal Effects</strong><br>
                <small>All animations, effects, and glows enabled</small>
            </div>
            <div class="readability-option ${localStorage.getItem('alfredisgone-readability') === 'balanced' ? 'active' : ''}" data-mode="balanced">
                <strong>Balanced Mode</strong><br>
                <small>Reduced animations for better readability</small>
            </div>
            <div class="readability-option ${localStorage.getItem('alfredisgone-readability') === 'high' ? 'active' : ''}" data-mode="high">
                <strong>High Readability</strong><br>
                <small>Minimal effects for maximum clarity</small>
            </div>
            <p style="margin-top: 15px; font-size: 12px; color: var(--terminal-amber);">
                Tip: Press Ctrl+Shift+R anywhere to toggle modes
            </p>
        `;
        
        preferencesContainer.insertBefore(readabilitySection, preferencesContainer.firstChild);
        
        // Add click handlers
        const options = readabilitySection.querySelectorAll('.readability-option');
        options.forEach(option => {
            option.addEventListener('click', () => {
                const mode = option.dataset.mode;
                const readabilityManager = new ReadabilityManager();
                readabilityManager.applyMode(mode);
                
                // Update active states
                options.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
            });
        });
    }
    
    // Initialize everything when DOM is ready
    function init() {
        // Initialize core features
        enforceTerminalGreenCat();
        addMiniCat();
        addExitCode();
        addTerminalEffects();
        initEasterEggs();
        enhanceSearchForm();
        addReadabilityUI();
        initConsoleMessages();
        
        // Initialize matrix rain with a slight delay to ensure DOM is ready
        setTimeout(() => {
            initMatrixRain();
        }, 100);
        
        // Re-run color enforcement periodically for dynamic content
        setInterval(enforceTerminalGreenCat, 1000);
        
        // Debug check
        if (config.debugMode) {
            setTimeout(() => {
                const canvas = document.getElementById('matrix-rain');
                if (canvas) {
                    console.log('[DEBUG] Canvas found:', canvas);
                    console.log('[DEBUG] Canvas dimensions:', canvas.width, 'x', canvas.height);
                    console.log('[DEBUG] Canvas opacity:', window.getComputedStyle(canvas).opacity);
                } else {
                    console.log('[DEBUG] Canvas NOT found!');
                }
            }, 500);
        }
    }
    
    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Export for debugging
    window.DEADCAT = {
        config: config,
        flipCats: flipCats,
        catMeow: catMeow,
        reinitMatrix: initMatrixRain,
        version: '4.0-harmonized'
    };
})();
