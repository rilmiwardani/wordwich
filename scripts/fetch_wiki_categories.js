/**
 * fetch_wiki_categories.js
 * Mengambil data kata dari Wikipedia Bahasa Indonesia via MediaWiki API
 * menggunakan BFS subcategory traversal.
 * 
 * Jalankan: node scripts/fetch_wiki_categories.js
 */

const fs = require("fs");
const path = require("path");

const WIKI_API = "https://id.wikipedia.org/w/api.php";
const DELAY_MS = 200; // jeda antar request agar tidak kena rate-limit

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------
// Konfigurasi kategori: setiap kategori root + max kedalaman BFS
// ---------------------------------------------------------------
const CATEGORY_MAP = {
  hewan: {
    name: "Hewan & Binatang",
    emoji: "🐾",
    roots: ["Kategori:Hewan", "Kategori:Fauna Indonesia", "Kategori:Mamalia", "Kategori:Burung", "Kategori:Ikan", "Kategori:Reptil", "Kategori:Serangga", "Kategori:Hewan peliharaan"],
    maxDepth: 2
  },
  kuliner: {
    name: "Makanan & Minuman",
    emoji: "🍔",
    roots: ["Kategori:Masakan Indonesia", "Kategori:Makanan ringan Indonesia", "Kategori:Kue Indonesia", "Kategori:Minuman Indonesia", "Kategori:Sup dan soto Indonesia"],
    maxDepth: 3
  },
  benda: {
    name: "Benda & Rumah",
    emoji: "🏠",
    roots: ["Kategori:Peralatan rumah tangga", "Kategori:Pakaian", "Kategori:Furnitur", "Kategori:Alat musik tradisional Indonesia", "Kategori:Kendaraan"],
    maxDepth: 2
  },
  profesi: {
    name: "Profesi & Pekerjaan",
    emoji: "👨‍🍳",
    roots: ["Kategori:Profesi", "Kategori:Pekerjaan"],
    maxDepth: 2
  },
  alam: {
    name: "Alam & Geografi",
    emoji: "🌋",
    roots: ["Kategori:Gunung di Indonesia", "Kategori:Danau di Indonesia", "Kategori:Sungai di Indonesia", "Kategori:Pantai di Indonesia", "Kategori:Taman nasional di Indonesia", "Kategori:Selat di Indonesia", "Kategori:Air terjun di Indonesia"],
    maxDepth: 2
  },
  buah_sayur: {
    name: "Buah & Sayuran",
    emoji: "🍎",
    roots: ["Kategori:Buah-buahan", "Kategori:Sayuran", "Kategori:Rempah-rempah", "Kategori:Tumbuhan pangan"],
    maxDepth: 2
  }
};

// ---------------------------------------------------------------
// API Calls
// ---------------------------------------------------------------
async function apiGet(params) {
  const url = new URL(WIKI_API);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "KajepitBot/1.0 (WordWich game; educational)" }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// Ambil semua ARTIKEL (bukan subkategori) dari satu kategori, hingga 500
async function getCategoryPages(catTitle) {
  const pages = [];
  let cmcontinue = null;

  do {
    const params = {
      action: "query",
      list: "categorymembers",
      cmtitle: catTitle,
      cmtype: "page",
      cmlimit: 500,
      cmprop: "title"
    };
    if (cmcontinue) params.cmcontinue = cmcontinue;

    await sleep(DELAY_MS);
    const data = await apiGet(params);
    if (!data) break;

    const members = data.query?.categorymembers || [];
    pages.push(...members.map(m => m.title));
    cmcontinue = data.continue?.cmcontinue || null;
  } while (cmcontinue);

  return pages;
}

// Ambil subkategori dari satu kategori
async function getSubcategories(catTitle) {
  const params = {
    action: "query",
    list: "categorymembers",
    cmtitle: catTitle,
    cmtype: "subcat",
    cmlimit: 100
  };

  await sleep(DELAY_MS);
  const data = await apiGet(params);
  if (!data) return [];
  return (data.query?.categorymembers || []).map(m => m.title);
}

