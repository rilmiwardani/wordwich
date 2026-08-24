const fs = require("fs");
const path = require("path");

const catFilePath = path.join(__dirname, "..", "categories.json");
const data = JSON.parse(fs.readFileSync(catFilePath, "utf8"));

const kamusPath = path.join(__dirname, "..", "kamus.txt");
const kamus = new Set(fs.readFileSync(kamusPath, "utf8").split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(Boolean));

// -----------------------------------------------------------------------------
// 1. KULINER (Makanan & Minuman)
// -----------------------------------------------------------------------------
// Semua kata tunggal kuliner harus ada di KBBI atau dalam list serapan populer.
const POPULAR_KULINER_SINGLE = new Set([
  "almond", "bakcang", "brownies", "burjo", "cappuccino", "croissant", "cupcake",
  "dumpling", "fuyunghai", "hotdog", "nugget", "mochi", "milkshake", "marshmallow",
  "mayones", "pizza", "spageti", "wafel", "sandwich", "yogurt", "kebab", "burger",
  "lasagna"
]);

function cleanKuliner(word) {
  const parts = word.split(" ").filter(Boolean);
  
  // Jika kata tunggal
  if (parts.length === 1) {
    return kamus.has(word) || POPULAR_KULINER_SINGLE.has(word);
  }

  // Jika 2 kata
  if (parts.length === 2) {
    const [p1, p2] = parts;
    
    // Blokir kombinasi aneh atau terlalu spesifik
    if (word === "coki coki" || word === "mie dog dog" || word === "mie dogdog") return false;

    // Pastikan setidaknya kata pertama ada di KBBI atau kata serapan
    const isFirstWordOk = kamus.has(p1) || POPULAR_KULINER_SINGLE.has(p1) || p1 === "es" || p1 === "mie" || p1 === "teh" || p1 === "kopi";
    const isSecondWordOk = kamus.has(p2) || POPULAR_KULINER_SINGLE.has(p2) || ["manis", "asin", "pedas", "hangat", "dingin", "taliwang", "kalasan", "jogja", "padang", "medan", "makassar", "cirebon", "sunda", "toba", "bandung", "krawu", "megono", "bogana", "espresso", "latte", "matcha", "boba", "cream", "schotel", "fries", "goang", "lindri", "montong", "petruk", "bawor", "pletok", "pandan", "cumi", "sapi", "ayam", "kambing", "telur", "manis", "bakar", "goreng", "rebus", "kuah", "kering", "basah"].includes(p2);
    
    return isFirstWordOk && isSecondWordOk;
  }

  return false;
}

// -----------------------------------------------------------------------------
// 2. BENDA (Benda & Rumah)
// -----------------------------------------------------------------------------
// Whitelist kata serapan modern
const POPULAR_BENDA_SINGLE = new Set([
  "charger", "cctv", "dslr", "led", "matic", "hp", "tv", "pc", "bmx", "game",
  "earphone", "headphone", "smartphone", "keyboard", "mouse", "laptop", "notebook",
  "flashdisk", "flasdisk", "webcam", "stopwatch", "speaker", "bluetooth", "pashmina"
]);

function cleanBenda(word) {
  // Koreksi ejaan
  if (word === "flasdisk") word = "flashdisk";
  if (word === "krukut") return false; // krukut bukan benda umum/salah ketik

  const parts = word.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return kamus.has(word) || POPULAR_BENDA_SINGLE.has(word);
  }

  if (parts.length === 2) {
    const [p1, p2] = parts;
    const isFirstWordOk = kamus.has(p1) || POPULAR_BENDA_SINGLE.has(p1) || ["kamera", "kabel", "mouse", "keyboard", "remote", "rice", "roller", "sepatu", "sepeda", "sofa", "speaker", "sprei", "topi", "toren", "velg", "video", "walkie", "water", "waterpass", "pelindung", "sandal"].includes(p1);
    const isSecondWordOk = kamus.has(p2) || POPULAR_BENDA_SINGLE.has(p2) || ["tv", "hp", "led", "cctv", "dslr", "komputer", "laptop", "matic", "travel", "charger", "cooker", "coaster", "heels", "sneakers", "bmx", "bed", "bluetooth", "kasur", "baseball", "air", "mobil", "game", "talkie", "heater", "slop", "boots", "pentul"].includes(p2);
    return isFirstWordOk && isSecondWordOk;
  }

  return false;
}

