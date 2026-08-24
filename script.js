/**
 * BukuKas Usaha - Aplikasi Manajemen Keuangan Usaha (Supabase Cloud Version)
 */

// ==========================================
// 1. Inisialisasi Supabase Client
// ==========================================
// GANTI DENGAN URL & ANON KEY DARI DASHBOARD SUPABASE ANDA
const SUPABASE_URL = "https://kvzprcxnixuhvrsxercw.supabase.co/rest/v1/";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2enByY3huaXh1aHZyc3hlcmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NjYxODIsImV4cCI6MjEwMzE0MjE4Mn0.-EGpdF6WbjYdQxECZw_7WF73l0Ky3o35wMMVSUem0Zs";

// Membuat koneksi ke Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let transactions = [];

// DOM Elements
const form = document.getElementById("transactionForm");
const transactionDateInput = document.getElementById("transactionDate");
const transactionAmountInput = document.getElementById("transactionAmount");
const transactionDescInput = document.getElementById("transactionDesc");
const transactionList = document.getElementById("transactionList");
const emptyState = document.getElementById("emptyState");
const totalBalanceEl = document.getElementById("totalBalance");
const totalIncomeEl = document.getElementById("totalIncome");
const totalExpenseEl = document.getElementById("totalExpense");
const balanceStatusEl = document.getElementById("balanceStatus");
const incomeCountEl = document.getElementById("incomeCount");
const expenseCountEl = document.getElementById("expenseCount");
const searchInput = document.getElementById("searchInput");
const filterType = document.getElementById("filterType");
const btnClearAll = document.getElementById("btnClearAll");
const btnQuickExport = document.getElementById("btnQuickExport");

// Sync UI Elements
const syncFileNameEl = document.getElementById("syncFileName");
const syncStatusBadgeEl = document.getElementById("syncStatusBadge");
const syncStatusTextEl = document.getElementById("syncStatusText");
const syncDescEl = document.getElementById("syncDesc");

// Toast Notification
const toast = document.getElementById("toast");
const toastIcon = document.getElementById("toastIcon");
const toastMessage = document.getElementById("toastMessage");

// ==========================================
// 2. Helper & Formatter Functions
// ==========================================

function formatRupiah(number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(number);
}

function formatDateIndo(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatCurrencyInput(value) {
  const rawNumbers = String(value).replace(/\D/g, "");
  if (!rawNumbers) return "";
  return new Intl.NumberFormat("id-ID").format(rawNumbers);
}

function parseNumberFromCurrency(formattedStr) {
  return parseInt(String(formattedStr).replace(/\D/g, ""), 10) || 0;
}

let toastTimeout;
function showToast(message, type = "success") {
  clearTimeout(toastTimeout);

  toast.className = "toast show";
  toastMessage.textContent = message;

  if (type === "success") {
    toast.classList.add("toast-success");
    toastIcon.className = "fa-solid fa-circle-check";
  } else if (type === "danger") {
    toast.classList.add("toast-danger");
    toastIcon.className = "fa-solid fa-circle-exclamation";
  } else {
    toast.classList.add("toast-info");
    toastIcon.className = "fa-solid fa-circle-info";
  }

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}

function setDefaultDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  transactionDateInput.value = `${yyyy}-${mm}-${dd}`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ==========================================
// 3. Muat Data dari Supabase Cloud Database
// ==========================================

async function loadTransactions() {
  try {
    const { data, error } = await supabaseClient
      .from("transactions")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      console.error("Error load Supabase:", error);
      showToast(
        "Gagal memuat data dari Cloud Database: " + error.message,
        "danger",
      );
      return;
    }

    transactions = data || [];
    refreshApp();
    updateSyncUI();
  } catch (err) {
    console.error("Connection error:", err);
    showToast("Terjadi kesalahan koneksi ke database.", "danger");
  }
}

