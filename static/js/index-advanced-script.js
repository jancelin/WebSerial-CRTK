/* ========================================
   Centipede Web Serial - JavaScript pour index_advanced.html (mode avancé)
   ======================================== */

// Variables spécifiques au mode avancé
const logEl = $('#log');

/* ---------------------- UI Functions ---------------------- */
function logLine(s) {
    logEl.textContent += (s ?? '') + '\n';
    logEl.scrollTop = logEl.scrollHeight;
}

function clearLog() {
    logEl.textContent = '— Log —\n';
}

/* ---------------------- Event Handlers ---------------------- */
document.addEventListener('DOMContentLoaded', async () => {
    // Initialiser la liste des configurations
    try {
        const result = await populateConfigSelect(false);
        if (result[0].length > 0) {
            logLine(`✓ ${result[0].length} fichier(s) via ${result[1]}.`);
        } else {
            logLine('ℹ️ Impossible de lister conf_files/ (auto-index ou API). Utilisez le bouton "fichier personnel" ou ajoutez conf_files/index.json.');
        }
    } catch (e) {
        logLine('✗ Erreur lors du chargement des configurations');
    }
});

// Rafraîchir la liste
$('#refreshList').onclick = () => populateConfigSelect(true);

// Configuration select
$('#configSelect').onchange = async (ev) => {
    const url = ev.target.value;
    if (!url) return;
    try {
        const result = await loadConfigFromUrl(url);
        $('#cmd').value = result.content;
        logLine('✓ Chargé: ' + url);
    } catch (e) {
        logLine('✗ ' + e.message);
    }
};

// Fichier perso
$('#configFile').onchange = async (ev) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    try {
        const result = await loadConfigFromFile(f);
        $('#cmd').value = result.content;
        $('#configSelect').value = ''; // désélectionner le menu conf_files
        logLine('✓ Fichier chargé: ' + result.filename);
    } catch (e) {
        logLine('✗ ' + e.message);
    }
};

/* ---------------------- Serial Communication ---------------------- */
$('#connect').onclick = async () => {
    try {
        const result = await connectSerial();

        // Boucle de lecture spécifique au mode avancé
        (async function readLoop() {
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    if (value) logLine(value);
                }
            } catch (e) {
                logLine('✗ Lecture: ' + e.message);
            }
        })();

        $('#connect').disabled = true;
        $('#disconnect').disabled = false;
        logLine('✓ Connecté @ ' + result.baudRate + ' bauds');
    } catch (e) {
        logLine('✗ Erreur connexion: ' + (e?.message || e));
    }
};

$('#disconnect').onclick = async () => {
    try {
        await disconnectSerial();

        $('#connect').disabled = false;
        $('#disconnect').disabled = true;
        logLine('⏏️ Déconnecté');
    } catch (e) {
        logLine('✗ Déconnexion: ' + (e?.message || e));
    }
};

/* ---------------------- Send Commands ---------------------- */
$('#send').onclick = async () => {
    if (!writer) { logLine('✗ Non connecté.'); return; }
    if (sendingBatch) { logLine('⌛ Déjà en cours. Patiente…'); return; }

    const raw = $('#cmd').value || '';
    let lines = raw.split('\n')
        .map(s => s.trim())
        .filter(s => s.length && !s.startsWith('#') && !s.startsWith('//') && !s.startsWith(';'));

    if (!lines.length) { logLine('ℹ️ Rien à envoyer.'); return; }

    const delaySec = Math.max(0, parseFloat($('#delay').value || '5') || 5);
    const eol = getEOL();

    sendingBatch = true;
    $('#send').disabled = true;
    try {
        logLine(`▶️ Envoi de ${lines.length} commande(s), délai ${delaySec}s…`);
        for (let i = 0; i < lines.length; i++) {
            const cmd = lines[i];
            await writer.write(cmd + eol);
            logLine(`→ [${i + 1}/${lines.length}] ${cmd}`);
            if (i < lines.length - 1) await sleep(delaySec * 1000);
        }
        logLine('✅ Lot terminé.');
    } catch (e) {
        logLine('✗ Envoi interrompu: ' + (e?.message || e));
    } finally {
        sendingBatch = false;
        $('#send').disabled = false;
    }
};

$('#save').onclick = async () => {
    try {
        const result = await sendSaveConfig();
        logLine('→ SAVECONFIG');
    } catch (e) {
        logLine('✗ ' + e.message);
    }
};

$('#clear').onclick = () => clearLog();