// -----------------------------------------------------------------------------
// 3. PROFESI (Profesi & Pekerjaan)
// -----------------------------------------------------------------------------
const POPULAR_PROFESI_SINGLE = new Set([
  "blogger", "bodyguard", "cameraman", "ceo", "chef", "copywriter", "counsellor",
  "dancer", "drummer", "dubber", "gamer", "influencer", "lawyer", "magician", "host",
  "animator", "desainer", "programmer", "developer", "fotografer", "videografer",
  "arsitek", "akuntan", "sutradara", "editor", "model", "makelar", "astronot"
]);

const POPULAR_PROFESI_PHRASES = new Set([
  "akuntan publik", "analis data", "anggota dpr", "anggota dprd", "anggota mpr",
  "data analyst", "content creator", "copywriter", "customer service", "disk jockey",
  "driver online", "fashion designer", "fisioterapis", "florist", "gamer profesional",
  "guru bk", "guru honorer", "dokter gigi", "dokter kandungan", "dokter hewan",
  "dokter anak", "dokter bedah", "dokter umum", "polisi pamong", "jaksa agung",
  "hakim agung", "wakil presiden", "perdana menteri", "menteri keuangan", "duta besar",
  "juru bicara", "juru mudi", "juru parkir", "juru masak", "juru ketik", "juru sita",
  "juru las", "juru kamera", "sopir angkot", "sopir bus", "sopir taksi", "sopir truk",
  "masinis kereta", "pilot pesawat", "nakhoda kapal", "nahkoda kapal", "pramugari pesawat",
  "pramugara pesawat", "pemadam kebakaran", "pemain bola", "pemain basket", "pemain musik",
  "pemain bass", "pemain gitar", "pemain drum", "penyanyi solo", "penyanyi rock",
  "penyanyi jazz", "penyanyi dangdut", "penyanyi pop", "seniman lukis", "guru sekolah",
  "dosen kuliah", "koki pastry", "motovlogger", "perancang busana", "perancang game",
  "penulis novel", "penulis skenario", "penjaga gawang", "penjaga sekolah", "penjaga malam",
  "it support", "web developer", "graphic designer", "software engineer"
]);

function cleanProfesi(word) {
  if (word === "cs" || word === "dj" || word === "pengrusak" || word === "nelayan cumi" || word === "nuklir scientist" || word === "babi hutan hunter") {
    return false;
  }

  if (POPULAR_PROFESI_PHRASES.has(word)) return true;

  const parts = word.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return kamus.has(word) || POPULAR_PROFESI_SINGLE.has(word);
  }

  if (parts.length === 2) {
    const [p1, p2] = parts;
    // Pastikan kata utama profesi ada di KBBI atau whitelist
    const isFirstOk = kamus.has(p1) || POPULAR_PROFESI_SINGLE.has(p1);
    const isSecondOk = kamus.has(p2) || ["gawang", "toko", "kantor", "sekolah", "kebun", "hutan", "tambang", "bangunan", "ikan", "ternak", "tani", "sawah", "pantai", "laut", "pesawat", "kapal", "bus", "truk", "kereta", "wisata", "tari", "nyanyi", "musik", "lukis", "pahat", "patung", "tulis", "baca", "rias", "busana", "rias", "masak", "kamera", "parkir", "bicara", "mudi"].includes(p2);
    return isFirstOk && isSecondOk;
  }

  return false;
}

// -----------------------------------------------------------------------------
// 4. ALAM (Alam & Geografi)
// -----------------------------------------------------------------------------
const POPULAR_ALAM_PHRASES = new Set([
  "air mancur", "air payau", "air terjun", "alam semesta", "aliran sungai",
  "angin mamiri", "aurora australis", "aurora borealis", "black hole", "blizzard",
  "curug luhur", "curug citambur", "danau batur", "danau bedugul", "danau kelimutu",
  "danau matano", "danau singkarak", "danau toba", "el nino", "la nina", "gempa bumi",
  "gempa tektonik", "gempa vulkanik", "gunung berapi", "gunung bromo", "gunung galunggung",
  "gunung ijen", "gunung krakatau", "gunung lawu", "gunung merapi", "gunung merbabu",
  "gunung papandayan", "gunung rakata", "gunung raung", "gunung rinjani", "gunung salak",
  "gunung semeru", "gunung tambora", "hujan asam", "hujan deras", "hujan buatan",
  "hujan es", "hutan lindung", "hutan rimba", "iklim tropis", "iklim subtropis",
  "kawah belerang", "kawah ijen", "kawah sikidang", "kemarau panjang", "kepulauan seribu",
  "khatulistiwa", "komet halley", "laut arafura", "laut jawa", "laut banda",
  "matahari terbit", "matahari terbenam", "ombak besar", "padang pasir", "padang rumput",
  "pantai kuta", "pelangi indah", "selat bali", "selat bangka", "selat sunda",
  "selat lombok", "selat madura", "selat makassar", "sungai musi", "sungai kapuas",
  "sungai mahakam", "tanah longsor", "tebing curam", "taman nasional"
]);