function updateSummary() {
  let income = 0;
  let expense = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  transactions.forEach((t) => {
    const amt = Number(t.amount) || 0;
    if (t.type === "pemasukan") {
      income += amt;
      incomeCount++;
    } else if (t.type === "pengeluaran") {
      expense += amt;
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
    balanceStatusEl.textContent = "Status: Surplus (Untung)";
    balanceStatusEl.style.color = "var(--success-hover)";
  } else if (balance < 0) {
    balanceStatusEl.textContent = "Status: Defisit (Rugi)";
    balanceStatusEl.style.color = "var(--danger-hover)";
  } else {
    balanceStatusEl.textContent = "Status: Netral / Seimbang";
    balanceStatusEl.style.color = "var(--text-muted)";
  }
}

function renderTable() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const filter = filterType.value;

  const filtered = transactions.filter((item) => {
    const matchesSearch = (item.desc || "").toLowerCase().includes(searchTerm);
    const matchesType = filter === "all" || item.type === filter;
    return matchesSearch && matchesType;
  });

  transactionList.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.style.display = "flex";
    return;
  }

  emptyState.style.display = "none";

  filtered.forEach((item) => {
    const isIncome = item.type === "pemasukan";
    const row = document.createElement("tr");

    row.innerHTML = `
            <td class="date-cell">${formatDateIndo(item.date)}</td>
            <td class="desc-cell">${escapeHtml(item.desc || "")}</td>
            <td>
                <span class="badge ${isIncome ? "badge-income" : "badge-expense"}">
                    <i class="fa-solid ${isIncome ? "fa-arrow-down-left" : "fa-arrow-up-right"}"></i>
                    ${isIncome ? "Pemasukan" : "Pengeluaran"}
                </span>
            </td>
            <td class="text-right ${isIncome ? "amount-income" : "amount-expense"}">
                ${isIncome ? "+" : "-"}${formatRupiah(item.amount)}
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

function updateSyncUI() {
  if (syncFileNameEl) syncFileNameEl.textContent = "Supabase Cloud DB";
  if (syncStatusBadgeEl)
    syncStatusBadgeEl.className = "sync-badge badge-success";
  if (syncStatusTextEl) syncStatusTextEl.textContent = "Terhubung Ke Cloud";
  if (syncDescEl) {
    syncDescEl.innerHTML = `🟢 <strong>Penyimpanan Cloud Permanen:</strong> Seluruh data disimpan di Supabase Cloud Database.`;
  }
}

// ==========================================
// 4. Tambah Transaksi ke Supabase Cloud
// ==========================================

async function handleAddTransaction(e) {
  e.preventDefault();

  const typeRadio = document.querySelector(
    'input[name="transactionType"]:checked',
  );
  const type = typeRadio ? typeRadio.value : "pemasukan";
  const date = transactionDateInput.value;
  const amount = parseNumberFromCurrency(transactionAmountInput.value);
  const desc = transactionDescInput.value.trim();

  // Validasi input
  if (!date) {
    showToast("Harap pilih tanggal transaksi!", "danger");
    return;
  }

  if (amount <= 0) {
    showToast("Nominal harus lebih besar dari Rp 0!", "danger");
    transactionAmountInput.focus();
    return;
  }

  if (!desc) {
    showToast("Keterangan tidak boleh kosong!", "danger");
    transactionDescInput.focus();
    return;
  }

  const newTransaction = {
    date: date,
    type: type,
    amount: amount,
    desc: desc,
  };

  // Simpan data ke tabel 'transactions' di Supabase
  const { data, error } = await supabaseClient
    .from("transactions")
    .insert([newTransaction]);

  if (error) {
    console.error("Error insert data:", error);
    showToast("Gagal menyimpan ke database: " + error.message, "danger");
  } else {
    showToast("Transaksi berhasil tersimpan di Cloud Database!", "success");

    // Reset form input
    transactionAmountInput.value = "";
    transactionDescInput.value = "";
    document.getElementById("typeIncome").checked = true;
    setDefaultDate();

    // Muat ulang data terbaru dari Supabase
    await loadTransactions();
  }
}

// ==========================================
// 5. Hapus Transaksi dari Supabase
// ==========================================

window.deleteTransaction = async function (id) {
  const item = transactions.find((t) => String(t.id) === String(id));
  if (!item) return;

  if (confirm(`Apakah Anda yakin ingin menghapus catatan: "${item.desc}"?`)) {
    const { error } = await supabaseClient
      .from("transactions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error delete data:", error);
      showToast("Gagal menghapus data: " + error.message, "danger");
    } else {
      showToast("Transaksi berhasil dihapus.", "success");
      await loadTransactions();
    }
  }
};

// Reset/Hapus Semua Data Transaksi
async function handleClearAll() {
  if (transactions.length === 0) {
    showToast("Tidak ada data yang dapat direset.", "info");
    return;
  }

  if (
    confirm(
      "PERINGATAN: Anda akan menghapus SEMUA data transaksi di Cloud Database. Lanjutkan?",
    )
  ) {
    const { error } = await supabaseClient
      .from("transactions")
      .delete()
      .neq("id", 0); // Menghapus semua id

    if (error) {
      console.error("Error clear all:", error);
      showToast("Gagal me-reset data: " + error.message, "danger");
    } else {
      showToast("Semua data berhasil direset.", "success");
      await loadTransactions();
    }
  }
}

// ==========================================
// 6. Export Data ke File Excel (Manual Export)
// ==========================================

function downloadManualBackup() {
  if (transactions.length === 0) {
    showToast("Tidak ada data untuk di-export.", "info");
    return;
  }

  try {
    let totalIncome = 0;
    let totalExpense = 0;
    let cumulativeBalance = 0;

    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );

    const rows = sorted.map((t, idx) => {
      const isIncome = t.type === "pemasukan";
      const amt = Number(t.amount) || 0;
      if (isIncome) {
        totalIncome += amt;
        cumulativeBalance += amt;
      } else {
        totalExpense += amt;
        cumulativeBalance -= amt;
      }

      return {
        No: idx + 1,
        Tanggal: t.date,
        "Jenis Transaksi": isIncome ? "Pemasukan" : "Pengeluaran",
        Keterangan: t.desc,
        "Pemasukan (Rp)": isIncome ? amt : 0,
        "Pengeluaran (Rp)": !isIncome ? amt : 0,
        "Saldo Kumulatif (Rp)": cumulativeBalance,
      };
    });

    const netSaldo = totalIncome - totalExpense;
    const nowStr = new Date().toLocaleString("id-ID");

    const worksheet = XLSX.utils.json_to_sheet(rows);

    XLSX.utils.sheet_add_aoa(
      worksheet,
      [
        [],
        ["", "", "", "TOTAL KESELURUHAN:", totalIncome, totalExpense, netSaldo],
        ["", "", "", "SISA SALDO BERSIH:", netSaldo, "", ""],
        ["", "", "", `Terakhir Diperbarui: ${nowStr}`, "", "", ""],
      ],
      { origin: -1 },
    );

    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 16 },
      { wch: 38 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Keuangan");

    XLSX.writeFile(workbook, "BukuKas_Usaha_Export.xlsx");
    showToast("Salinan Excel berhasil diunduh!", "success");
  } catch (e) {
    console.error("Download error:", e);
    showToast("Gagal mengunduh file Excel.", "danger");
  }
}

// ==========================================
// 7. Event Listeners & Startup
// ==========================================

// Format nominal saat mengetik
transactionAmountInput.addEventListener("input", (e) => {
  e.target.value = formatCurrencyInput(e.target.value);
});

// Form Submit
form.addEventListener("submit", handleAddTransaction);

// Reset semua
if (btnClearAll) btnClearAll.addEventListener("click", handleClearAll);

// Tombol Unduh Salinan Manual
if (btnQuickExport)
  btnQuickExport.addEventListener("click", downloadManualBackup);

// Filter & Pencarian
searchInput.addEventListener("input", renderTable);
filterType.addEventListener("change", renderTable);

// Startup Aplikasi
document.addEventListener("DOMContentLoaded", async () => {
  setDefaultDate();
  await loadTransactions();
});
