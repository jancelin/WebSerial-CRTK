/* ========================================
   Centipede Web Serial - JavaScript commun
   ======================================== */

/* Variables globales communes */
let port, reader, writer;
let textDecoder, textEncoder;
let readableStreamClosed, writableStreamClosed;
let sendingBatch = false;

/* Helpers UI communs */
const $ = s => document.querySelector(s);

/**
 * Vérifie le support de Web Serial
 */
function ensureWebSerial() {
    if (!('serial' in navigator)) {
        throw new Error('Web Serial non supporté dans ce navigateur. Utilisez Chrome/Chromium desktop.');
    }
}

/**
 * Fonction sleep pour les délais
 */
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

/**
 * Normalise le texte (supprime BOM, unifie les fins de ligne)
 */
function normalizeText(t) {
    return t.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim() + '\n';
}

/**
 * Récupère la fin de ligne sélectionnée
 */
function getEOL() {
    return eval('`' + $('#eol').value + '`');
}

/**
 * Fonction de connexion Web Serial commune
 */
async function connectSerial() {
    try {
        ensureWebSerial();
        const baudRate = parseInt($('#baud').value, 10) || 115200;

        // Filtres USB : FTDI(0x0403), CP210x(0x10C4), CH340(0x1A86)
        const filters = [{ usbVendorId: 0x0403 }, { usbVendorId: 0x10C4 }, { usbVendorId: 0x1A86 }];
        port = await navigator.serial.requestPort({ filters });
        await port.open({ baudRate });

        // Streams enc/dec et "pipes" avec suivi pour fermeture propre
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
 * Fonction de déconnexion Web Serial commune
 */
async function disconnectSerial() {
    try {
        if (!port) return;
        if (sendingBatch) {
            console.log('Envoi en cours — attente avant déconnexion…');
        }

        // 1) Arrêter proprement la lecture
        try { await reader?.cancel(); } catch { }
        try { await readableStreamClosed?.catch(() => { }); } catch { }
        reader?.releaseLock?.();

        // 2) Fermer proprement l'écriture
        try { await writer?.close(); } catch { }
        try { await writableStreamClosed?.catch(() => { }); } catch { }
        writer?.releaseLock?.();

        // 3) Fermer le port
        await port.close();

        // 4) Nettoyage d'état
        port = undefined; reader = undefined; writer = undefined;
        textDecoder = textEncoder = undefined;
        readableStreamClosed = writableStreamClosed = undefined;

        return { success: true };
    } catch (e) {
        throw e;
    }
}

/* ---------------------- Listing des fichiers de conf ---------------------- */
// Configuration GitHub
const GH_OWNER = 'jancelin';
const GH_REPO = 'WebSerial-CRTK';
const GH_BRANCH_CANDIDATES = ['gh-pages', 'main', 'master'];
const ALLOWED_EXT = /\.(txt|cfg|conf|ini|nmea|csv|log)$/i;

/**
 * Peuple la liste déroulante des configurations
 */
async function populateConfigSelect(manual) {
    const sel = $('#configSelect');
    sel.innerHTML = '<option value="">— Choisir un fichier (conf_files) —</option>';

    // 0) Tentative: fichier manifeste optionnel (si tu ajoutes conf_files/manifest.json)
    //    Format attendu: ["Feasycom_BT836b.txt","UM980_rover_fullNMEA_5hz_BT921600bd_UP_STABLE.txt", ...]
    const manifestFiles = await tryFetchManifestJSON();
    if (manifestFiles && manifestFiles.length) {
        options = manifestFiles.map(n => ({ name: n, url: 'conf_files/' + n }))
        addOptions(sel, options);
        if (typeof logLine === 'function') logLine(`✓ ${manifestFiles.length} fichier(s) via index.json.`);
        return [options, "manifest"];
    }

    // 1) En local: listing HTML (python -m http.server)
    const localFiles = await tryFetchLocalIndex();
    if (localFiles && localFiles.length) {
        options = localFiles.map(n => ({ name: n, url: 'conf_files/' + n }))
        addOptions(sel, options);
        if (typeof logLine === 'function') logLine(`✓ ${localFiles.length} fichier(s) détecté(s) (local).`);
        return [options, "local"];
    }

    // 2) Fallback GitHub API (utile sur GitHub Pages)
    const ghFiles = await tryFetchGitHubAPI();
    if (ghFiles && ghFiles.length) {
        addOptions(sel, ghFiles); // ghFiles contient {name, url:download_url}
        if (typeof logLine === 'function') logLine(`✓ ${ghFiles.length} fichier(s) via GitHub API.`);
        return [ghFiles, "github"];
    }

    if (typeof logLine === 'function') {
        logLine(manual ? 'ℹ️ Aucun fichier détecté.' :
            'ℹ️ Impossible de lister conf_files/ (auto-index ou API). Utilisez le bouton "fichier personnel" ou ajoutez conf_files/index.json.');
    }
}


/**
 * Ajoute les options au select
 */
function addOptions(selectEl, items, useCleanNames = true) {
    items
        .filter(it => ALLOWED_EXT.test(it.name))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .forEach(it => {
            const opt = document.createElement('option');
            opt.value = it.url;

            if (useCleanNames) {
                // Nettoyer le nom : supprimer l'extension et remplacer _ par des espaces
                const cleanName = it.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
                opt.textContent = cleanName;
            } else {
                opt.textContent = it.name;
            }

            selectEl.appendChild(opt);
        });
}

/**
 * Tente de récupérer le manifeste JSON
 */
async function tryFetchManifestJSON() {
    try {
        const resp = await fetch('/conf_files/manifest.json?t=' + Date.now(), { cache: 'no-store' });
        if (!resp.ok) return null;
        const arr = await resp.json();
        return (Array.isArray(arr) ? arr.filter(n => typeof n === 'string') : null);
    } catch { return null; }
}

/**
 * Tente de récupérer l'index local
 */
async function tryFetchLocalIndex() {
    try {
        const resp = await fetch('conf_files/?t=' + Date.now(), { cache: 'no-store' });
        if (!resp.ok) return null;
        const html = await resp.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        let files = Array.from(doc.querySelectorAll('a[href]'))
            .map(a => a.getAttribute('href') || '')
            .filter(href => href && !href.startsWith('?') && !href.startsWith('/'))
            .filter(href => !href.endsWith('/'))
            .filter(href => ALLOWED_EXT.test(href));
        return files;
    } catch { return null; }
}
/**
 * Tente de récupérer via l'API GitHub
 */
async function tryFetchGitHubAPI() {
    for (const branch of GH_BRANCH_CANDIDATES) {
        try {
            const apiUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/conf_files?ref=${encodeURIComponent(branch)}`;
            const apiResp = await fetch(apiUrl, { cache: 'no-store' });
            if (!apiResp.ok) continue;
            const items = await apiResp.json();
            const files = (Array.isArray(items) ? items : [])
                .filter(it => it && it.type === 'file' && typeof it.name === 'string' && typeof it.download_url === 'string')
                .filter(it => ALLOWED_EXT.test(it.name))
                .map(it => ({ name: it.name, url: it.download_url }));
            if (files.length) return files;
        } catch { /* essaye la branche suivante */ }
    }
    return null;
}

/**
 * Charge un fichier de configuration depuis une URL
 */
async function loadConfigFromUrl(url) {
    try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const txt = await resp.text();
        return { content: normalizeText(txt), success: true };
    } catch (e) {
        throw new Error('Impossible de charger ' + url + ' : ' + (e?.message || e));
    }
}

/**
 * Charge un fichier de configuration depuis un fichier local
 */
async function loadConfigFromFile(file) {
    try {
        const txt = await file.text();
        return { content: normalizeText(txt), success: true, filename: file.name };
    } catch (e) {
        throw new Error('Erreur lecture fichier: ' + (e?.message || e));
    }
}

/**
 * Envoi de la commande SAVECONFIG
 */
async function sendSaveConfig() {
    if (!writer) {
        throw new Error('Non connecté.');
    }
    try {
        const command = 'SAVECONFIG' + getEOL();
        await writer.write(command);
        return { success: true, command: command };
    } catch (e) {
        throw new Error('Erreur SAVECONFIG: ' + (e?.message || e));
    }
}

/**
 * Fonction d'échappement HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Convertit les URLs en liens cliquables
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
 * Extrait la description depuis les commentaires du fichier
 */
function extractConfigDescription(content) {
    if (!content) return null;

    const lines = content.split('\n');
    const description = {
        title: '',
        details: []
    };

    // Recherche des tags #title: et #content: dans les commentaires
    for (let i = 0; i < Math.min(30, lines.length); i++) {
        const line = lines[i].trim();

        // Ignorer les lignes vides
        if (!line) continue;

        // Si c'est un commentaire (# ou //)
        if (line.startsWith('#') || line.startsWith('//')) {
            const comment = line.replace(/^(#|\/\/)\s*/, '');

            // Rechercher le tag title:
            if (comment.toLowerCase().startsWith('title:')) {
                description.title = comment.substring(6).trim();
            }
            // Rechercher le tag content:
            else if (comment.toLowerCase().startsWith('content:')) {
                const content = comment.substring(8).trim();
                if (content.length > 0) {
                    description.details.push(content);
                }
            }
        } else {
            // Si on rencontre une ligne non-commentaire et qu'on a déjà des données, on arrête
            if (description.title || description.details.length > 0) {
                break;
            }
        }
    }

    return (description.title || description.details.length) ? description : null;
}

/* ---------------------- Gestion du mode switch ---------------------- */
/**
 * Initialise le mode switch commun
 */
function initializeModeSwitch() {
    document.addEventListener('DOMContentLoaded', () => {
        const modeToggle = $('#modeToggle');

        // Déterminer si on est en mode avancé en fonction de la page actuelle
        const isAdvancedMode = window.location.pathname.includes('index_advanced.html');

        if (modeToggle) {
            modeToggle.onchange = () => {
                if (isAdvancedMode) {
                    // On est sur la page avancée, si décoché, aller vers le mode débutant
                    if (!modeToggle.checked) {
                        localStorage.setItem('centipede-mode', 'beginner');
                        window.location.href = 'index.html';
                    }
                } else {
                    // On est sur la page débutant, si coché, aller vers le mode avancé
                    if (modeToggle.checked) {
                        localStorage.setItem('centipede-mode', 'advanced');
                        window.location.href = 'index_advanced.html';
                    }
                }
            };
        }
    });
}

// Initialiser le mode switch
initializeModeSwitch();