function cleanAlam(word) {
  // Blokir istilah terlalu teknis/akademis/militer
  if (["isoterma", "isthmus", "kepulauan kalukalukuang", "hailstorm", "liukan ombak", "jembatan selat sunda", "kampanye selat sunda", "zona subduksi selat sunda"].includes(word)) {
    return false;
  }
  if (word.startsWith("awan ") || word.startsWith("hutan conifer")) return false;

  if (POPULAR_ALAM_PHRASES.has(word)) return true;

  const parts = word.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return kamus.has(word) && !["geografi", "meteorologi", "vulkanisme"].includes(word);
  }

  if (parts.length === 2) {
    const [p1, p2] = parts;
    const isFirstOk = kamus.has(p1) && ["air", "angin", "awan", "danau", "gunung", "hujan", "hutan", "laut", "ombak", "pantai", "pulau", "selat", "sungai", "tebing", "kawah", "batu", "gempa"].includes(p1);
    const isSecondOk = kamus.has(p2) || ["terjun", "mamiri", "australis", "borealis", "batur", "toba", "singkarak", "bromo", "semeru", "merapi", "rinjani", "salak", "lawu", "ijen", "krakatau", "rakata", "papandayan", "galunggung", "tambora", "raung", "merbabu", "deras", "buatan", "lindung", "tropis", "subtropis", "belerang", "halley", "arafura", "bali", "sunda", "lombok", "madura", "makassar", "musi", "kapuas", "mahakam", "longsor", "curam"].includes(p2);
    return isFirstOk && isSecondOk;
  }

  return false;
}

// -----------------------------------------------------------------------------
// 5. BUAH & SAYUR (Buah & Sayuran)
// -----------------------------------------------------------------------------
// Hilangkan total nama ilmiah latin, tumbuhan/kayu non-makanan, resin, diet, dll.
const BLACKLIST_BUAH_SAYUR = new Set([
  "abiu", "acaca", "adobo", "albasia", "anjili", "arbenan", "asam kalimbawan",
  "baduyut", "balsam peru", "belimbing darah", "benda", "berenuk", "beri arar",
  "bidara cina", "biriba", "bisbul", "buah hitam", "buah kering", "buah super",
  "buah renda", "calamus rotang", "camphora officinarum", "canar", "cengkih afo",
  "ceremai belanda", "cichorium intybus", "culiket", "cupua u", "dalea lasiathera",
  "damar", "daun perengat", "durian cumasi", "engkalak", "feijoa", "fragaria",
  "fruitarianisme", "galbanum", "garcinia madruno", "geluga", "gencor", "getah inggu",
  "ginalun", "gitaan", "gondorukem", "guarana", "honje hutan", "jalur perdagangan",
  "jambu tangkalak", "jeruk jepara", "jeruk koji", "jus tomat", "kalalayu",
  "kalayar", "kalette", "kapulaga seberang", "kapur barus", "karitu", "kaskas",
  "kateku", "kelabat biru", "kembang sore", "kemenyan", "kemenyan arab",
  "kemenyan sumatra", "kerantungan", "keranuman", "kerisik", "kerukup",
  "kesusur hitam", "ketumbar bolivia", "kiwano", "kokam", "konnyaku", "kopal",
  "kulit buah", "kwinsi", "lahung", "lembutung", "lungsir", "maharawin", "mahoni",
  "makambo", "mamey sapote", "maritam", "marula", "mawar", "mentawa", "mentigi biru",
  "motikaya", "mudan", "mulwa", "mundu", "mur", "namnam", "nasi gonjleng", "nilam",
  "omija", "pala banda", "pala papua", "pedalai", "pembumbuan", "pemeraman",
  "pengolahan buah", "perdagangan rempah", "pining bawang", "piper borbonense",
  "piper guineense", "piperaceae", "pitaya bowl", "pohon buah", "pomologi",
  "prunus armeniaca", "pulosari", "radish", "rambusa", "rendang nangka",
  "ribes nigrum", "rubus crataegifolius", "rubus deliciosus", "rubus ellipticus",
  "rukam", "sahang", "salam koja", "sari", "sayuran krusifera", "secang", "sesawi",
  "sesawi hitam", "sesawi putih", "si jentik", "sianci", "simpur", "sirsak gundul",
  "sumak", "synsepalum dulcificum", "tajam molek", "tampui", "tepurang",
  "tepus bener", "terap", "tomat landak", "tomat buah", "worcester pearmain", "wresah",
  "glycyrrhiza", "kuma kuma"
]);

