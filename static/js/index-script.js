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
// Buffer used to assemble complete incoming lines for the beginner terminal
let recvBuffer = '';
// Minimum delay after each command (ms)
const MIN_INTER_COMMAND_DELAY_MS = 500;
// Pending resolvers for the 'wait for next received message' feature
let pendingReceivedResolvers = [];

function isNmeaLine(message) {
    return typeof message === 'string' && /^\$[A-Z]{5},/.test(message);
}

function updateTransportUi() {
    const transport = $('#transport')?.value || 'serial';
    const baudEl = $('#baud');
    if (baudEl) {
        baudEl.disabled = (transport === 'ble');
    }
    const nameEl = $('#deviceName');
    if (nameEl && transport === 'serial') nameEl.textContent = '—';
}

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
    const isNmea = (type === 'received' && isNmeaLine(message));
    const shouldRender = !(type === 'received' && sendingBatch && isNmea);
    if (!isNmea && shouldRender) {
        console.log(`[Terminal ${type}] ${message}`);
    }
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

    if (shouldRender) {
        const line = document.createElement('div');
        line.innerHTML = `<span class="timestamp">[${timestamp}]</span> <span class="${cssClass}">${prefix}${escapeHtml(message)}</span>`;
        terminal.appendChild(line);

        // Auto-scroll to bottom
        terminal.scrollTop = terminal.scrollHeight;
    }

    // If a 'received' message arrives, resolve the first matching pending waiter (if any)
    if (type === 'received' && pendingReceivedResolvers.length) {
        const idx = pendingReceivedResolvers.findIndex(w => {
            try { return !w.predicate || w.predicate(String(message)); } catch { return false; }
        });
        if (idx >= 0) {
            const waiter = pendingReceivedResolvers.splice(idx, 1)[0];
            try { clearTimeout(waiter.timer); } catch { }
            try { waiter.resolve(message); } catch { }
        }
    }
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
            Bienvenue dans Centipede-RTK Web Serial
        </h2>
        <p style="margin-bottom: 12px; line-height: 1.6;">
            <strong>Centipede-RTK Web Serial</strong> est un outil de configuration pour les récepteurs GNSS/RTK. 
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

/**
 * Return true when welcome message should be disabled via URL param
 * Example: ?disable_help=true or ?disable_help=1
 */
function isWelcomeDisabledByUrl() {
    try {
        const p = new URLSearchParams(window.location.search).get('disable_help');
        if (!p) return false;
        const v = String(p).toLowerCase();
        return (v === 'true' || v === '1' || v === 'yes');
    } catch (e) {
        return false;
    }
}

/**
 * Wait for the next received message (promise resolved by addToTerminal when a 'received' arrives)
 * If timeoutMs is provided, it rejects after timeout
 */
function waitForNextReceived(timeoutMs) {
    return new Promise((resolve, reject) => {
        // Guard: if there is no reader, reject immediately
        if (!reader) {
            return reject(new Error('No reader available'));
        }

        const id = Symbol('waiter');
        const timer = (typeof timeoutMs === 'number' && timeoutMs > 0) ? setTimeout(() => {
            // remove resolver
            pendingReceivedResolvers = pendingReceivedResolvers.filter(w => w.id !== id);
            reject(new Error('timeout'));
        }, timeoutMs) : null;

        pendingReceivedResolvers.push({ id, resolve, reject, timer, predicate: () => true });
    });
}

/**
 * Wait for the next received message that matches the provided RegExp (or string), with optional timeout
 */
function waitForReceivedMatching(regexOrStr, timeoutMs) {
    const re = (regexOrStr instanceof RegExp) ? regexOrStr : new RegExp(String(regexOrStr), 'i');
    return new Promise((resolve, reject) => {
        if (!reader) return reject(new Error('No reader available'));
        const id = Symbol('waiter');
        const timer = (typeof timeoutMs === 'number' && timeoutMs > 0) ? setTimeout(() => {
            pendingReceivedResolvers = pendingReceivedResolvers.filter(w => w.id !== id);
            reject(new Error('timeout'));
        }, timeoutMs) : null;
        pendingReceivedResolvers.push({ id, resolve, reject, timer, predicate: (m) => re.test(String(m)) });
    });
}

/**
 * Wait for a sequence of messages (each matched by a regex or string) in order.
 * Returns true if the full sequence matched within overallTimeoutMs, false otherwise.
 */
