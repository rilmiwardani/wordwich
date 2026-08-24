/**
 * clean_categories.js
 * Membersihkan categories.json dari entri yang tidak cocok untuk game tebak kata.
 * Jalankan: node scripts/clean_categories.js
 */

const fs = require("fs");
const path = require("path");

const catFilePath = path.join(__dirname, "..", "categories.json");
// Gunakan backup sebagai sumber (agar bisa dijalankan ulang)
const sourcePath = fs.existsSync(catFilePath.replace(".json", "_backup.json"))
  ? catFilePath.replace(".json", "_backup.json")
  : catFilePath;

const data = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

// ---------------------------------------------------------------
// ATURAN FILTER
// ---------------------------------------------------------------

// 1. Akhiran taksonomi latin
const TAXO_SUFFIXES = [
  "idae", "inae", "iformes", "oidea", "acea", "ales", "opsida",
  "phyta", "ozoa", "ida", "formes", "oidei", "inae", "oideae"
];

// 2. Awalan yang menandakan bukan nama benda/makhluk
const BAD_PREFIXES = [
  "anatomi ", "morfologi ", "fisiologi ", "reproduksi ", "taksonomi ",
  "sistematika ", "evolusi ", "adaptasi ", "konservasi ", "nutrisi ",
  "ekologi ", "zoologi ", "ornitologi ", "iktiologi ", "etologi ",
  "kecerdasan ", "perilaku ", "kesehatan ", "kesejahteraan ",
  "emosi pada", "nyeri pada", "tidur ", "pergerakan ",
  "infantisida", "plasentofagi", "trofalaksis", "penyapihan",
  "budi daya", "kaidah ", "memberi makan", "menjilat ",
  "kampanye ", "zona ", "jembatan ", "gempa bumi [a-z]",
  "pengguna ", "daftar ", "sejarah ", "biografi ",
  "migrasi hewan", "migrasi burung",
];

// 3. Kata-kata teknis/ilmiah yang bukan nama makhluk/benda umum
const TECHNICAL_WORDS = new Set([
  "fauna", "flora", "mamalia", "vertebrata", "invertebrata", "binatang",
  // Istilah anatomi/morfologi burung
  "alloparenting", "alula", "gelembung renang", "sirip ikan", "insang",
  "rentang sayap", "bulu terbang", "ciri burung", "kecerdasan burung",
  "gurat sisi", "pekten okuli", "sesilitas", "krenasi",
  // Istilah biologi umum
  "omnivor", "herbivor", "karnivor", "predator", "mangsa",
  "domestikasi", "seleksi alam", "rantai makanan",
  // Kata terlalu umum/abstrak
  "hewan", "binatang", "makhluk", "spesies", "ras", "ras campuran",
  "kawanan", "koloni", "ekologi", "habitat",
  "biota", "ordo", "genus", "famili", "kelas", "filum",
  "radiata", "spiralia", "theria", "zatheria", "yinotheria", "eumetazoa",
  "ecdysozoa", "lophotrochozoa", "cnidaria", "porifera", "platyhelminthes",
  "nematoda", "nemertea", "rotifera", "brakiopoda", "bryozoa", "entoprocta",
  "priapulida", "kinorhyncha", "tardigrada", "onychophora", "arthropoda",
  "crustacea", "moluska", "echinodermata", "hemichordata", "chordata",
  "sefalopoda", "gastrotricha", "sipuncula", "trichoplax", "trilobozoa",
  "monoblastozoa", "mesozoa", "orthonectida", "dicyemida", "symbion",
  "xenacoelomorpha", "filum", "filum hewan", "zooplankton", "mikrofauna",
  "ovipar", "ovovivipar", "vivipar", "poikiloterm", "euryhaline",
  "diurnalitas", "altrisial", "prekosial", "krepuskular",
  "digitigrad", "fotoperiodisme", "vinkensport",
  "migrasi", "adaptasi", "konservasi", "reproduksi",
  "paksiwisata", "antrozoologi",
]);

// 4. Deteksi nama ilmiah binomial latin (dua kata, huruf latin khas)
// Pola: dua kata dimana salah satu sangat asing dari bahasa Indonesia
const LATIN_WORD_PATTERN = /\b(agorius|acanthocephala|acridotheres|apistogramma|apteronotid|apteronotus|arapaima|astronotus|caluaktori|caronectris|carukiidae|carybdeida|casuariid|cathartiform|charadriid|chimaera|chirodropid|chlopsid|chlorocebus|chordata|chrysiptera|cicinnurus|coelacanth|corvidae|cyclarhis|cyclopterid|dissostichus|dorudon|ecdysozoa|eurypygiform|gadidae|gasteracantha|gastromyzon|gempylid|gnathonemus|gymnotid|gymnotus|hexanchiform|histiophryne|hucho|ipnopid|lactoria|linnaean|lophotrochozoa|loricifera|mastacembelus|miacoidea|monogenea|myliobatiform|notoliparis|notopterid|opisthocomiform|opistognathid|oryzias|paedocypris|paracheilinus|paradisaea|phalanger|pharomachrus|phascogale|photocorynus|polyplacophora|priapulida|procellariid|pseudobulweria|pseudoliparis|puffinus|rajiform|sciades|scomberomorus|suliform|synchiropus|teratornis|trichiurid|turbellaria|tytthostonyx|varanid|wallago|xenacoelomorpha|aframomum|alocasia|anoplopoma|dicentrarchus|gymnotus|tinca|hucho|stickleback)\b/;

