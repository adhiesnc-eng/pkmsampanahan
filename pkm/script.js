/**
 * SISTEM PRESENSI PERAWAT - PUSKESMAS SAMPANAHAN
 * Logika dan Sinkronisasi Cloud
 */

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw-Fl_qSNgqr9oEnn3vUmCtN4bRCZ5M7wz5YMiofUD33pN-kICuL6zubelKVcI_k2luXg/exec";

const db = {
    activeUser: localStorage.getItem('presensi_user') || null,
    isSettingsAuth: localStorage.getItem('is_admin_auth') === 'true',
    isChatAuth: localStorage.getItem('is_chat_auth') === 'true',
    activeView: 'home',
    lastChatId: localStorage.getItem('last_chat_id') || "0",
    officers: [], 
    logs: [], 
    schedule: {}, 
    attendance: {}, 
    holidays: [],
    chat: [], 
    config: { 
        adminPin: "1111", 
        chatPin: "ugd", 
        qrData: "SISTEM-PRO-01", 
        themeColor: '#0d9488', 
        navLayout: 'grid', 
        voice: true, 
        shiftHours: { 
            Pagi: { start: "08:00", end: "14:00" }, 
            Siang: { start: "14:00", end: "20:00" }, 
            Malam: { start: "20:00", end: "08:00" } 
        }, 
        rates: { biasa: 0, besar: 0 } 
    }
};

let h5q = null;

// --- UTILITIES ---
function safeSetText(id, txt) { const el = document.getElementById(id); if(el) el.innerText = txt; }
function safeSetHTML(id, html) { const el = document.getElementById(id); if(el) el.innerHTML = html; }

function showLoading(s) { 
    const l = document.getElementById('loading'); 
    if(l) s ? l.classList.remove('hidden') : l.classList.add('hidden'); 
}

function showModernNotify(type, title, msg) {
    const toast = document.getElementById('modern-toast');
    if(!toast) return;
    toast.classList.add('show');
    safeSetText('toast-title', title); 
    safeSetText('toast-body', msg);
    setTimeout(() => { toast.classList.remove('show'); }, 5000);
}

// --- DATA FETCHING ---
async function fetchWithRetry(url, options = {}, retries = 5) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error("HTTP Error");
        return response;
    } catch (error) {
        if (retries > 0) return fetchWithRetry(url, options, retries - 1);
        throw error;
    }
}

window.loadData = async function(mode) {
    if(mode !== 'background') showLoading(true);
    try {
        const r = await fetchWithRetry(WEB_APP_URL + "?action=getData", { method: "GET" });
        const d = await r.json();
        
        db.officers = d.officers || []; 
        db.logs = d.logs || []; 
        db.schedule = d.schedule || {}; 
        db.chat = d.chat || []; 
        if(d.config) db.config = Object.assign(db.config, d.config);
        
        window.render();
    } catch(e) { 
        console.error("Gagal memuat data:", e);
    } finally { showLoading(false); }
};

// --- RENDER LOGIC ---
window.render = function() {
    const now = new Date();
    safeSetText('clock', now.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }));
    safeSetText('date-label', now.toLocaleDateString('id-ID', { weekday:'long', day:'2-digit', month:'long' }));
    
    // Sync User UI
    safeSetText('user-display-name', db.activeUser || "Selamat Datang");
    const sel = document.getElementById('select-onboarding'); 
    if(sel) sel.innerHTML = db.officers.length ? '<option value="">-- PILIH IDENTITAS --</option>' + db.officers.map(o => `<option value="${o}" ${db.activeUser === o ? 'selected' : ''}>${o}</option>`).join('') : '<option value="">Daftar Kosong</option>';
    
    document.getElementById('section-login').classList.toggle('hidden', !!db.activeUser);
    document.getElementById('logout-btn').classList.toggle('hidden', !db.activeUser);

    // Update Theme
    const color = db.config.themeColor || '#0d9488';
    document.getElementById('dynamic-theme').innerHTML = `:root { --primary: ${color}; --primary-light: ${color}15; --accent: #f43f5e; --bg: #f8fafc; }`;
};

// --- ACTIONS ---
window.lockAccount = function() { 
    const v = document.getElementById('select-onboarding').value; 
    if(!v) return; 
    db.activeUser = v; 
    localStorage.setItem('presensi_user', v); 
    window.render(); 
};

window.logout = function() { 
    if(confirm("Keluar dari sesi ini?")) { 
        localStorage.removeItem('presensi_user'); 
        db.activeUser=null; 
        window.render(); 
    } 
};

window.showView = function(v) { 
    document.querySelectorAll('.view-content').forEach(el => el.classList.remove('active')); 
    document.getElementById('view-'+v).classList.add('active'); 
    document.querySelectorAll('.nav-card-item').forEach(el => el.classList.remove('active')); 
    document.getElementById('nav-'+v)?.classList.add('active'); 
};

window.togglePanel = (id) => { document.getElementById(id).classList.toggle('open'); };

window.openScanModal = async function() {
    if(!db.activeUser) return showModernNotify('error', 'Login!', 'Pilih perawat di Beranda.');
    const modal = document.getElementById('modal-scan');
    modal.style.display = 'flex';
    try {
        if(!h5q) h5q = new Html5Qrcode("reader");
        await h5q.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (txt) => {
            if(txt === db.config.qrData) {
                h5q.stop();
                modal.style.display = 'none';
                showModernNotify('success', 'Berhasil', 'Presensi Anda telah tercatat.');
            }
        });
    } catch (e) { 
        modal.style.display = 'none'; 
        showModernNotify('error', 'Kamera', 'Berikan izin akses kamera.'); 
    }
};

window.closeModal = async () => { 
    if(h5q) { try{await h5q.stop();}catch(e){} } 
    document.getElementById('modal-scan').style.display = 'none'; 
};

// --- INITIALIZATION ---
window.onload = () => {
    window.loadData();
    setInterval(() => { window.loadData('background'); }, 60000); // Sync tiap 1 menit
};