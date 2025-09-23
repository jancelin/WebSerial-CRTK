/* ========================================
   Centipede-RTK Web Serial - Common JavaScript
   ======================================== */

/* Common global variables */
let port, reader, writer;
let textDecoder, textEncoder;
let readableStreamClosed, writableStreamClosed;
let sendingBatch = false;

/* Common UI helpers */
const $ = s => document.querySelector(s);

/**
 * Checks for Web Serial support
 */
function ensureWebSerial() {
    if (!('serial' in navigator)) {
        throw new Error('Web Serial not supported in this browser. Use Chrome/Chromium desktop.');
    }
}

/**
 * Sleep function for delays
 */
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

/**
 * Normalizes text (removes BOM, unifies line endings)
 */
function normalizeText(t) {
    return t.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim() + '\n';
}

/**
 * Gets the selected end of line character
 */
function getEOL() {
    return eval('`' + $('#eol').value + '`');
}

/**
 * Common Web Serial connection function
 */
async function connectSerial() {
    try {
        ensureWebSerial();
        const baudRate = parseInt($('#baud').value, 10) || 115200;

        // USB filters: FTDI(0x0403), CP210x(0x10C4), CH340(0x1A86)
        const filters = [{ usbVendorId: 0x0403 }, { usbVendorId: 0x10C4 }, { usbVendorId: 0x1A86 }];
        port = await navigator.serial.requestPort({ filters });
        await port.open({ baudRate });

        // Encoder/decoder streams and "pipes" with tracking for proper closure
        textDecoder = new TextDecoderStream();
        readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();

        textEncoder = new TextEncoderStream();
        writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
        writer = textEncoder.writable.getWriter();

        return { baudRate, success: true };
    } catch (e) {
        throw e;
    }
}

/**
 * Common Web Serial disconnection function
 */
async function disconnectSerial() {
    try {
        if (!port) return;
        if (sendingBatch) {
            console.log('Sending in progress — waiting before disconnection…');
        }

        // 1) Stop reading properly
        try { await reader?.cancel(); } catch { }
        try { await readableStreamClosed?.catch(() => { }); } catch { }
        reader?.releaseLock?.();

        // 2) Close writing properly
        try { await writer?.close(); } catch { }
        try { await writableStreamClosed?.catch(() => { }); } catch { }
        writer?.releaseLock?.();

        // 3) Close the port
        await port.close();

        // 4) State cleanup
        port = undefined; reader = undefined; writer = undefined;
        textDecoder = textEncoder = undefined;
        readableStreamClosed = writableStreamClosed = undefined;

        return { success: true };
    } catch (e) {
        throw e;
    }
}

/* ---------------------- Configuration files listing ---------------------- */
// GitHub configuration
const GH_OWNER = 'jancelin';
const GH_REPO = 'WebSerial-CRTK';
const GH_BRANCH_CANDIDATES = ['gh-pages', 'main', 'master'];
const ALLOWED_EXT = /\.(txt|cfg|conf|ini|nmea|csv|log)$/i;
// Resolve base folder depending on interface ---
function getConfigBase() {
    const mode = (window.CONFIG_SOURCE === 'advanced') ? 'advanced' : 'user';
    return `conf_files/${mode}`;
}

/**
 * Populates the configuration dropdown list
 */