// Kata-kata makanan/benda valid yang berulang (whitelist)
const REPETITIVE_WHITELIST = new Set([
  // Makanan — kata ulang valid bahasa Indonesia
  "agar agar", "onde onde", "arem arem", "gado gado", "lawar lawar",
  "otak otak", "cumi cumi", "tape tape", "mie mie", "cendol cendol",
  "klepon klepon", "martabak martabak", "ayam rica rica",
  // Hewan
  "kupu kupu", "ubur ubur", "kunang kunang", "kura kura", "laba laba",
  "capung capung", "kuda kuda", "ular ular",
  // Alat/benda
  "siku siku", "paru paru", "mata mata", "buah buahan",
  // Alam
  "lahar lahar",
]);


// 5. Pola kata yang repetitif/aneh (seperti "anjang anjang", "mie dog dog")
function hasRepetitivePattern(word) {
  if (REPETITIVE_WHITELIST.has(word)) return false;
  const parts = word.split(" ").filter(Boolean);
  // Hanya tolak jika kata PERTAMA dan KEDUA identik (bukan pasangan lain)
  // Misal: "anjang anjang" → tolak | "ayam rica rica" → boleh (pertama != kedua)
  if (parts.length >= 2 && parts[0] === parts[1] && parts[0].length > 2) return true;
  // Tolak juga triple murni: "dog dog dog"
  if (parts.length >= 3 && parts[0] === parts[1] && parts[1] === parts[2]) return true;
  return false;
}

// 6. Terlalu panjang, terlalu pendek, atau lebih dari 2 kata
function isTooLongOrShort(word) {
  if (word.length < 3) return true;
  if (word.length > 32) return true;
  const wordCount = word.split(" ").filter(Boolean).length;
  if (wordCount > 2) return true;
  return false;
}

// 7. Mengandung angka
function hasDigits(word) {
  return /\d/.test(word);
}

// ---------------------------------------------------------------
// FUNGSI UTAMA
// ---------------------------------------------------------------
function shouldKeep(word) {
  if (!word || word.trim() === "") return false;
  if (isTooLongOrShort(word)) return false;
  if (hasDigits(word)) return false;
  if (hasRepetitivePattern(word)) return false;
  if (TECHNICAL_WORDS.has(word)) return false;
  if (LATIN_WORD_PATTERN.test(word)) return false;

  // Cek akhiran taksonomi
  if (TAXO_SUFFIXES.some(s => word.endsWith(s))) return false;

  // Cek awalan buruk
  for (const prefix of BAD_PREFIXES) {
    const re = new RegExp("^" + prefix);
    if (re.test(word)) return false;
  }

  // Lebih agresif: kalau kata hanya ada di kamus latin (huruf vokal ganda khas latin)
  // Pola: mengandung 'ae', 'oe', 'ph', 'rh', 'th' pada kata TUNGGAL yang terasa latin
  const singleWord = !word.includes(" ");
  if (singleWord && /^[a-z]{8,}$/.test(word)) {
    // Kata panjang tanpa vokal ganda Indonesia — kemungkinan nama ilmiah
    const hasLatinVowels = /ae|oe|ph|rh|yx|yc|cy|xo|xa|xt|xu/.test(word);
    const hasNoIndonesianPattern = !/[aeiou]{2}|(ng|ny|sy|kh)/.test(word);
    if (hasLatinVowels && hasNoIndonesianPattern) return false;
  }

  return true;
}

// ---------------------------------------------------------------
// PROSES TIAP KATEGORI
// ---------------------------------------------------------------
let totalBefore = 0;
let totalAfter = 0;

const cleaned = {};
for (const [key, cat] of Object.entries(data)) {
  const before = cat.words.length;
  const filteredWords = cat.words.filter(shouldKeep);
  const after = filteredWords.length;
  totalBefore += before;
  totalAfter += after;

  const removed = cat.words.filter(w => !shouldKeep(w)).slice(0, 5);
  console.log(`${cat.emoji} ${cat.name}: ${before} → ${after} kata (-${before - after})`);
  if (removed.length > 0) console.log(`   Contoh dihapus: ${removed.join(", ")}`);

  cleaned[key] = {
    name: cat.name,
    emoji: cat.emoji,
    words: filteredWords
  };
}

console.log(`\nTotal: ${totalBefore} → ${totalAfter} kata (-${totalBefore - totalAfter})`);

// Tulis hasil bersih
fs.writeFileSync(catFilePath, JSON.stringify(cleaned, null, 2), "utf8");
console.log(`\n✅ categories.json telah dibersihkan!`);

// Tampilkan sampel per kategori
console.log("\n=== SAMPEL 10 FRASA PER KATEGORI ===");
for (const [key, cat] of Object.entries(cleaned)) {
  const multiWord = cat.words.filter(w => w.includes(" ")).slice(0, 5);
  const single = cat.words.filter(w => !w.includes(" ")).slice(0, 5);
  console.log(`\n${cat.emoji} ${cat.name}:`);
  console.log(`  Kata tunggal: ${single.join(", ")}`);
  console.log(`  Frasa: ${multiWord.join(", ")}`);
}
