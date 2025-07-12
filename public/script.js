document.addEventListener('DOMContentLoaded', () => {
    // --- GLOBAL ELEMENTS & STATE ---
    const socket = io();
    const loginContainer = document.getElementById('login-container');
    const chatContainer = document.getElementById('chat-container');
    const loginCanvas = document.getElementById('login-canvas');
    const chatCanvas = document.getElementById('chat-canvas');
    const loginForm = document.getElementById('login-form');
    const loginButton = loginForm.querySelector('.btn-primary');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    const loginSubtitle = document.getElementById('login-subtitle');

    let savedUser = null;
    let codeEditor = null;
    let allChats = [];
    let activeChatIndex = -1;
    let isChatInitialized = false;
    let loginAnimationId, chatAnimationId;

    // --- ANIMATIONS ---
    function setupLoginAnimation() {
        if (loginAnimationId) return; // Don't restart if already running
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas: loginCanvas, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        const cubes = [];
        for (let i = 0; i < 250; i++) {
            const material = new THREE.MeshBasicMaterial({ color: 0x00bfff, wireframe: true, transparent: true, opacity: Math.random() * 0.4 + 0.1 });
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const cube = new THREE.Mesh(geometry, material);
            cube.position.set((Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80);
            const scale = Math.random() * 3 + 1;
            cube.scale.set(scale, scale, scale);
            cubes.push(cube);
            scene.add(cube);
        }
        camera.position.z = 15;
        function animate() {
            loginAnimationId = requestAnimationFrame(animate);
            scene.rotation.y += 0.0007;
            scene.rotation.x += 0.0002;
            renderer.render(scene, camera);
        }
        animate();
    }

    function setupChatAnimation() {
        if (chatAnimationId) return; // Don't restart
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas: chatCanvas, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        const starVertices = [];
        for (let i = 0; i < 15000; i++) { starVertices.push((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000); }
        const starGeometry = new THREE.BufferGeometry();
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7 }));
        scene.add(stars);
        camera.position.z = 1;
        function animate() {
            chatAnimationId = requestAnimationFrame(animate);
            stars.rotation.y += 0.0002;
            renderer.render(scene, camera);
        }
        animate();
    }

    // --- LOGIN LOGIC ---
    function setupLoginPage() {
        const storedUser = localStorage.getItem('santhuMathUser');
        if (storedUser) {
            savedUser = JSON.parse(storedUser);
            usernameInput.value = "Santhosh";
            usernameInput.disabled = true;
            loginSubtitle.textContent = `Welcome back, Santhosh.`;
        } else {
            savedUser = null;
            usernameInput.disabled = false;
            usernameInput.value = '';
            loginSubtitle.textContent = 'Create your account to begin.';
        }
        passwordInput.value = '';
        loginError.textContent = '';
    }

    function triggerEscapeAnimation() {
        if (loginButton.classList.contains('escaping')) return;
        loginButton.classList.add('escaping');
        const x = (Math.random() > 0.5 ? 1 : -1) * (window.innerWidth / 8);
        const y = (Math.random() - 0.5) * 100;
        loginButton.style.setProperty('--escape-x', `${x}px`);
        loginButton.style.setProperty('--escape-y', `${y}px`);
        setTimeout(() => { loginButton.classList.remove('escaping'); }, 300);
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        loginError.textContent = '';

        if (username === '' || password === '') {
            loginError.textContent = 'All fields are required.';
            triggerEscapeAnimation();
            return;
        }

        if (savedUser) {
            if (password === savedUser.password) {
                showChatPage();
            } else {
                loginError.textContent = 'Wrong password.';
                triggerEscapeAnimation();
            }
        } else {
            // For a new user, automatically set the name to Santhosh for personalization
            const userToSave = (username.toLowerCase() === 'santhosh') ? username : "Santhosh";
            savedUser = { username: userToSave, password };
            localStorage.setItem('santhuMathUser', JSON.stringify(savedUser));
            showChatPage();
        }
    });

    // --- PAGE TRANSITIONS ---
    function showLoginPage() {
        chatContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
        chatCanvas.classList.add('hidden');
        loginCanvas.classList.remove('hidden');
        setupLoginPage();
    }

    function showChatPage() {
        loginContainer.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        loginCanvas.classList.add('hidden');
        chatCanvas.classList.remove('hidden');
        
        if (!isChatInitialized) {
            initializeChatLogic();
            isChatInitialized = true;
        }
        loadHistoryFromStorage();
    }

    // --- CHAT LOGIC (INITIALIZED ONCE) ---
    function initializeChatLogic() {
        const logoutBtn = document.getElementById('logout-btn');
        const newChatBtn = document.getElementById('new-chat-btn');
        const historyList = document.getElementById('history-list');
        const chatForm = document.getElementById('chat-form');
        const answerMessages = document.getElementById('answer-messages');

        codeEditor = CodeMirror.fromTextArea(document.getElementById('message-input'), { lineNumbers: false, mode: 'javascript', theme: 'dracula', lineWrapping: true });
        
        logoutBtn.addEventListener('click', showLoginPage);
        newChatBtn.addEventListener('click', startNewChat);

        historyList.addEventListener('click', (e) => {
            const listItem = e.target.closest('li');
            if (!listItem) return;
            if (e.target.classList.contains('delete-chat-btn')) {
                e.stopPropagation(); // Prevent the chat from loading when deleting
                deleteChat(parseInt(listItem.dataset.index));
            } else {
                loadChat(parseInt(listItem.dataset.index));
            }
        });

        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const messageText = codeEditor.getValue();
            if (messageText.trim() && activeChatIndex > -1) {
                const currentChat = allChats[activeChatIndex];
                currentChat.messages.push({ role: 'user', text: messageText });
                if (currentChat.messages.length === 1 && currentChat.title.startsWith('New Chat')) {
                    currentChat.title = messageText.substring(0, 35);
                    renderHistoryList();
                }
                saveHistoryToStorage();
                answerMessages.innerHTML = `<div class="answer-message-wrapper"><div class="message-text">AI is thinking...</div></div>`;
                socket.emit('chat message', messageText);
                codeEditor.setValue('');
            }
        });

        socket.on('ai response', (response) => {
            if (activeChatIndex < 0) return;
            allChats[activeChatIndex].messages.push({ role: 'model', text: response });
            saveHistoryToStorage();
            displayAnswer(response);
        });

        function saveHistoryToStorage() { localStorage.setItem('santhuMathUserHistory', JSON.stringify(allChats)); }
        
        function loadHistoryFromStorage() {
            const storedHistory = localStorage.getItem('santhuMathUserHistory');
            allChats = storedHistory ? JSON.parse(storedHistory) : [];
            if (allChats.length === 0) startNewChat();
            else loadChat(0);
        }

        function renderHistoryList() {
            historyList.innerHTML = '';
            allChats.forEach((chat, index) => {
                const li = document.createElement('li');
                li.dataset.index = index;
                if (index === activeChatIndex) li.classList.add('active');
                const titleSpan = document.createElement('span');
                titleSpan.textContent = chat.title;
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-chat-btn';
                deleteBtn.innerHTML = '×';
                li.append(titleSpan, deleteBtn);
                historyList.appendChild(li);
            });
        }
        
        function deleteChat(indexToDelete) {
            allChats.splice(indexToDelete, 1);
            saveHistoryToStorage();
            if (allChats.length === 0) {
                startNewChat();
            } else {
                activeChatIndex = (activeChatIndex >= indexToDelete && activeChatIndex > 0) ? activeChatIndex - 1 : 0;
                loadChat(activeChatIndex);
            }
        }

        function startNewChat() {
            const newChat = { id: Date.now(), title: `New Chat ${allChats.length + 1}`, messages: [] };
            allChats.unshift(newChat);
            saveHistoryToStorage();
            loadChat(0);
        }

        function loadChat(index) {
            activeChatIndex = index;
            const chat = allChats[index];
            const lastMessage = chat.messages[chat.messages.length - 1];
            if (!lastMessage || lastMessage.role === 'user') {
                answerMessages.innerHTML = `<div class="placeholder-text">Your AI-generated answers will appear here.</div>`;
            } else {
                displayAnswer(lastMessage.text);
            }
            renderHistoryList();
        }

        function displayAnswer(text) {
            answerMessages.innerHTML = '';
            const wrapper = document.createElement('div');
            wrapper.className = 'answer-message-wrapper';
            const messageText = document.createElement('div');
            messageText.className = 'message-text';
            messageText.innerHTML = text;
            wrapper.appendChild(messageText);

            const controls = document.createElement('div');
            controls.className = 'answer-controls';
            const langSelector = document.createElement('select');
            langSelector.className = 'language-selector';
            const languages = { 'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German', 'hi': 'Hindi', 'ja': 'Japanese' };
            for (const [code, name] of Object.entries(languages)) { langSelector.innerHTML += `<option value="${code}">${name}</option>`; }
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn btn-secondary';
            copyBtn.textContent = 'Copy';
            controls.append(langSelector, copyBtn);
            wrapper.appendChild(controls);
            answerMessages.appendChild(wrapper);

            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(messageText.textContent).then(() => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
                });
            });

            langSelector.addEventListener('change', async (e) => {
                const targetLanguage = e.target.value;
                const originalText = allChats[activeChatIndex].messages.findLast(m => m.role === 'model').text;
                if (targetLanguage === 'en') { messageText.innerHTML = originalText; return; }
                messageText.innerHTML = 'Translating...';
                try {
                    const response = await fetch('/translate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: originalText, targetLanguage })
                    });
                    const data = await response.json();
                    messageText.innerHTML = data.translatedText || 'Translation failed.';
                } catch (err) { messageText.innerHTML = 'Error connecting to translation service.'; }
            });
        }
    }

    // --- INITIAL APP STARTUP ---
    setupLoginPage();
    setupLoginAnimation();
    setupChatAnimation();
});