async function populateConfigSelect(manual) {
    const sel = $('#configSelect');
    const mode = (window.CONFIG_SOURCE === 'advanced') ? 'advanced' : 'user';
    const base = getConfigBase();

    sel.innerHTML = mode === 'advanced'
        ? '<option value="">— Choisir un fichier (conf_files/advanced) —</option>'
        : '<option value="">— Choisir une configuration (débutant) —</option>';

    // Beginner mode: prefer manifest (labels + emoji)
    if (mode === 'user') {
        const manifestOptions = await tryFetchManifestJSON();
        if (manifestOptions && manifestOptions.length) {
            addOptions(sel, manifestOptions, /*useCleanNames=*/false);
            if (typeof updateStatus === 'function') updateStatus(`${manifestOptions.length} configuration(s) via manifest`, 'success');
            else if (typeof logLine === 'function') logLine(`✓ ${manifestOptions.length} configuration(s) via manifest.`);
            return [manifestOptions, "manifest"];
        }
    }

    // Local index
    const localFiles = await tryFetchLocalIndex();
    if (localFiles && localFiles.length) {
        const options = localFiles.map(n => ({ name: n, url: `${base}/${n}` }));
        addOptions(sel, options, /*useCleanNames=*/true);
        if (typeof updateStatus === 'function') updateStatus(`${options.length} fichier(s) via index local`, 'success');
        else if (typeof logLine === 'function') logLine(`✓ ${options.length} fichier(s) via local.`);
        return [options, "local"];
    }

    // GitHub API fallback (GitHub Pages)
    const ghFiles = await tryFetchGitHubAPI();
    if (ghFiles && ghFiles.length) {
        addOptions(sel, ghFiles, /*useCleanNames=*/true);
        if (typeof updateStatus === 'function') updateStatus(`${ghFiles.length} fichier(s) via GitHub API`, 'success');
        else if (typeof logLine === 'function') logLine(`✓ ${ghFiles.length} fichier(s) via GitHub API.`);
        return [ghFiles, "github"];
    }

    if (typeof updateStatus === 'function') {
        updateStatus(`ℹ️ Impossible de lister ${base}/. Utilisez un fichier personnel${mode==='user' ? ' ou ajoutez un manifest.json' : ''}.`, 'info');
    } else if (typeof logLine === 'function') {
        logLine(manual ? 'ℹ️ Aucun fichier détecté.' :
            `ℹ️ Impossible de lister ${base}/. Utilisez le bouton "fichier personnel"${mode==='user' ? ' ou ajoutez un manifest.json' : ''}.`);
    }
}

/**
 * Adds options to the select element
 */
function addOptions(selectEl, items, useCleanNames = true) {
    items
        // FIX: accepter les items manifest (label en name) en vérifiant aussi l'URL
        .filter(it => ALLOWED_EXT.test(it.name || '') || ALLOWED_EXT.test(it.url || ''))
        .sort((a, b) => (a.name || '').localeCompare((b.name || ''), undefined, { sensitivity: 'base' }))
        .forEach(it => {
            const opt = document.createElement('option');
            opt.value = it.url;

            if (useCleanNames) {
                const nm = (it.name || '');
                const cleanName = nm.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
                opt.textContent = cleanName || nm;
            } else {
                // Mode débutant : conserver le label du manifest (emoji inclus)
                opt.textContent = it.name || it.url;
            }

            selectEl.appendChild(opt);
        });
}

/**
 * Attempts to fetch the JSON manifest
 */
