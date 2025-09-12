/* ========================================
   Centipede Web Serial - JavaScript pour index.html (mode débutant)
   ======================================== */

// Variables spécifiques au mode débutant
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
        // Masquer aussi le terminal quand on masque la barre de progression
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

    // Auto-scroll vers le bas
    terminal.scrollTop = terminal.scrollHeight;

    // Limiter le nombre de lignes (garder seulement les 200 dernières)
    const lines = terminal.children;
    if (lines.length > 200) {
        terminal.removeChild(lines[0]);
    }
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
    // Initialiser la liste des configurations
    try {
        const result = await populateConfigSelect(false);
        if (result[0].length > 0) {
            updateStatus(`${result[0].length} fichier(s) de configuration trouvé(s) via ${result[1]}`, 'success');
        } else {
            updateStatus('Impossible de lister conf_files/ (auto-index ou API). Utilisez le bouton "fichier personnel".', 'info');
        }
    } catch (e) {
        console.log(e);
        updateStatus('Erreur lors du chargement des configurations', 'error');
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

// Rafraîchir la liste
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
        updateStatus('Chargement de la configuration...', 'info');
        const result = await loadConfigFromUrl(url);
        currentConfig = result.content;
        $('#upload').disabled = !isConnected;
        updateStatus('Configuration chargée: ' + url.split('/').pop(), 'success');

        // Extraire et afficher la description
        const description = extractConfigDescription(result.content);
        displayConfigDescription(description);
    } catch (e) {
        updateStatus(e.message, 'error');
        currentConfig = '';
        $('#upload').disabled = true;
        displayConfigDescription(null);
    }
};

// Fichier perso
$('#configFile').onchange = async (ev) => {
    const f = ev.target.files?.[0];
    if (!f) {
        currentConfig = '';
        $('#upload').disabled = true;
        displayConfigDescription(null);
        return;
    }
    try {
        updateStatus('Chargement du fichier...', 'info');
        const result = await loadConfigFromFile(f);
        currentConfig = result.content;
        $('#configSelect').value = ''; // désélectionner le menu conf_files
        $('#upload').disabled = !isConnected;
        updateStatus('Fichier chargé: ' + result.filename, 'success');

        // Extraire et afficher la description
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
        updateStatus('Connexion en cours...', 'info');

        const result = await connectSerial();

        // Boucle de lecture spécifique au mode débutant
        (async function readLoop() {
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    // Afficher les données reçues dans le terminal si visible
                    if (value && value.length > 0) {
                        addToTerminal(value, 'received');
                    }
                }
            } catch (e) {
                updateStatus('Erreur de lecture: ' + e.message, 'error');
            }
        })();

        isConnected = true;
        $('#connect').classList.add('hidden');
        $('#disconnect').classList.remove('hidden');
        $('#disconnect').disabled = false;
        $('#upload').disabled = !currentConfig;
        updateStatus(`Connecté @ ${result.baudRate} bauds`, 'success');
    } catch (e) {
        updateStatus('Erreur de connexion: ' + (e?.message || e), 'error');
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
        updateStatus('Déconnecté', 'info');
    } catch (e) {
        updateStatus('Erreur de déconnexion: ' + (e?.message || e), 'error');
    }
};

/* ---------------------- Upload Commands ---------------------- */
$('#upload').onclick = async () => {
    if (!writer) {
        updateStatus('Non connecté.', 'error');
        return;
    }
    if (!currentConfig) {
        updateStatus('Aucune configuration chargée.', 'error');
        return;
    }
    if (sendingBatch) {
        updateStatus('Envoi déjà en cours. Patientez...', 'info');
        return;
    }

    const lines = currentConfig.split('\n')
        .map(s => s.trim())
        .filter(s => s.length && !s.startsWith('#') && !s.startsWith('//') && !s.startsWith(';'));

    if (!lines.length) {
        updateStatus('Aucune commande valide dans la configuration.', 'error');
        return;
    }

    const delaySec = Math.max(0, parseFloat($('#delay').value || '5') || 5);
    const eol = getEOL();

    sendingBatch = true;
    $('#upload').disabled = true;
    showProgress(true);

    try {
        updateStatus(`Envoi de ${lines.length} commande(s)...`, 'info');
        updateProgress(0, 'Démarrage...');

        // Effacer le terminal et ajouter un message de début
        clearTerminal();
        addToTerminal(`=== Début de la configuration (${lines.length} commandes) ===`);

        for (let i = 0; i < lines.length; i++) {
            const cmd = lines[i];
            await writer.write(cmd + eol);

            // Afficher la commande envoyée dans le terminal
            addToTerminal(cmd + eol.replace(/\n/g, '\\n').replace(/\r/g, '\\r'), 'sent');

            const progress = ((i + 1) / lines.length) * 100;
            updateProgress(progress, `Commande ${i + 1}/${lines.length}: ${cmd.substring(0, 30)}${cmd.length > 30 ? '...' : ''}`);

            if (i < lines.length - 1) {
                await sleep(delaySec * 1000);
            }
        }

        updateProgress(100, 'Configuration envoyée avec succès!');
        updateStatus('Configuration envoyée avec succès!', 'success');
        addToTerminal('=== Fin de la configuration ===');

        // Masquer la barre de progression après 3 secondes
        setTimeout(() => showProgress(false), 3000);
    } catch (e) {
        updateStatus('Erreur lors de l\'envoi: ' + (e?.message || e), 'error');
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
        updateStatus('Commande SAVECONFIG envoyée', 'success');
    } catch (e) {
        updateStatus(e.message, 'error');
    }
};