// BFS traversal: mulai dari root categories, gali subkategori hingga maxDepth
async function crawlCategory(roots, maxDepth) {
  const allPages = new Set();
  const visitedCats = new Set();
  const queue = roots.map(r => ({ title: r, depth: 0 }));

  while (queue.length > 0) {
    const { title, depth } = queue.shift();
    if (visitedCats.has(title)) continue;
    visitedCats.add(title);

    process.stdout.write(`      ↳ ${title} (depth ${depth})... `);

    // Ambil halaman artikel
    const pages = await getCategoryPages(title);
    pages.forEach(p => allPages.add(p));
    process.stdout.write(`${pages.length} artikel\n`);

    // Jika belum max depth, tambahkan subkategori ke antrian
    if (depth < maxDepth) {
      const subs = await getSubcategories(title);
      subs.forEach(sub => {
        if (!visitedCats.has(sub)) queue.push({ title: sub, depth: depth + 1 });
      });
    }
  }

  return Array.from(allPages);
}

// ---------------------------------------------------------------
// Cleaning & Filtering
// ---------------------------------------------------------------
function cleanTitle(title) {
  if (!title) return null;

  const lower = title.toLowerCase();

  // Abaikan halaman sistem, daftar panjang, dll.
  const SKIP_PREFIXES = ["daftar", "kategori:", "templat:", "berkas:", "bantuan:", "portal:", "wikipedia:", "pembicaraan:"];
  if (SKIP_PREFIXES.some(p => lower.startsWith(p))) return null;

  // Hapus penjelasan dalam tanda kurung: "Soto (masakan)" -> "soto"
  let clean = title.replace(/\s*\([^)]*\)/g, "");

  // Ubah ke lowercase, hapus karakter non-latin (termasuk huruf arab, aksara lain)
  clean = clean.toLowerCase().replace(/[^a-z\s]/g, " ");

  // Normalisasi spasi
  clean = clean.replace(/\s+/g, " ").trim();

  // Filter: minimal 2 karakter, maksimal 35 karakter, maksimal 5 kata
  if (!clean || clean.length < 2 || clean.length > 35) return null;
  const words = clean.split(" ").filter(Boolean);
  if (words.length > 5) return null;

  // Filter kata yang terlalu pendek (kemungkinan singkatan noise)
  if (words.every(w => w.length <= 1)) return null;

  return clean;
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------
async function run() {
  console.log("🚀 Memulai ekstraksi data dari Wikipedia Bahasa Indonesia API...\n");
  console.log("   (Proses ini membutuhkan beberapa menit untuk crawl ratusan kategori)\n");

  // Muat data existing sebagai seed dasar
  let existingData = {};
  const catFilePath = path.join(__dirname, "..", "categories.json");
  if (fs.existsSync(catFilePath)) {
    try {
      existingData = JSON.parse(fs.readFileSync(catFilePath, "utf8"));
      console.log(`   📂 Memuat ${catFilePath} sebagai seed awal...\n`);
    } catch (e) {}
  }

  const results = {};

  for (const [catKey, catInfo] of Object.entries(CATEGORY_MAP)) {
    console.log(`\n📡 [${catInfo.emoji} ${catInfo.name}]`);
    console.log(`   Root kategori: ${catInfo.roots.join(", ")}`);

    // Mulai dari seed existing
    const wordSet = new Set(existingData[catKey]?.words || []);
    const initialCount = wordSet.size;
    console.log(`   Seed awal: ${initialCount} kata`);

    // Crawl Wikipedia
    const rawPages = await crawlCategory(catInfo.roots, catInfo.maxDepth);

    // Bersihkan dan tambahkan ke set
    let addedCount = 0;
    for (const page of rawPages) {
      const cleaned = cleanTitle(page);
      if (cleaned && !wordSet.has(cleaned)) {
        wordSet.add(cleaned);
        addedCount++;
      }
    }

    const sortedWords = Array.from(wordSet).sort();
    results[catKey] = {
      name: catInfo.name,
      emoji: catInfo.emoji,
      words: sortedWords
    };

    console.log(`   ✅ Selesai: ${initialCount} seed + ${addedCount} dari Wikipedia = ${sortedWords.length} total`);

    // Simpan progres setelah tiap kategori (aman jika interrupt)
    fs.writeFileSync(catFilePath, JSON.stringify(results, null, 2), "utf8");
  }

  console.log(`\n🎉 Berhasil memperbarui ${catFilePath}!`);
  console.log("   Jalankan game untuk melihat database baru.\n");
}

run().catch(console.error);