async function waitForSequence(patterns, overallTimeoutMs, perMessageTimeoutMs) {
    const start = Date.now();
    for (const pat of patterns) {
        const elapsed = Date.now() - start;
        const remaining = overallTimeoutMs ? Math.max(0, overallTimeoutMs - elapsed) : perMessageTimeoutMs;
        if (remaining <= 0) return false;
        try {
            await waitForReceivedMatching(pat, Math.min(perMessageTimeoutMs, remaining));
        } catch (e) {
            return false;
        }
    }
    return true;
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

    // Afficher le message de bienvenue après 500 ms (sauf si désactivé via ?disable_help=true)
    if (!isWelcomeDisabledByUrl()) {
        setTimeout(() => {
            showWelcomeMessage();
        }, 500);
    }

    const transportSel = $('#transport');
    if (transportSel) {
        transportSel.addEventListener('change', updateTransportUi);
        updateTransportUi();
    }
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

        const result = await connectTransport();

        // Beginner mode specific read loop
        (async function readLoop() {
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    // Buffer incoming data and display complete lines only
                    if (value && value.length > 0) {
                        recvBuffer += value;
                        const parts = recvBuffer.split(/\r\n|\n/);
                        recvBuffer = parts.pop(); // remainder
                        for (const part of parts) {
                            if (part.length) addToTerminal(part, 'received');
                        }
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
        if (result?.transport === 'ble') {
            const nameEl = $('#deviceName');
            if (nameEl) nameEl.textContent = result.deviceName || 'BLE device';
            updateStatus(`Connected BLE (${result.deviceName || 'device'})`, 'success');
        } else {
            const nameEl = $('#deviceName');
            if (nameEl) nameEl.textContent = '—';
            updateStatus(`Connected @ ${result.baudRate} baud`, 'success');
        }
    } catch (e) {
        updateStatus('Connection error: ' + (e?.message || e), 'error');
    }
};

$('#disconnect').onclick = async () => {
    try {
        await disconnectTransport();

        isConnected = false;
        $('#connect').classList.remove('hidden');
        $('#disconnect').classList.add('hidden');
        $('#disconnect').disabled = true;
        $('#upload').disabled = true;
        showProgress(false);
        const nameEl = $('#deviceName');
        if (nameEl) nameEl.textContent = '—';
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
            if (cmd.trim().toUpperCase() === 'FRESET' && currentTransport === 'ble') {
                addToTerminal('⏭️ FRESET ignoré en BLE', 'info');
                const progress = ((i + 1) / lines.length) * 100;
                updateProgress(progress, `Command ${i + 1}/${lines.length}: ${cmd.substring(0, 30)}${cmd.length > 30 ? '...' : ''}`);
                await sleep(MIN_INTER_COMMAND_DELAY_MS);
                continue;
            }
            let waiterPromise = null;
            // Prepare the correct waiter before writing to avoid race conditions
            if (cmd.trim().toUpperCase() === 'FRESET') {
                // For FRESET, we'll handle a specific sequence after writing the command (not via waiterPromise)
                waiterPromise = null;
            } else {
                // For normal commands, wait for the next non-NMEA received chunk (use delaySec as timeout if > 0)
                const nonNmeaPattern = /^(?!\$[A-Z]{5},).+/;
                waiterPromise = (delaySec > 0)
                    ? waitForReceivedMatching(nonNmeaPattern, delaySec * 1000).catch(() => null)
                    : null;
            }
            await writer.write(cmd + eol);
            if (cmd.trim().toUpperCase() === 'FRESET') {
                addToTerminal('⏳ Waiting for device response after FRESET...', 'info');
            }

            // Display sent command in terminal
            addToTerminal(cmd + eol.replace(/\n/g, '\\n').replace(/\r/g, '\\r'), 'sent');

            const progress = ((i + 1) / lines.length) * 100;
            updateProgress(progress, `Command ${i + 1}/${lines.length}: ${cmd.substring(0, 30)}${cmd.length > 30 ? '...' : ''}`);

            // For FRESET: wait for the 3-step reboot sequence: 1) FRESET response OK, 2) 'system is rebooting', 3) '..........'
            // For other commands: wait for the next received chunk (registered before write), and always wait at least MIN_INTER_COMMAND_DELAY_MS
            const sleepPromise = sleep(MIN_INTER_COMMAND_DELAY_MS);
            if (cmd.trim().toUpperCase() === 'FRESET') {
                const patterns = [
                    /FRESET.*response:\s*OK/i,
                    /system\s+is\s+rebooting/i,
                    /^[.]+$/
                ];
                const overallTimeoutMs = Math.max(30000, delaySec * 1000 * 10);
                try {
                    const perMessageTimeoutMs = (delaySec > 0) ? (delaySec * 1000) : 5000;
                    const matched = await waitForSequence(patterns, overallTimeoutMs, perMessageTimeoutMs);
                    if (matched) addToTerminal('✅ Board finished reboot (sequence received).', 'info');
                    else addToTerminal('⚠️ Board reboot sequence not complete — continuing', 'info');
                } catch (e) {
                    addToTerminal('⚠️ Error waiting for reboot sequence: ' + (e?.message || e), 'info');
                }
                // ensure minimal inter-command delay after reboot messages
                await sleepPromise;
                // extra safety pause after FRESET
                addToTerminal('⏸️ Pause 5s après FRESET...', 'info');
                await sleep(5000);
                continue;
            }
            try {
                if (waiterPromise) {
                    await Promise.all([sleepPromise, waiterPromise]);
                } else {
                    await sleepPromise;
                }
            } catch (err) {
                // On timeout (or no reader), continue and log a warning
                addToTerminal(`⚠️ No response after ${delaySec}s — continuing`, 'info');
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
