/* ========================================
   Centipede-RTK Web Serial - JavaScript for index.html (beginner mode)
   ======================================== */

// Set config source for this page
window.CONFIG_SOURCE = 'user';

// bascule Débutant -> Avancé
document.addEventListener('DOMContentLoaded', () => {
    const sw = document.getElementById('modeSwitch');
    if (!sw) return;
    // Sur la page Débutant, le toggle doit être en position "Débutant" (OFF)
    sw.checked = false;
    sw.addEventListener('change', () => {
        if (sw.checked) {
            // Aller vers l’UI avancée
            window.location.href = 'index_advanced.html';
        }
    });
});

// Variables specific to beginner mode
let currentConfig = '';
let isConnected = false;
let terminalVisible = false;

/* ---------------------- UI Functions ---------------------- */
function updateStatus(message, type = 'info') {
    const statusEl = $('#status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
}

function showProgress(show = true) {
    const container = $('#progressContainer');
    if (show) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
        // Also hide terminal when hiding progress bar
        $('#uartTerminal').classList.add('hidden');
        terminalVisible = false;
    }
}

function updateProgress(percentage, text) {
    $('#progressFill').style.width = percentage + '%';
    $('#progressText').textContent = text;
}

function toggleTerminal() {
    const terminal = $('#uartTerminal');
    terminalVisible = !terminalVisible;

    if (terminalVisible) {
        terminal.classList.remove('hidden');
    } else {
        terminal.classList.add('hidden');
    }
}

function addToTerminal(message, type = 'info') {
    const terminal = $('#uartTerminal');
    const timestamp = new Date().toLocaleTimeString('fr-FR', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
    });

    let prefix = '';
    let cssClass = '';

    switch (type) {
        case 'sent':
            prefix = '→ TX: ';
            cssClass = 'sent';
            break;
        case 'received':
            prefix = '← RX: ';
            cssClass = 'received';
            break;
        default:
            prefix = '• ';
            break;
    }

    const line = document.createElement('div');
    line.innerHTML = `<span class="timestamp">[${timestamp}]</span> <span class="${cssClass}">${prefix}${escapeHtml(message)}</span>`;
    terminal.appendChild(line);

    // Auto-scroll to bottom
    terminal.scrollTop = terminal.scrollHeight;
}

function clearTerminal() {
    $('#uartTerminal').innerHTML = '';
}

