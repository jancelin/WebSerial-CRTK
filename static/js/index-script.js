/* ========================================
   Centipede-RTK Web Serial - JavaScript for index.html (beginner mode)
   ======================================== */

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