const POPULAR_BUAH_SAYUR_SINGLE = new Set([
  "adas", "akar wangi", "alpukat", "andaliman", "anggur", "apel", "aprikot", "asparagus",
  "bacang", "badam", "bawang", "bayam", "belimbing", "bengkuang", "binjai", "bit", "blewah",
  "brokoli", "brotowali", "buncis", "cabe", "cabai", "caisim", "cempedak", "cengkih", "cermai",
  "ceri", "damar", "delima", "duku", "durian", "erbis", "frambos", "gambas", "gandaria",
  "ganyong", "genjer", "gowok", "habanero", "habbatussauda", "jagung", "jahe", "jambu",
  "jamur", "jengkol", "jeruk", "jintan", "kakao", "kawista", "kecapi", "kecombrang",
  "kedondong", "kelapa", "keledang", "kelengkeng", "kelor", "kemang", "kemangi", "kemiri",
  "kemukus", "kenanga", "kencur", "kenikir", "kentang", "kepel", "kersen", "kesemek",
  "ketela", "ketimun", "ketumbar", "kingkit", "kismis", "kiwi", "kluwih", "kol",
  "kolang kaling", "krokot", "kubis", "kucai", "kumkuat", "kundur", "kunyit", "kuweni",
  "labu", "lada", "lai", "langsat", "leci", "lempuyang", "lengkeng", "lengkuas",
  "lentil", "lobak", "lokio", "lontar", "maja", "malaka", "mangga", "manggis", "markisa",
  "matoa", "melon", "mengkudu", "menteng", "mentimun", "merica", "moster", "mulberry",
  "murbei", "naga", "nanas", "nangka", "nilam", "oregano", "oyong", "pakcoy", "pala",
  "paprika", "pare", "pegagan", "pepaya", "pepino", "peria", "persik", "petai", "pete",
  "pinang", "pir", "pisang", "plum", "prem", "radish", "rambai", "rambutan", "rebung",
  "rempah", "rosemari", "rosemary", "rumput laut", "salad", "salada", "salak", "salam",
  "sawi", "sawo", "selasih", "seledri", "semangka", "serai", "sereh", "singkong",
  "sirsak", "srikaya", "stroberi", "sukun", "talas", "tamarillo", "taragon", "temulawak",
  "terong", "timun", "tin", "tomat", "ubi", "vanila", "waluh", "wasabi", "wijen",
  "wortel", "zaitun", "zucchini"
]);