/* ---------------------- Welcome Message ---------------------- */
function showWelcomeMessage() {
    // Vérifier si le message n'existe pas déjà
    if (document.getElementById('welcomeContainer')) {
        return;
    }

    // Créer le container de bienvenue
    const welcomeContainer = document.createElement('div');
    welcomeContainer.id = 'welcomeContainer';
    welcomeContainer.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        margin: 20px 0;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        animation: slideIn 0.5s ease-out;
        position: relative;
    `;

    // Ajouter le bouton de fermeture
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 15px;
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.3s;
    `;

    closeButton.onmouseover = () => {
        closeButton.style.backgroundColor = 'rgba(255,255,255,0.2)';
    };

    closeButton.onmouseout = () => {
        closeButton.style.backgroundColor = 'transparent';
    };

    closeButton.onclick = () => {
        welcomeContainer.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            welcomeContainer.remove();
        }, 300);
    };

    // Contenu du message
    const content = document.createElement('div');
    content.innerHTML = `
        <h2 style="margin-top: 0; margin-bottom: 15px; color: #fff;">
            Bienvenue dans Centipede Web Serial
        </h2>
        <p style="margin-bottom: 12px; line-height: 1.6;">
            <strong>Centipede Web Serial</strong> est un outil de configuration pour les récepteurs GNSS/RTK. 
            Il vous permet de configurer facilement vos équipements via une interface web moderne dont NavX.
        </p>
        <p style="margin-bottom: 12px; line-height: 1.6;">
            <strong>⚠️ Compatibilité :</strong> Cette application fonctionne uniquement sur <strong>Chrome/Chromium</strong> 
            en raison des limitations de l'API Web Serial.
        </p>
        <p style="margin-bottom: 12px; line-height: 1.6;">
            <strong>💡 Astuce :</strong> Pour obtenir des informations détaillées sur les différentes configurations disponibles, 
            sélectionnez-les dans le menu déroulant "Choisir un fichier". Une description apparaîtra automatiquement.
        </p>
    `;

    welcomeContainer.appendChild(closeButton);
    welcomeContainer.appendChild(content);

    // Ajouter les animations CSS si elles n'existent pas
    if (!document.getElementById('welcomeStyles')) {
        const style = document.createElement('style');
        style.id = 'welcomeStyles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateY(-20px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateY(0);
                    opacity: 1;
                }
                to {
                    transform: translateY(-20px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Insérer avant le main-container
    const mainContainer = document.querySelector('.main-container') || document.querySelector('main') || document.body;
    mainContainer.parentNode.insertBefore(welcomeContainer, mainContainer);
}

/* ---------------------- Configuration Management ---------------------- */
function displayConfigDescription(description) {
    const container = $('#configDescriptionContainer');
    const descElement = $('#configDescription');

    if (!description) {
        container.style.display = 'none';
        return;
    }

    let html = '';
    if (description.title) {
        html += `<h4>${convertUrlsToLinks(escapeHtml(description.title))}</h4>`;
    }

    if (description.details.length > 0) {
        description.details.forEach(detail => {
            html += `<p>${convertUrlsToLinks(escapeHtml(detail))}</p>`;
        });
    }

    descElement.innerHTML = html;
    container.style.display = 'block';
}

/* ---------------------- Event Handlers ---------------------- */
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize configuration list
    try {
        const result = await populateConfigSelect(false);
        if (result[0].length > 0) {
            updateStatus(`${result[0].length} configuration file(s) found via ${result[1]}`, 'success');
        } else {
            updateStatus('Unable to list conf_files/ (auto-index or API). Use the "personal file" button.', 'info');
        }
    } catch (e) {
        console.log(e);
        updateStatus('Error loading configurations', 'error');
    }

    // Afficher le message de bienvenue après 2 secondes
    setTimeout(() => {
        showWelcomeMessage();
    }, 500);
});

// Toggle settings modal
$('#settingsToggle').onclick = () => {
    const modal = $('#settingsModal');
    modal.classList.add('active');
};

// Toggle terminal
$('#terminalToggle').onclick = () => {
    toggleTerminal();
};

// Close modal
$('#closeModal').onclick = () => {
    const modal = $('#settingsModal');
    modal.classList.remove('active');
};

// Close modal when clicking on backdrop
$('#settingsModal').onclick = (e) => {
    if (e.target === $('#settingsModal')) {
        $('#settingsModal').classList.remove('active');
    }
};

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        $('#settingsModal').classList.remove('active');
    }
});

// Refresh list
$('#refreshList').onclick = () => populateConfigSelect(true);

// Configuration select
$('#configSelect').onchange = async (ev) => {
    const url = ev.target.value;
    if (!url) {
        currentConfig = '';
        $('#upload').disabled = true;
        displayConfigDescription(null);
        return;
    }
    try {
        updateStatus('Loading configuration...', 'info');
        const result = await loadConfigFromUrl(url);
        currentConfig = result.content;
        $('#upload').disabled = !isConnected;
        updateStatus('Configuration loaded: ' + url.split('/').pop(), 'success');

        // Extract and display description
        const description = extractConfigDescription(result.content);
        displayConfigDescription(description);
    } catch (e) {
        updateStatus(e.message, 'error');
        currentConfig = '';
        $('#upload').disabled = true;
        displayConfigDescription(null);
    }
};

// Personal file
$('#configFile').onchange = async (ev) => {
    const f = ev.target.files?.[0];
    if (!f) {
        currentConfig = '';
        $('#upload').disabled = true;
        displayConfigDescription(null);
        return;
    }
    try {
        updateStatus('Loading file...', 'info');
        const result = await loadConfigFromFile(f);
        currentConfig = result.content;
        $('#configSelect').value = ''; // deselect conf_files menu
        $('#upload').disabled = !isConnected;
        updateStatus('File loaded: ' + result.filename, 'success');

        // Extract and display description
        const description = extractConfigDescription(result.content);
        displayConfigDescription(description);
    } catch (e) {
        updateStatus(e.message, 'error');
        currentConfig = '';
        $('#upload').disabled = true;
        displayConfigDescription(null);
    }
};

