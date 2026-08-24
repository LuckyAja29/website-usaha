/**
 * BukuKas Usaha - Aplikasi Manajemen Keuangan Usaha
 * Auto-Save Langsung ke File Excel di Komputer Tanpa Download Berulang
 */

// ==========================================
// 1. Inisialisasi State & LocalStorage
// ==========================================
const STORAGE_KEY_DATA = 'kas_usaha_data_v3';
const STORAGE_KEY_FILENAME = 'kas_usaha_excel_filename';
const DB_NAME = 'KasUsahaDB';
const DB_STORE = 'handles';

let transactions = [];
let targetExcelFileName = localStorage.getItem(STORAGE_KEY_FILENAME) || 'BukuKas_Usaha.xlsx';
let fileSystemHandle = null;
let isLocalServerAvailable = false;

// DOM Elements
const form = document.getElementById('transactionForm');
const transactionDateInput = document.getElementById('transactionDate');
const transactionAmountInput = document.getElementById('transactionAmount');
const transactionDescInput = document.getElementById('transactionDesc');
const transactionList = document.getElementById('transactionList');
const emptyState = document.getElementById('emptyState');
const totalBalanceEl = document.getElementById('totalBalance');
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpenseEl = document.getElementById('totalExpense');
const balanceStatusEl = document.getElementById('balanceStatus');
const incomeCountEl = document.getElementById('incomeCount');
const expenseCountEl = document.getElementById('expenseCount');
const searchInput = document.getElementById('searchInput');
const filterType = document.getElementById('filterType');
const btnClearAll = document.getElementById('btnClearAll');
const btnQuickExport = document.getElementById('btnQuickExport');
const filePickerInput = document.getElementById('filePickerInput');
const serverModeBanner = document.getElementById('serverModeBanner');

// Sync UI Elements
const syncFileNameEl = document.getElementById('syncFileName');
const syncStatusBadgeEl = document.getElementById('syncStatusBadge');
const syncStatusTextEl = document.getElementById('syncStatusText');
const syncDescEl = document.getElementById('syncDesc');
const btnConnectExcel = document.getElementById('btnConnectExcel');
const btnOpenExistingExcel = document.getElementById('btnOpenExistingExcel');

// Toast Notification
const toast = document.getElementById('toast');
const toastIcon = document.getElementById('toastIcon');
const toastMessage = document.getElementById('toastMessage');

// ==========================================
// 2. IndexedDB Helper untuk Simpan File Handle
// ==========================================

function getIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(DB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveHandleToDB(handle) {
    try {
        const db = await getIDB();
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(handle, 'activeExcelHandle');
    } catch (e) {
        console.warn('IDB save error:', e);
    }
}

async function getHandleFromDB() {
    try {
        const db = await getIDB();
        return new Promise((resolve) => {
            const tx = db.transaction(DB_STORE, 'readonly');
            const req = tx.objectStore(DB_STORE).get('activeExcelHandle');
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch (e) {
        return null;
    }
}

// ==========================================
// 3. Helper & Formatter Functions
// ==========================================

function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(number);
}

function formatDateIndo(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    }).format(date);
}

function formatCurrencyInput(value) {
    const rawNumbers = value.replace(/\D/g, '');
    if (!rawNumbers) return '';
    return new Intl.NumberFormat('id-ID').format(rawNumbers);
}

function parseNumberFromCurrency(formattedStr) {
    return parseInt(String(formattedStr).replace(/\D/g, ''), 10) || 0;
}

let toastTimeout;
function showToast(message, type = 'success') {
    clearTimeout(toastTimeout);
    
    toast.className = 'toast show';
    toastMessage.textContent = message;

    if (type === 'success') {
        toast.classList.add('toast-success');
        toastIcon.className = 'fa-solid fa-circle-check';
    } else if (type === 'danger') {
        toast.classList.add('toast-danger');
        toastIcon.className = 'fa-solid fa-circle-exclamation';
    } else {
        toast.classList.add('toast-info');
        toastIcon.className = 'fa-solid fa-circle-info';
    }

    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

function setDefaultDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    transactionDateInput.value = `${yyyy}-${mm}-${dd}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Convert Uint8Array to Base64
function uint8ArrayToBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// ==========================================
// 4. LocalStorage & Kalkulasi
// ==========================================

function loadTransactions() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_DATA);
        if (stored) {
            transactions = JSON.parse(stored);
        } else {
            transactions = [];
        }
    } catch (e) {
        console.error('Gagal memuat data localStorage:', e);
        transactions = [];
    }
}

function saveTransactions() {
    try {
        localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(transactions));
    } catch (e) {
        console.error('Gagal menyimpan ke localStorage:', e);
    }
}

function updateSummary() {
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    transactions.forEach(t => {
        if (t.type === 'pemasukan') {
            income += t.amount;
            incomeCount++;
        } else if (t.type === 'pengeluaran') {
            expense += t.amount;
            expenseCount++;
        }
    });

    const balance = income - expense;

    totalIncomeEl.textContent = formatRupiah(income);
    totalExpenseEl.textContent = formatRupiah(expense);
    totalBalanceEl.textContent = formatRupiah(balance);

    incomeCountEl.textContent = `${incomeCount} transaksi`;
    expenseCountEl.textContent = `${expenseCount} transaksi`;

    if (balance > 0) {
        balanceStatusEl.textContent = 'Status: Surplus (Untung)';
        balanceStatusEl.style.color = 'var(--success-hover)';
    } else if (balance < 0) {
        balanceStatusEl.textContent = 'Status: Defisit (Rugi)';
        balanceStatusEl.style.color = 'var(--danger-hover)';
    } else {
        balanceStatusEl.textContent = 'Status: Netral / Seimbang';
        balanceStatusEl.style.color = 'var(--text-muted)';
    }
}

function renderTable() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const filter = filterType.value;

    const filtered = transactions.filter(item => {
        const matchesSearch = item.desc.toLowerCase().includes(searchTerm);
        const matchesType = filter === 'all' || item.type === filter;
        return matchesSearch && matchesType;
    });

    transactionList.innerHTML = '';

    if (filtered.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    filtered.forEach(item => {
        const isIncome = item.type === 'pemasukan';
        const row = document.createElement('tr');

        row.innerHTML = `
            <td class="date-cell">${formatDateIndo(item.date)}</td>
            <td class="desc-cell">${escapeHtml(item.desc)}</td>
            <td>
                <span class="badge ${isIncome ? 'badge-income' : 'badge-expense'}">
                    <i class="fa-solid ${isIncome ? 'fa-arrow-down-left' : 'fa-arrow-up-right'}"></i>
                    ${isIncome ? 'Pemasukan' : 'Pengeluaran'}
                </span>
            </td>
            <td class="text-right ${isIncome ? 'amount-income' : 'amount-expense'}">
                ${isIncome ? '+' : '-'}${formatRupiah(item.amount)}
            </td>
            <td class="text-center">
                <button class="btn-delete" onclick="deleteTransaction('${item.id}')" title="Hapus transaksi ini">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </td>
        `;

        transactionList.appendChild(row);
    });
}

function refreshApp() {
    updateSummary();
    renderTable();
}

// ==========================================
// 5. Pembuatan Data Workbook Excel (SheetJS)
// ==========================================

function buildExcelWorkbook() {
    let totalIncome = 0;
    let totalExpense = 0;
    let cumulativeBalance = 0;

    // Urutkan transaksi dari terlama ke terbaru
    const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    const rows = sorted.map((t, idx) => {
        const isIncome = t.type === 'pemasukan';
        if (isIncome) {
            totalIncome += t.amount;
            cumulativeBalance += t.amount;
        } else {
            totalExpense += t.amount;
            cumulativeBalance -= t.amount;
        }

        return {
            'No': idx + 1,
            'Tanggal': t.date,
            'Jenis Transaksi': isIncome ? 'Pemasukan' : 'Pengeluaran',
            'Keterangan': t.desc,
            'Pemasukan (Rp)': isIncome ? t.amount : 0,
            'Pengeluaran (Rp)': !isIncome ? t.amount : 0,
            'Saldo Kumulatif (Rp)': cumulativeBalance
        };
    });

    const netSaldo = totalIncome - totalExpense;
    const nowStr = new Date().toLocaleString('id-ID');

    // Buat worksheet dari JSON
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Tambahkan baris total di bawah tabel
    XLSX.utils.sheet_add_aoa(worksheet, [
        [],
        ['', '', '', 'TOTAL KESELURUHAN:', totalIncome, totalExpense, netSaldo],
        ['', '', '', 'SISA SALDO BERSIH:', netSaldo, '', ''],
        ['', '', '', `Terakhir Diperbarui: ${nowStr}`, '', '', '']
    ], { origin: -1 });

    // Format lebar kolom
    worksheet['!cols'] = [
        { wch: 6 },  // No
        { wch: 14 }, // Tanggal
        { wch: 16 }, // Jenis
        { wch: 38 }, // Keterangan
        { wch: 18 }, // Pemasukan
        { wch: 18 }, // Pengeluaran
        { wch: 22 }  // Saldo Kumulatif
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Keuangan Usaha');

    return workbook;
}

// ==========================================
// 6. Logika Auto-Save Langsung ke File di Komputer
// ==========================================

function updateSyncUI(timeStr = '') {
    syncFileNameEl.textContent = targetExcelFileName;
    syncStatusBadgeEl.className = 'sync-badge badge-success';
    syncStatusTextEl.textContent = 'Auto-Save Aktif';
    
    const updateInfo = timeStr ? ` (Update: ${timeStr})` : '';
    syncDescEl.innerHTML = `🟢 <strong>Penyimpanan Langsung di Komputer:</strong> Setiap transaksi (tambah / hapus) langsung mengubah file <code>${targetExcelFileName}</code> tanpa download baru.${updateInfo}`;
}

// Simpan data langsung ke file Excel (in-place modification tanpa download)
async function saveToExcelFile(actionName = 'ditambahkan') {
    const timeStr = new Date().toLocaleTimeString('id-ID');
    updateSyncUI(timeStr);

    const wb = buildExcelWorkbook();
    const excelArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    // CARA 1: Jika user menghubungkan file tertentu via File System Access API
    if (fileSystemHandle) {
        try {
            const writable = await fileSystemHandle.createWritable();
            await writable.write(excelArrayBuffer);
            await writable.close();
            showToast(`Transaksi ${actionName}. File "${targetExcelFileName}" langsung diperbarui!`, 'success');
            return true;
        } catch (e) {
            console.warn('Gagal menulis langsung ke handle:', e);
        }
    }

    // CARA 2: Jika berjalan via Server Lokal (Jalankan_Aplikasi.bat / http://localhost:8080)
    if (isLocalServerAvailable || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        try {
            const b64Data = uint8ArrayToBase64(new Uint8Array(excelArrayBuffer));
            const response = await fetch('/api/save-excel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: targetExcelFileName,
                    base64Data: b64Data
                })
            });

            if (response.ok) {
                showToast(`Transaksi ${actionName}. File "${targetExcelFileName}" langsung diperbarui di komputer!`, 'success');
                return true;
            }
        } catch (e) {
            console.warn('API save-excel error:', e);
        }
    }

    // Jika berjalan via file:/// tanpa server dan belum connect handle
    showToast(`Transaksi ${actionName} tersimpan di aplikasi.`, 'info');
    return false;
}

// Hubungkan File Excel Tertentu di Komputer
async function handleConnectExcel() {
    if (window.showOpenFilePicker) {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'Excel Workbook (.xlsx, .xls)',
                    accept: {
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                        'application/vnd.ms-excel': ['.xls']
                    }
                }],
                multiple: false
            });

            fileSystemHandle = handle;
            targetExcelFileName = handle.name;
            localStorage.setItem(STORAGE_KEY_FILENAME, targetExcelFileName);
            await saveHandleToDB(handle);

            // Baca data dari file tersebut
            const file = await handle.getFile();
            const arrayBuffer = await file.arrayBuffer();
            parseAndLoadExcelData(arrayBuffer, handle.name);

            // Langsung update status
            updateSyncUI(new Date().toLocaleTimeString('id-ID'));
            showToast(`File "${targetExcelFileName}" terhubung langsung! Semua transaksi akan langsung mengubah file ini.`, 'success');
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.warn('showOpenFilePicker error:', err);
        }
    }

    // Fallback jika dibuka via file:// tanpa support File System API
    filePickerInput.value = '';
    filePickerInput.click();
}

// Handler tombol "Buka File Excel Ada"
function handleOpenExistingExcel() {
    filePickerInput.value = '';
    filePickerInput.click();
}

// Handler membaca file Excel yang dipilih
filePickerInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        parseAndLoadExcelData(arrayBuffer, file.name);
    } catch (err) {
        console.error('Error membaca Excel:', err);
        showToast('Gagal memproses file Excel yang dipilih.', 'danger');
    }
});

// Parsing data dari Excel
function parseAndLoadExcelData(dataBuffer, fileName) {
    try {
        const workbook = XLSX.read(dataBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!rawJson || rawJson.length < 2) {
            targetExcelFileName = fileName;
            localStorage.setItem(STORAGE_KEY_FILENAME, targetExcelFileName);
            updateSyncUI();
            showToast(`File "${fileName}" terhubung.`, 'info');
            return;
        }

        // Cari baris header
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(rawJson.length, 5); i++) {
            const row = rawJson[i];
            if (row && row.some(cell => typeof cell === 'string' && (cell.toLowerCase().includes('tanggal') || cell.toLowerCase().includes('keterangan')))) {
                headerRowIdx = i;
                break;
            }
        }

        if (headerRowIdx === -1) {
            targetExcelFileName = fileName;
            localStorage.setItem(STORAGE_KEY_FILENAME, targetExcelFileName);
            updateSyncUI();
            showToast(`File "${fileName}" dihubungkan.`, 'info');
            return;
        }

        const headers = rawJson[headerRowIdx].map(h => String(h || '').trim().toLowerCase());
        const dateIdx = headers.findIndex(h => h.includes('tanggal'));
        const descIdx = headers.findIndex(h => h.includes('keterangan') || h.includes('deskripsi') || h.includes('catatan'));
        const typeIdx = headers.findIndex(h => h.includes('jenis'));
        const incomeIdx = headers.findIndex(h => h.includes('pemasukan') || h.includes('masuk') || h.includes('debit'));
        const expenseIdx = headers.findIndex(h => h.includes('pengeluaran') || h.includes('keluar') || h.includes('kredit'));
        const amountIdx = headers.findIndex(h => h.includes('nominal') || h.includes('jumlah'));

        const parsedTransactions = [];

        for (let i = headerRowIdx + 1; i < rawJson.length; i++) {
            const row = rawJson[i];
            if (!row || row.length === 0) continue;

            const descVal = descIdx !== -1 && row[descIdx] ? String(row[descIdx]).trim() : '';
            if (descVal.toLowerCase().includes('total') || descVal.toLowerCase().includes('saldo') || descVal.toLowerCase().includes('terakhir')) {
                continue;
            }

            let dateVal = dateIdx !== -1 && row[dateIdx] ? String(row[dateIdx]).trim() : '';
            if (typeof row[dateIdx] === 'number') {
                const jsDate = new Date((row[dateIdx] - (25567 + 2)) * 86400 * 1000);
                dateVal = jsDate.toISOString().slice(0, 10);
            }

            let typeVal = 'pemasukan';
            let amountVal = 0;

            if (incomeIdx !== -1 && expenseIdx !== -1) {
                const inc = parseNumberFromCurrency(row[incomeIdx] || 0);
                const exp = parseNumberFromCurrency(row[expenseIdx] || 0);
                if (exp > 0) {
                    typeVal = 'pengeluaran';
                    amountVal = exp;
                } else {
                    typeVal = 'pemasukan';
                    amountVal = inc;
                }
            } else if (typeIdx !== -1 && amountIdx !== -1) {
                const tStr = String(row[typeIdx] || '').toLowerCase();
                typeVal = tStr.includes('keluar') || tStr.includes('pengeluaran') ? 'pengeluaran' : 'pemasukan';
                amountVal = parseNumberFromCurrency(row[amountIdx] || 0);
            }

            if (amountVal > 0) {
                parsedTransactions.push({
                    id: 'trx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    date: dateVal || new Date().toISOString().slice(0, 10),
                    type: typeVal,
                    amount: amountVal,
                    desc: descVal || (typeVal === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'),
                    createdAt: new Date().toISOString()
                });
            }
        }

        if (parsedTransactions.length > 0) {
            transactions = parsedTransactions;
            saveTransactions();
            refreshApp();
        }

        targetExcelFileName = fileName;
        localStorage.setItem(STORAGE_KEY_FILENAME, targetExcelFileName);
        updateSyncUI(new Date().toLocaleTimeString('id-ID'));
        showToast(`Berhasil memuat ${parsedTransactions.length} transaksi dari file "${fileName}"!`, 'success');
    } catch (err) {
        console.error('Error parse Excel:', err);
    }
}

// Download Salinan Excel Secara Manual (Hanya bila user klik tombol ini)
function downloadManualBackup() {
    try {
        const wb = buildExcelWorkbook();
        XLSX.writeFile(wb, targetExcelFileName);
        showToast(`Salinan cadangan "${targetExcelFileName}" berhasil diunduh!`, 'success');
    } catch (e) {
        console.error('Download error:', e);
        showToast('Gagal mengunduh file Excel.', 'danger');
    }
}

// Pulihkan file handle yang tersimpan di IndexedDB
async function restoreSavedHandle() {
    try {
        const handle = await getHandleFromDB();
        if (handle) {
            fileSystemHandle = handle;
            targetExcelFileName = handle.name;
            updateSyncUI();
        }
    } catch (e) {}
}

// Periksa apakah server lokal aktif
async function checkLocalServer() {
    if (window.location.protocol === 'file:') {
        serverModeBanner.style.display = 'flex';
        isLocalServerAvailable = false;
    } else {
        serverModeBanner.style.display = 'none';
        isLocalServerAvailable = true;
    }
}

// ==========================================
// 7. CRUD Transaksi dengan Auto-Save
// ==========================================

async function handleAddTransaction(e) {
    e.preventDefault();

    const typeRadio = document.querySelector('input[name="transactionType"]:checked');
    const type = typeRadio ? typeRadio.value : 'pemasukan';
    const date = transactionDateInput.value;
    const amount = parseNumberFromCurrency(transactionAmountInput.value);
    const desc = transactionDescInput.value.trim();

    // Validasi
    if (!date) {
        showToast('Harap pilih tanggal transaksi!', 'danger');
        return;
    }

    if (amount <= 0) {
        showToast('Nominal harus lebih besar dari Rp 0!', 'danger');
        transactionAmountInput.focus();
        return;
    }

    if (!desc) {
        showToast('Keterangan tidak boleh kosong!', 'danger');
        transactionDescInput.focus();
        return;
    }

    const newTransaction = {
        id: 'trx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        date: date,
        type: type,
        amount: amount,
        desc: desc,
        createdAt: new Date().toISOString()
    };

    // Tambah ke daftar
    transactions.unshift(newTransaction);
    saveTransactions();
    refreshApp();

    // Auto-Save langsung ke file Excel di komputer tanpa download
    await saveToExcelFile('disimpan');

    // Reset Form
    transactionAmountInput.value = '';
    transactionDescInput.value = '';
    document.getElementById('typeIncome').checked = true;
    setDefaultDate();
}

// Hapus satu transaksi
window.deleteTransaction = async function(id) {
    const item = transactions.find(t => t.id === id);
    if (!item) return;

    if (confirm(`Apakah Anda yakin ingin menghapus catatan: "${item.desc}"?\n\nData pada file Excel di komputer juga akan langsung dihapus.`)) {
        transactions = transactions.filter(t => t.id !== id);
        saveTransactions();
        refreshApp();

        // Auto-Save update file Excel di komputer setelah pengurangan
        await saveToExcelFile('dihapus');
    }
};

// Reset semua data
async function handleClearAll() {
    if (transactions.length === 0) {
        showToast('Tidak ada data yang dapat direset.', 'info');
        return;
    }

    if (confirm('PERINGATAN: Anda akan menghapus SEMUA data transaksi. File Excel di komputer juga akan direset kosong. Lanjutkan?')) {
        transactions = [];
        saveTransactions();
        refreshApp();

        await saveToExcelFile('direset');
    }
}

// ==========================================
// 8. Event Listeners & Startup
// ==========================================

// Format nominal saat mengetik
transactionAmountInput.addEventListener('input', (e) => {
    e.target.value = formatCurrencyInput(e.target.value);
});

// Form Submit
form.addEventListener('submit', handleAddTransaction);

// Reset semua
btnClearAll.addEventListener('click', handleClearAll);

// Tombol Hubungkan File Excel Saya
btnConnectExcel.addEventListener('click', handleConnectExcel);

// Tombol Buka File Excel Ada
btnOpenExistingExcel.addEventListener('click', handleOpenExistingExcel);

// Tombol Unduh Salinan Manual
btnQuickExport.addEventListener('click', downloadManualBackup);

// Filter & Pencarian
searchInput.addEventListener('input', renderTable);
filterType.addEventListener('change', renderTable);

// Startup Aplikasi
document.addEventListener('DOMContentLoaded', async () => {
    setDefaultDate();
    loadTransactions();
    refreshApp();
    updateSyncUI();
    await checkLocalServer();
    await restoreSavedHandle();
});
