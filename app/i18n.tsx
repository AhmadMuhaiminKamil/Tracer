"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "id";

/** One flat dictionary. Two languages and no plurals/interpolation libs needed:
 *  if this grows past a screen, swap for a real i18n package. */
const DICT = {
  en: {
    "nav.main": "Main",
    "nav.activity": "Activity",
    "nav.api": "API",
    "nav.home": "Home",
    "nav.clusters": "Cluster",
    "nav.sessions": "Sessions",
    "nav.cli": "CLI log",
    "nav.keys": "API Keys",
    "brand.tagline": "IDX insider · cached data",
    "snapshot.label": "Data",
    "snapshot.updated": "Updated",
    "snapshot.partial": "partial coverage",
    "snapshot.full": "full coverage",
    "age.fresh": "Data age.",
    "age.stale": "Stale data.",
    "age.minutes": "{n} minutes",
    "age.hours": "{n} hours",
    "age.days": "{n} days",
    "api.enable": "Enable",
    "api.disable": "Disable",
    "age.body": "Data captured {age} ago. Market data only updates when someone runs the ingestion.",
    "age.partial": "Partial coverage: some filing pages were not fetched.",
    "disclaimer": "Research and education only. Not financial advice. This dashboard never calls Sectors.",
    "disclaimer.long":
      "Research and education only. Not financial advice and not a buy or sell recommendation. Data is historical and partial; classification is heuristic.",
    "home.title": "Today at a glance",
    "home.sub": "Every figure is computed from the cached data ({at}), not from polling the market. This dashboard makes no Sectors requests.",
    "kpi.lastPrice": "Last price",
    "kpi.growth": "Growth revenue / earnings",
    "kpi.roe": "ROE / DER",
    "card.missing": "not available",
    "card.caveat1": "Price as of {date}. Annual ratios, not automatically TTM/MRQ; growth is quarterly YoY.",
    "card.caveat2": "ATH follows provider data; corporate actions and historical adjustments need review.",
    "kpi.filings": "Filings passed filter",
    "kpi.filings.hint": "of {scanned} filings scanned · {coverage}",
    "kpi.clusters": "Cluster",
    "kpi.clusters.hint": "{acc} accumulation · {dist} distribution",
    "kpi.value": "Transaction value",
    "kpi.value.hint": "total across every cluster in this window",
    "kpi.parties": "Unique parties",
    "kpi.parties.hint": "caution: party count is not an investment return",
    "kpi.largest": "Largest cluster",
    "kpi.largest.hint": "no data",
    "panel.clusterPos": "Clusters & 52-week position",
    "panel.byValue": "sorted by transaction value",
    "th.ticker": "Ticker",
    "th.parties": "Parties",
    "th.value": "Value",
    "th.pos52w": "52w position",
    "th.direction": "Direction",
    "th.window": "Window",
    "panel.clusterPos.foot":
      "52-week position = (last price − low) ÷ (high − low) from provider data; only tickers with cached prices appear.",
    "panel.sector": "Sector spread",
    "panel.sector.foot": "Sector labels come from cached company reports; clusters without one fall under “Unknown”.",
    "panel.activity": "Recent activity",
    "panel.activity.from": "{n} from CLI",
    "panel.activity.foot": "Read from data/chat_log.jsonl in the Python project. Open the CLI log page for the full history.",
    "panel.howto": "How to read this dashboard",
    "panel.howto.meta": "data limits",
    "howto.1": "<b>Cached data, not live.</b> Figures come from the last manual ingestion; new market data only appears after an operator runs the monitor.",
    "howto.2":
      "<b>Heuristic classification.</b> An <code>investment</code> tag and an ownership change do not prove an open-market cash purchase.",
    "howto.3":
      "<b>Ratio years differ.</b> PE/PB use the valuation year, ROE/DER the annual-ratio year — not TTM/MRQ. Growth is quarterly YoY.",
    "howto.4": "<b>ATH can be distorted.</b> Corporate actions and historical adjustments can shift the peak; drawdown needs review.",
    "howto.5": "<b>Not a recommendation.</b> This dashboard is a research tool, not financial advice or a buy/sell signal.",
    "clusters.title": "Insider clusters",
    "clusters.sub": "{n} clusters from the cached data · click Filing for source evidence. Not live data.",
    "empty.clusters": "No clusters met the criteria in this window.",
    "empty.clustersTable": "No clusters yet.",
    "empty.sectors": "No sector data yet.",
    "empty.cliActivity": "No CLI conversations recorded yet.",
    "empty.cliLog": "No CLI log stored yet.",
    "cli.title": "CLI conversation log",
    "cli.noTool": "no tool",
    "cli.sub":
      "{n} most recent questions from <code>tracer.py</code>, read straight from data/chat_log.jsonl. Never triggers a paid provider call.",
    "chat.title": "Ask Tracer",
    "chat.sub": "Tracer reads the cached IDX insider data. No live provider requests, and no fallback when the gateway fails.",
    "chat.new": "New session",
    "chat.history": "Session history",
    "chat.empty": "No sessions yet. Start from the composer on the right.",
    "chat.count": "{n}/30 sessions",
    "chat.deleteAll": "Delete all",
    "chat.clear": "Clear",
    "chat.notStarted": "not started",
    "chat.reveal": "Reveal",
    "sug.cluster": "Which cluster has the largest value?",
    "sug.accumulation": "Summarise the latest accumulation",
    "sug.sector": "Which sector is the busiest?",
    "sug.heal": "HEAL detail with filing evidence",
    "chat.suggestion": "Try “Which cluster has the largest value?” — each session keeps its own history.",
    "chat.thinking": "Tracer is analysing the data…",
    "chat.placeholder": "Ask about clusters, insiders, or transaction value…",
    "chat.question": "Question",
    "chat.hint": "Enter to send · Shift+Enter for a new line",
    "nav.filings": "Filings",
    "filings.title": "Filing feed",
    "filings.sub": "{n} filings fetched · {buy} buy · {sell} sell. Most never form a cluster.",
    "filings.empty": "No filings yet. Run /newdata in the CLI.",
    "filings.date": "Date",
    "filings.ticker": "Ticker",
    "filings.holder": "Holder",
    "filings.side": "Side",
    "filings.value": "Value",
    "filings.after": "Owns after",
    "filings.evidence": "PDF",
    "filings.pager": "Filing pages",
    "filings.prev": "Previous page",
    "filings.next": "Next page",
    "cmd.list": "Available commands",
    "cmd.scan": "list the latest clusters",
    "cmd.detail": "one issuer's detail and filings",
    "cmd.newdata": "pull fresh data from Sectors (1 credit)",
    "cmd.history": "conversation history",
    "cmd.session": "open the session picker",
    "cmd.help": "this help",
    "cmd.quit": "exit",
    "setup.b":
      "<b>Setup.</b> Add your own keys in <b>API Keys</b>, or copy <code>.env.local.example</code> to <code>.env.local</code>. Then pull data from the CLI: run <code>tracer</code> and type <code>/newdata</code>. Everything stays on this machine.",
    "refresh.done": "Fresh data pulled: {rows} filings cached. {credits} credit spent.",
    "refresh.failed": "Could not pull new data",
    "refresh.hint": "/newdata pulls fresh data (costs credits)",
    "chat.send": "Send",
    "chat.messages": "{n} messages",
    "chat.justNow": "just now",
    "chat.delete": "Delete",
    "step.1": "Reading the cached data",
    "step.2": "Selecting the relevant tool",
    "step.3": "Cross-checking holders and filings",
    "step.4": "Drafting the summary",
    "thinking.sub": "{s}s · cached data, no live market call",
    "api.title": "API Management",
    "api.sub":
      "Set your own Sectors and model credentials. Values are written to python/.env and .env.local on this machine only — nothing is sent anywhere else.",
    "api.sectors": "Sectors API keys",
    "api.model": "Model API keys",
    "api.stored": "{n} stored",
    "api.active": "active",
    "api.created": "created {date}",
    "api.reveal": "Reveal key",
    "api.hide": "Hide key",
    "api.edit": "Edit",
    "api.delete": "Delete",
    "api.save": "Save",
    "api.cancel": "Cancel",
    "api.test": "Test",
    "api.testAll": "Test",
    "api.fetchModels": "Fetch models",
    "api.loading": "Loading…",
    "api.addSectors": "+ Add Sectors key",
    "api.addModel": "+ Add model key",
    "api.label": "Label",
    "api.labelPlaceholder": "Label (e.g. Primary)",
    "api.keyPlaceholder": "Paste your API key",
    "api.basePlaceholder": "Base URL (https://api.example.com/v1)",
    "api.modelPlaceholder": "Model name (e.g. gpt-5.6)",
    "api.replaceKey": "Replace key (leave blank to keep)",
    "api.none": "not set",
    "api.empty": "No {kind} key yet. Add one to start.",
    "api.saved": "Saved to python/.env and .env.local",
    "api.couldNotList": "Could not list models — type the name manually.",
    "api.statusSectors": "Testing consumes 1 credit. Your key is sent only to this local server and never leaves your machine.",
    "api.activeModel": "Active model:",
    "api.activeModel.foot": "Testing sends one minimal request to validate the base URL and key together.",
    "err.snapshot": "Data not available yet.",
    "err.generic": "Something went wrong",
    "err.listKeys": "Could not read the key list",
    "lang.label": "Language",
  },
  id: {
    "nav.main": "Utama",
    "nav.activity": "Aktivitas",
    "nav.api": "API",
    "nav.home": "Beranda",
    "nav.clusters": "Cluster",
    "nav.sessions": "Sesi",
    "nav.cli": "Log CLI",
    "nav.keys": "Kunci API",
    "brand.tagline": "Insider IDX · cached data",
    "snapshot.label": "Data",
    "snapshot.updated": "Diperbarui",
    "snapshot.partial": "cakupan parsial",
    "snapshot.full": "cakupan lengkap",
    "age.fresh": "Umur data.",
    "age.stale": "Data basi.",
    "age.minutes": "{n} menit",
    "age.hours": "{n} jam",
    "age.days": "{n} hari",
    "api.enable": "Aktifkan",
    "api.disable": "Nonaktifkan",
    "age.body": "Data diambil {age} lalu. Data pasar hanya diperbarui saat ingestion dijalankan.",
    "age.partial": "Cakupan parsial: sebagian halaman filing belum diambil.",
    "disclaimer": "Hanya untuk riset dan edukasi. Bukan financial advice. Dashboard ini tidak pernah memanggil Sectors.",
    "disclaimer.long":
      "Hanya untuk riset dan edukasi. Bukan financial advice dan bukan rekomendasi beli/jual. Data historis dan parsial; klasifikasi bersifat heuristik.",
    "home.title": "Ringkasan hari ini",
    "home.sub": "Semua angka dihitung dari data tersimpan ({at}), bukan polling pasar. Dashboard ini tidak memanggil Sectors.",
    "kpi.lastPrice": "Harga terakhir",
    "kpi.growth": "Growth pendapatan / laba",
    "kpi.roe": "ROE / DER",
    "card.missing": "tidak tersedia",
    "card.caveat1": "Harga per {date}. Rasio tahunan, bukan otomatis TTM/MRQ; growth kuartalan YoY.",
    "card.caveat2": "ATH sesuai data penyedia; aksi korporasi dan penyesuaian historis perlu ditinjau.",
    "kpi.filings": "Filing lolos filter",
    "kpi.filings.hint": "dari {scanned} filing discan · {coverage}",
    "kpi.clusters": "Cluster",
    "kpi.clusters.hint": "{acc} akumulasi · {dist} distribusi",
    "kpi.value": "Nilai transaksi",
    "kpi.value.hint": "total seluruh cluster pada rentang ini",
    "kpi.parties": "Pihak unik",
    "kpi.parties.hint": "peringatan: jumlah pihak bukan return investasi",
    "kpi.largest": "Cluster terbesar",
    "kpi.largest.hint": "tidak ada data",
    "panel.clusterPos": "Cluster & posisi 52 minggu",
    "panel.byValue": "diurutkan per nilai transaksi",
    "th.ticker": "Ticker",
    "th.parties": "Pihak",
    "th.value": "Nilai",
    "th.pos52w": "Posisi 52m",
    "th.direction": "Arah",
    "th.window": "Rentang",
    "panel.clusterPos.foot":
      "Posisi 52 minggu = (harga terakhir − terendah) ÷ (tertinggi − terendah) dari data penyedia; hanya ticker dengan harga cached yang muncul.",
    "panel.sector": "Sebaran sektor",
    "panel.sector.foot": "Label sektor berasal dari company report cached; cluster tanpa laporan masuk “Tidak diketahui”.",
    "panel.activity": "Aktivitas terakhir",
    "panel.activity.from": "{n} dari CLI",
    "panel.activity.foot": "Dibaca dari data/chat_log.jsonl di proyek Python. Buka halaman Log CLI untuk riwayat penuh.",
    "panel.howto": "Cara membaca dashboard",
    "panel.howto.meta": "batas data",
    "howto.1": "<b>Data cache, bukan live.</b> Angka berasal dari ingestion manual terakhir; pasar baru muncul setelah operator menjalankan monitor.",
    "howto.2":
      "<b>Klasifikasi heuristik.</b> Tag <code>investment</code> dan perubahan kepemilikan tidak membuktikan pembelian tunai di pasar terbuka.",
    "howto.3":
      "<b>Tahun rasio berbeda.</b> PE/PB memakai tahun valuasi, ROE/DER tahun rasio tahunan — bukan TTM/MRQ. Growth kuartalan YoY.",
    "howto.4": "<b>ATH bisa terdistorsi.</b> Aksi korporasi dan penyesuaian historis menggeser puncak; drawdown perlu ditinjau.",
    "howto.5": "<b>Bukan rekomendasi.</b> Dashboard ini alat riset, bukan financial advice atau sinyal beli/jual.",
    "clusters.title": "Cluster insider",
    "clusters.sub": "{n} cluster dari data tersimpan · klik Filing untuk bukti sumber. Bukan data live.",
    "empty.clusters": "Tidak ada cluster yang memenuhi kriteria pada rentang ini.",
    "empty.clustersTable": "Belum ada cluster.",
    "empty.sectors": "Belum ada data sektor.",
    "empty.cliActivity": "Belum ada percakapan CLI.",
    "empty.cliLog": "Belum ada log CLI tersimpan.",
    "cli.title": "Log percakapan CLI",
    "cli.noTool": "tanpa tool",
    "cli.sub":
      "{n} pertanyaan terakhir dari <code>tracer.py</code>, dibaca dari data/chat_log.jsonl. Tidak memicu panggilan berbayar.",
    "chat.title": "Tanya Tracer",
    "chat.sub": "Tracer membaca data insider IDX tersimpan. Tidak ada permintaan live, dan tidak ada fallback saat gateway gagal.",
    "chat.new": "Sesi baru",
    "chat.history": "Riwayat sesi",
    "chat.empty": "Belum ada sesi. Mulai dari kotak tanya di kanan.",
    "chat.count": "{n}/30 sesi",
    "chat.deleteAll": "Hapus semua",
    "chat.clear": "Bersihkan",
    "chat.notStarted": "belum dimulai",
    "chat.reveal": "Tampilkan",
    "sug.cluster": "Cluster mana yang paling besar?",
    "sug.accumulation": "Rangkum akumulasi terbaru",
    "sug.sector": "Sektor apa yang paling ramai?",
    "sug.heal": "Detail HEAL beserta bukti filenya",
    "chat.suggestion": "Coba “Cluster mana yang paling besar?” — tiap sesi punya riwayat sendiri.",
    "chat.thinking": "Tracer menganalisis data…",
    "chat.placeholder": "Tanya soal cluster, insider, atau nilai transaksi…",
    "chat.question": "Pertanyaan",
    "chat.hint": "Enter kirim · Shift+Enter baris baru",
    "nav.filings": "Filing",
    "filings.title": "Umpan filing",
    "filings.sub": "{n} filing terambil · {buy} beli · {sell} jual. Sebagian besar tidak jadi cluster.",
    "filings.empty": "Belum ada filing. Jalankan /newdata di CLI.",
    "filings.date": "Tanggal",
    "filings.ticker": "Saham",
    "filings.holder": "Pemilik",
    "filings.side": "Aksi",
    "filings.value": "Nilai",
    "filings.after": "Saham setelah",
    "filings.evidence": "PDF",
    "filings.pager": "Filing pages",
    "filings.prev": "Previous page",
    "filings.next": "Next page",
    "cmd.list": "Perintah tersedia",
    "cmd.scan": "daftar cluster terbaru",
    "cmd.detail": "detail satu emiten dan filingnya",
    "cmd.newdata": "tarik data baru dari Sectors (1 kredit)",
    "cmd.history": "riwayat percakapan",
    "cmd.session": "buka pemilih sesi",
    "cmd.help": "bantuan ini",
    "cmd.quit": "keluar",
    "setup.b":
      "<b>Setup.</b> Isi kunci milikmu di <b>Kunci API</b>, atau salin <code>.env.local.example</code> ke <code>.env.local</code>. Lalu tarik data dari CLI: jalankan <code>tracer</code> dan ketik <code>/newdata</code>. Semua tersimpan di mesin ini saja.",
    "refresh.done": "Data baru ditarik: {rows} filing tersimpan. {credits} kredit terpakai.",
    "refresh.failed": "Gagal menarik data baru",
    "refresh.hint": "/newdata menarik data baru (memakai kredit)",
    "chat.send": "Kirim",
    "chat.messages": "{n} pesan",
    "chat.justNow": "baru saja",
    "chat.delete": "Hapus",
    "step.1": "Membaca data tersimpan",
    "step.2": "Memilih tool yang relevan",
    "step.3": "Mencocokkan pemegang dan filing",
    "step.4": "Menyusun ringkasan",
    "thinking.sub": "{s}s · data cache, tanpa panggilan pasar live",
    "api.title": "Manajemen API",
    "api.sub":
      "Set kredensial Sectors dan model milikmu. Nilai ditulis ke python/.env dan .env.local di mesin ini saja — tidak dikirim ke mana pun.",
    "api.sectors": "Kunci API Sectors",
    "api.model": "Kunci API model",
    "api.stored": "{n} tersimpan",
    "api.active": "aktif",
    "api.created": "dibuat {date}",
    "api.reveal": "Tampilkan kunci",
    "api.hide": "Sembunyikan kunci",
    "api.edit": "Ubah",
    "api.delete": "Hapus",
    "api.save": "Simpan",
    "api.cancel": "Batal",
    "api.test": "Uji",
    "api.testAll": "Uji",
    "api.fetchModels": "Ambil model",
    "api.loading": "Memuat…",
    "api.addSectors": "+ Tambah kunci Sectors",
    "api.addModel": "+ Tambah kunci model",
    "api.label": "Label",
    "api.labelPlaceholder": "Label (mis. Utama)",
    "api.keyPlaceholder": "Tempel API key kamu",
    "api.basePlaceholder": "Base URL (https://api.example.com/v1)",
    "api.modelPlaceholder": "Nama model (mis. gpt-5.6)",
    "api.replaceKey": "Ganti kunci (kosongkan untuk tetap)",
    "api.none": "belum diisi",
    "api.empty": "Belum ada kunci {kind}. Tambahkan satu untuk mulai.",
    "api.saved": "Tersimpan ke python/.env dan .env.local",
    "api.couldNotList": "Gagal mengambil daftar model — isi nama manual.",
    "api.statusSectors": "Uji memakai 1 kredit. Kunci hanya dikirim ke server lokal ini dan tidak keluar dari mesinmu.",
    "api.activeModel": "Model aktif:",
    "api.activeModel.foot": "Uji mengirim satu permintaan kecil untuk memvalidasi base URL dan kunci sekaligus.",
    "err.snapshot": "Data belum tersedia.",
    "err.generic": "Terjadi kesalahan",
    "err.listKeys": "Gagal membaca daftar kunci",
    "lang.label": "Bahasa",
  },
} as const;