/* ---------------------- Serial Communication ---------------------- */
$('#connect').onclick = async () => {
    try {
        updateStatus('Connecting...', 'info');

        const result = await connectSerial();

        // Beginner mode specific read loop
        (async function readLoop() {
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    // Display received data in terminal if visible
                    if (value && value.length > 0) {
                        addToTerminal(value, 'received');
                    }
                }
            } catch (e) {
                updateStatus('Read error: ' + e.message, 'error');
            }
        })();

        isConnected = true;
        $('#connect').classList.add('hidden');
        $('#disconnect').classList.remove('hidden');
        $('#disconnect').disabled = false;
        $('#upload').disabled = !currentConfig;
        updateStatus(`Connected @ ${result.baudRate} baud`, 'success');
    } catch (e) {
        updateStatus('Connection error: ' + (e?.message || e), 'error');
    }
};

$('#disconnect').onclick = async () => {
    try {
        await disconnectSerial();

        isConnected = false;
        $('#connect').classList.remove('hidden');
        $('#disconnect').classList.add('hidden');
        $('#disconnect').disabled = true;
        $('#upload').disabled = true;
        showProgress(false);
        updateStatus('Disconnected', 'info');
    } catch (e) {
        updateStatus('Disconnection error: ' + (e?.message || e), 'error');
    }
};

/* ---------------------- Upload Commands ---------------------- */
$('#upload').onclick = async () => {
    if (!writer) {
        updateStatus('Not connected.', 'error');
        return;
    }
    if (!currentConfig) {
        updateStatus('No configuration loaded.', 'error');
        return;
    }
    if (sendingBatch) {
        updateStatus('Sending already in progress. Please wait...', 'info');
        return;
    }

    const lines = currentConfig.split('\n')
        .map(s => s.trim())
        .filter(s => s.length && !s.startsWith('#') && !s.startsWith('//') && !s.startsWith(';'));

    if (!lines.length) {
        updateStatus('No valid commands in configuration.', 'error');
        return;
    }

    const delaySec = Math.max(0, parseFloat($('#delay').value || '5') || 5);
    const eol = getEOL();

    sendingBatch = true;
    $('#upload').disabled = true;
    showProgress(true);

    try {
        updateStatus(`Sending ${lines.length} command(s)...`, 'info');
        updateProgress(0, 'Starting...');

        // Clear terminal and add start message
        clearTerminal();
        addToTerminal(`=== Starting configuration (${lines.length} commands) ===`);

        for (let i = 0; i < lines.length; i++) {
            const cmd = lines[i];
            await writer.write(cmd + eol);

            // Display sent command in terminal
            addToTerminal(cmd + eol.replace(/\n/g, '\\n').replace(/\r/g, '\\r'), 'sent');

            const progress = ((i + 1) / lines.length) * 100;
            updateProgress(progress, `Command ${i + 1}/${lines.length}: ${cmd.substring(0, 30)}${cmd.length > 30 ? '...' : ''}`);

            if (i < lines.length - 1) {
                await sleep(delaySec * 1000);
            }
        }

        updateProgress(100, 'Configuration sent successfully!');
        updateStatus('Configuration sent successfully!', 'success');
        addToTerminal('=== End of configuration ===');

        // Hide progress bar after 3 seconds
        setTimeout(() => showProgress(false), 3000);
    } catch (e) {
        updateStatus('Error during sending: ' + (e?.message || e), 'error');
        showProgress(false);
    } finally {
        sendingBatch = false;
        $('#upload').disabled = !currentConfig || !isConnected;
    }
};

$('#save').onclick = async () => {
    try {
        const result = await sendSaveConfig();
        addToTerminal(result.command.replace(/\n/g, '\\n').replace(/\r/g, '\\r'), 'sent');
        updateStatus('SAVECONFIG command sent', 'success');
    } catch (e) {
        updateStatus(e.message, 'error');
    }
};
