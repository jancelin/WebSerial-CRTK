/* ========================================
    Centipede-RTK Web Serial - JavaScript for index_advanced.html (advanced mode)
    ======================================== */

// Variables specific to advanced mode
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
        const result = await connectSerial();

        // Read loop specific to advanced mode
        (async function readLoop() {
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    if (value) logLine(value);
                }
            } catch (e) {
                logLine('✗ Read error: ' + e.message);
            }
        })();

        $('#connect').disabled = true;
        $('#disconnect').disabled = false;
        logLine('✓ Connected @ ' + result.baudRate + ' baud');
    } catch (e) {
        logLine('✗ Connection error: ' + (e?.message || e));
    }
};

$('#disconnect').onclick = async () => {
    try {
        await disconnectSerial();

        $('#connect').disabled = false;
        $('#disconnect').disabled = true;
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
            await writer.write(cmd + eol);
            logLine(`→ [${i + 1}/${lines.length}] ${cmd}`);
            if (i < lines.length - 1) await sleep(delaySec * 1000);
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