type Key = keyof (typeof DICT)["en"];

const LangContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void; t: (key: Key, vars?: Record<string, string | number>) => string }>({
  lang: "en",
  setLang: () => {},
  t: (key) => DICT.en[key],
});

export const useT = () => useContext(LangContext);

const KEY = "insideriq.lang";

export function LangProvider({ children }: { children: ReactNode }) {
  // Default "en"; the stored value is applied after mount so server and client
  // render the same markup first (a mismatch here re-mounts the whole tree).
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (stored === "id" || stored === "en") setLangState(stored);
  }, []);

  function setLang(next: Lang) {
    setLangState(next);
    localStorage.setItem(KEY, next);
    document.documentElement.lang = next;
  }

  function t(key: Key, vars?: Record<string, string | number>) {
    let text: string = DICT[lang][key] ?? DICT.en[key];
    for (const [name, value] of Object.entries(vars ?? {})) text = text.replaceAll(`{${name}}`, String(value));
    return text;
  }

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function SetupNotice() {
  const { t } = useT();
  return (
    <p className="notice">
      <span dangerouslySetInnerHTML={{ __html: t("setup.b") }} />
    </p>
  );
}


export function LangSwitch() {
  const { lang, setLang, t } = useT();
  return (
    <div className="langSwitch" role="group" aria-label={t("lang.label")}>
      {(["en", "id"] as Lang[]).map((code) => (
        <button
          key={code}
          type="button"
          className={lang === code ? "on" : ""}
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