function cleanBuahSayur(word) {
  if (BLACKLIST_BUAH_SAYUR.has(word)) return false;

  const parts = word.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return POPULAR_BUAH_SAYUR_SINGLE.has(word) || (kamus.has(word) && !["dupa", "damar", "kopal", "kemenyan"].includes(word));
  }

  if (parts.length === 2) {
    const [p1, p2] = parts;
    const isFirstOk = ["adas", "akar", "alpukat", "anggur", "apel", "asam", "badam", "bawang", "bayam", "belimbing", "biji", "bit", "buah", "cabai", "cabe", "ceri", "daun", "delima", "duku", "durian", "garam", "honje", "jagung", "jahe", "jambu", "jamur", "jeruk", "jintan", "kacang", "kapulaga", "kayu", "kedondong", "kelapa", "kemenyan", "kentang", "ketela", "kiwi", "kol", "kunyit", "labu", "lengkuas", "mangga", "melon", "mentimun", "merica", "nanas", "nangka", "pala", "pandan", "paprika", "pare", "pepaya", "pisang", "pucuk", "rambutan", "salam", "sawi", "sawo", "semangka", "serai", "singkong", "sirsak", "srikaya", "temu", "terong", "terung", "timun", "tomat", "ubi", "wortel"].includes(p1);
    const isSecondOk = ["manis", "sowa", "wangi", "mentega", "hijau", "hitam", "merah", "fuji", "malang", "manalagi", "gelugur", "jawa", "kandis", "bombay", "daun", "putih", "duri", "sayur", "wuluh", "ketumbar", "ara", "bit", "buni", "delima", "duku", "durian", "kiwi", "kundur", "lici", "lontar", "maja", "mangga", "manggis", "markisa", "matoa", "melon", "murbei", "naga", "nanas", "nangka", "pala", "papaya", "pear", "persik", "pisang", "plum", "rambutan", "salak", "sawo", "semangka", "sirsak", "stroberi", "sukun", "zaitun", "bubuk", "jawa", "giling", "keriting", "rawit", "jalapeno", "manis", "bawang", "jeruk", "kari", "katuk", "kemangi", "kunyit", "melinjo", "mengkudu", "pandan", "parsley", "pepaya", "pisang", "rosemary", "salam", "seledri", "singkong", "suji", "palembang", "bawor", "merah", "montong", "petruk", "masala", "bakar", "pipil", "gajah", "air", "biji", "bol", "jamaika", "mede", "mete", "monyet", "semarang", "champignon", "enoki", "kancing", "kuping", "merang", "shiitake", "shimeji", "tiram", "bali", "keprok", "lemon", "limau", "mandarin", "medan", "nipis", "pamelo", "peras", "pontianak", "purut", "santang", "sunkist", "hitam", "putih", "hijau", "kedelai", "panjang", "tanah", "jawa", "manis", "putih", "hutan", "kopyor", "tua", "rendang", "pohon", "emas", "hijau", "merah", "putih", "kuning", "madu", "parang", "siam", "kecil", "alpukat", "arumanis", "gadung", "gedong", "golek", "kweni", "lalajiwo", "manalagi", "muda", "cantaloupe", "kotak", "jepang", "suri", "jamaika", "banda", "papua", "wangi", "belut", "bangkok", "california", "calina", "gantung", "gunung", "cina", "ambon", "barangan", "barlin", "cavendish", "emas", "kepok", "nangka", "raja", "tanduk", "uli", "kurma", "armeniaca", "labu", "ubi", "binjai", "rapiah", "caisim", "duren", "kecik", "manila", "mentega", "dapur", "keju", "racun", "ratu", "jumbo", "hitam", "kunci", "lawak", "putih", "rapet", "belanda", "bulat", "pipit", "telunjuk", "ungu", "mas", "ceri", "cilembu", "jalar", "kayu", "brastagi", "lokal"].includes(p2);
    return isFirstOk && isSecondOk;
  }

  return false;
}

// -----------------------------------------------------------------------------
// RUN CLEANER
// -----------------------------------------------------------------------------
console.log("🧼 Memulai pembersihan kategori kuliner, benda, profesi, alam, dan buah_sayur...");

// Proses tiap kategori
let totalBefore = 0;
let totalAfter = 0;

for (const [key, cat] of Object.entries(data)) {
  if (key === "hewan") {
    totalBefore += cat.words.length;
    totalAfter += cat.words.length;
    continue; // Hewan sudah dibersihkan
  }

  const before = cat.words.length;
  let filtered = [];

  if (key === "kuliner") filtered = cat.words.filter(cleanKuliner);
  else if (key === "benda") filtered = cat.words.filter(cleanBenda);
  else if (key === "profesi") filtered = cat.words.filter(cleanProfesi);
  else if (key === "alam") filtered = cat.words.filter(cleanAlam);
  else if (key === "buah_sayur") filtered = cat.words.filter(cleanBuahSayur);

  // Perbaiki ejaan tertentu dalam array
  filtered = filtered.map(w => {
    if (w === "flasdisk") return "flashdisk";
    if (w === "longtong balap") return "lontong balap";
    return w;
  });

  // Sortir
  filtered.sort();

  const after = filtered.length;
  totalBefore += before;
  totalAfter += after;

  const removed = cat.words.filter(w => {
    if (key === "kuliner") return !cleanKuliner(w);
    if (key === "benda") return !cleanBenda(w);
    if (key === "profesi") return !cleanProfesi(w);
    if (key === "alam") return !cleanAlam(w);
    if (key === "buah_sayur") return !cleanBuahSayur(w);
    return false;
  });

  console.log(`\n${cat.emoji} ${cat.name}: ${before} → ${after} kata (-${before - after})`);
  if (removed.length > 0) console.log(`   Dihapus: ${removed.slice(0, 10).join(", ")} ...`);

  data[key].words = filtered;
}

console.log(`\nTotal Akhir Seluruh Kategori: ${totalBefore} → ${totalAfter} kata (-${totalBefore - totalAfter})`);

// Tulis categories.json
fs.writeFileSync(catFilePath, JSON.stringify(data, null, 2), "utf8");
console.log("✅ categories.json berhasil dibersihkan sepenuhnya!");