async function tryFetchManifestJSON() {
    const base = getConfigBase();
    // Only meaningful for 'user' mode where a manifest exists
    if (window.CONFIG_SOURCE !== 'user') return null;
    try {
        const resp = await fetch(`${base}/manifest.json?t=` + Date.now(), { cache: 'no-store' });
        if (!resp.ok) return null;
        const data = await resp.json();

        // Support: { items: [{file, label}, ...] }  OR legacy: ["file.cfg", ...]
        if (Array.isArray(data)) {
            return data
                .filter(n => typeof n === 'string')
                .map(n => ({ name: n, url: `${base}/${n}` }));
        }
        if (data && Array.isArray(data.items)) {
            return data.items
                .filter(it => it && typeof it.file === 'string')
                .map(it => ({
                    name: (typeof it.label === 'string' && it.label.trim()) ? it.label : it.file,
                    url: `${base}/${it.file}`
                }));
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Attempts to fetch the local index
 */
async function tryFetchLocalIndex() {
    const base = getConfigBase();
    try {
        const resp = await fetch(`${base}/?t=` + Date.now(), { cache: 'no-store' });
        if (!resp.ok) return null;
        const html = await resp.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return Array.from(doc.querySelectorAll('a[href]'))
            .map(a => a.getAttribute('href') || '')
            .filter(href => href && !href.startsWith('?') && !href.startsWith('/'))
            .filter(href => !href.endsWith('/'))
            .filter(href => ALLOWED_EXT.test(href));
    } catch { return null; }
}

/**
 * Attempts to fetch via GitHub API
 */
async function tryFetchGitHubAPI() {
    const mode = (window.CONFIG_SOURCE === 'advanced') ? 'advanced' : 'user';
    const dirPath = `conf_files/${mode}`;
    for (const branch of GH_BRANCH_CANDIDATES) {
        try {
            const apiUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${dirPath}?ref=${encodeURIComponent(branch)}`;
            const apiResp = await fetch(apiUrl, { cache: 'no-store' });
            if (!apiResp.ok) continue;
            const items = await apiResp.json();
            const files = (Array.isArray(items) ? items : [])
                .filter(it => it && it.type === 'file' && typeof it.name === 'string' && typeof it.download_url === 'string')
                .filter(it => ALLOWED_EXT.test(it.name))
                .map(it => ({ name: it.name, url: it.download_url }));
            if (files.length) return files;
        } catch { /* next branch */ }
    }
    return null;
}

/**
 * Loads a configuration file from a URL
 */
async function loadConfigFromUrl(url) {
    try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const txt = await resp.text();
        return { content: normalizeText(txt), success: true };
    } catch (e) {
        throw new Error('Unable to load ' + url + ' : ' + (e?.message || e));
    }
}

/**
 * Loads a configuration file from a local file
 */
async function loadConfigFromFile(file) {
    try {
        const txt = await file.text();
        return { content: normalizeText(txt), success: true, filename: file.name };
    } catch (e) {
        throw new Error('File reading error: ' + (e?.message || e));
    }
}

/**
 * Sends the SAVECONFIG command
 */
async function sendSaveConfig() {
    if (!writer) {
        throw new Error('Not connected.');
    }
    try {
        const command = 'SAVECONFIG' + getEOL();
        await writer.write(command);
        return { success: true, command: command };
    } catch (e) {
        throw new Error('SAVECONFIG error: ' + (e?.message || e));
    }
}

/**
 * HTML escaping function
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Converts URLs to clickable links
 */
function convertUrlsToLinks(text) {
    const urlRegex = /(https?:\/\/[^\s<>"]+)/gi;

    return text.replace(urlRegex, function (url) {
        let cleanUrl = url;
        const punctuation = /[.,!?;:]$/;
        let endPunct = '';

        if (punctuation.test(url)) {
            endPunct = url.slice(-1);
            cleanUrl = url.slice(0, -1);
        }

        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">${cleanUrl}</a>${endPunct}`;
    });
}

/**
 * Extracts description from file comments
 */
function extractConfigDescription(content) {
    if (!content) return null;

    const lines = content.split('\n');
    const description = {
        title: '',
        details: []
    };

    // Search for #title: and #content: tags in comments
    for (let i = 0; i < Math.min(30, lines.length); i++) {
        const line = lines[i].trim();

        // Ignore empty lines
        if (!line) continue;

        // If it's a comment (# or //)
        if (line.startsWith('#') || line.startsWith('//')) {
            const comment = line.replace(/^(#|\/\/)\s*/, '');

            // Search for title: tag
            if (comment.toLowerCase().startsWith('title:')) {
                description.title = comment.substring(6).trim();
            }
            // Search for content: tag
            else if (comment.toLowerCase().startsWith('content:')) {
                const content = comment.substring(8).trim();
                if (content.length > 0) {
                    description.details.push(content);
                }
            }
        } else {
            // If we encounter a non-comment line and already have data, stop
            if (description.title || description.details.length > 0) {
                break;
            }
        }
    }

    return (description.title || description.details.length) ? description : null;
}

/* ---------------------- Mode switch management ---------------------- */
/**
 * Initializes the common mode switch
 */
function initializeModeSwitch() {
    document.addEventListener('DOMContentLoaded', () => {
        const modeToggle = $('#modeToggle');

        // Determine if we're in advanced mode based on current page
        const isAdvancedMode = window.location.pathname.includes('index_advanced.html');

        if (modeToggle) {
            modeToggle.onchange = () => {
                if (isAdvancedMode) {
                    // We're on the advanced page, if unchecked, go to beginner mode
                    if (!modeToggle.checked) {
                        localStorage.setItem('centipede-mode', 'beginner');
                        window.location.href = 'index.html';
                    }
                } else {
                    // We're on the beginner page, if checked, go to advanced mode
                    if (modeToggle.checked) {
                        localStorage.setItem('centipede-mode', 'advanced');
                        window.location.href = 'index_advanced.html';
                    }
                }
            };
        }
    });
}

// Initialize the mode switch
initializeModeSwitch();
