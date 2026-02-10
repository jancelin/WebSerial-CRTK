/* ========================================
    Centipede-RTK Web Serial - JavaScript for index_advanced.html (advanced mode)
    ======================================== */

// Set config source for this page
window.CONFIG_SOURCE = 'advanced';

// Bascule Avancé -> Débutant
document.addEventListener('DOMContentLoaded', () => {
    const sw = document.getElementById('modeSwitch');
    if (!sw) return;
    // Sur la page Avancé, le toggle doit être en position "Avancé" (ON)
    sw.checked = true;
    sw.addEventListener('change', () => {
        if (!sw.checked) {
            // Revenir vers l’UI débutant
            window.location.href = 'index.html';
        }
    });
});

// Variables specific to advanced mode
const logEl = $('#log');
let advRecvBuffer = '';
let showNmea = false;
const MIN_INTER_COMMAND_DELAY_MS = 500;
let waitAck = true;

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
function logLine(s) {
    logEl.textContent += (s ?? '') + '\n';
    logEl.scrollTop = logEl.scrollHeight;
}

function clearLog() {
    logEl.textContent = '— Log —\n';
}

/* ---------------------- Event Handlers ---------------------- */
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize configuration list
    try {
        const result = await populateConfigSelect(false);
        if (result[0].length > 0) {
            logLine(`✓ ${result[0].length} file(s) via ${result[1]}.`);
        } else {
            logLine('ℹ️ Unable to list conf_files/ (auto-index or API). Use the "personal file" button or add conf_files/index.json.');
        }
    } catch (e) {
        logLine('✗ Error loading configurations');
    }

    const transportSel = $('#transport');
    if (transportSel) {
        transportSel.addEventListener('change', updateTransportUi);
        updateTransportUi();
    }

    const showNmeaEl = $('#showNmea');
    if (showNmeaEl) {
        showNmea = !!showNmeaEl.checked;
        showNmeaEl.addEventListener('change', () => {
            showNmea = !!showNmeaEl.checked;
            logLine(showNmea ? 'ℹ️ NMEA affiché' : 'ℹ️ NMEA masqué');
        });
    }

    const waitAckEl = $('#waitAck');
    if (waitAckEl) {
        waitAck = !!waitAckEl.checked;
        waitAckEl.addEventListener('change', () => {
            waitAck = !!waitAckEl.checked;
            logLine(waitAck ? 'ℹ️ Attente d’acquittement activée' : 'ℹ️ Attente d’acquittement désactivée');
        });
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

// Personal file
$('#configFile').onchange = async (ev) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    try {
        const result = await loadConfigFromFile(f);
        $('#cmd').value = result.content;
        $('#configSelect').value = ''; // deselect conf_files menu
        logLine('✓ File loaded: ' + result.filename);
    } catch (e) {
        logLine('✗ ' + e.message);
    }
};

/* ---------------------- Serial Communication ---------------------- */
$('#connect').onclick = async () => {
    try {
        const result = await connectTransport();

        // Read loop specific to advanced mode
        (async function readLoop() {
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    if (!value) continue;
                    advRecvBuffer += value;
                    const parts = advRecvBuffer.split(/\r\n|\n/);
                    advRecvBuffer = parts.pop();
                    parts.forEach(p => {
                        if (!p.length) return;
                        if (!showNmea && isNmeaLine(p)) return;
                        logLine(p);
                    });
                }
            } catch (e) {
                logLine('✗ Read error: ' + e.message);
            }
        })();

        $('#connect').disabled = true;
        $('#disconnect').disabled = false;
        if (result?.transport === 'ble') {
            const nameEl = $('#deviceName');
            if (nameEl) nameEl.textContent = result.deviceName || 'BLE device';
            logLine('✓ Connected BLE (' + (result.deviceName || 'device') + ')');
        } else {
            const nameEl = $('#deviceName');
            if (nameEl) nameEl.textContent = '—';
            logLine('✓ Connected @ ' + result.baudRate + ' baud');
        }
    } catch (e) {
        logLine('✗ Connection error: ' + (e?.message || e));
    }
};

$('#disconnect').onclick = async () => {
    try {
        await disconnectTransport();

        $('#connect').disabled = false;
        $('#disconnect').disabled = true;
        const nameEl = $('#deviceName');
        if (nameEl) nameEl.textContent = '—';
        logLine('⏏️ Disconnected');
    } catch (e) {
        logLine('✗ Disconnection: ' + (e?.message || e));
    }
};

/* ---------------------- Send Commands ---------------------- */
$('#send').onclick = async () => {
    if (!writer) { logLine('✗ Not connected.'); return; }
    if (sendingBatch) { logLine('⌛ Already in progress. Please wait…'); return; }

    const raw = $('#cmd').value || '';
    let lines = raw.split('\n')
        .map(s => s.trim())
        .filter(s => s.length && !s.startsWith('#') && !s.startsWith('//') && !s.startsWith(';'));

    if (!lines.length) { logLine('ℹ️ Nothing to send.'); return; }

    const delaySec = Math.max(0, parseFloat($('#delay').value || '5') || 5);
    const eol = getEOL();

    sendingBatch = true;
    $('#send').disabled = true;
    try {
        logLine(`▶️ Sending ${lines.length} command(s), delay ${delaySec}s…`);
        for (let i = 0; i < lines.length; i++) {
            const cmd = lines[i];
            if (cmd.trim().toUpperCase() === 'FRESET' && currentTransport === 'ble') {
                logLine(`⏭️ [${i + 1}/${lines.length}] FRESET ignoré en BLE`);
                await sleep(MIN_INTER_COMMAND_DELAY_MS);
                continue;
            }
            const nonNmeaPattern = /^(?!\$[A-Z]{5},).+/;
            const waiterPromise = (waitAck && delaySec > 0)
                ? waitForReceivedMatching(nonNmeaPattern, delaySec * 1000).catch(() => null)
                : null;

            await writer.write(cmd + eol);
            logLine(`→ [${i + 1}/${lines.length}] ${cmd}`);

            const sleepPromise = sleep(MIN_INTER_COMMAND_DELAY_MS);
            if (waitAck) {
                try {
                    if (waiterPromise) {
                        await Promise.all([sleepPromise, waiterPromise]);
                    } else {
                        await sleepPromise;
                    }
                } catch (err) {
                    logLine(`⚠️ No response after ${delaySec}s — continuing`);
                }
            } else {
                await sleep(delaySec * 1000);
            }
        }
        logLine('✅ Batch completed.');
    } catch (e) {
        logLine('✗ Send interrupted: ' + (e?.message || e));
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
