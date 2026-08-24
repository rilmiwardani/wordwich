const fs = require("fs");
const path = require("path");

const kamusPath = path.join(__dirname, "..", "kamus.txt");
const kamus = new Set(fs.readFileSync(kamusPath, "utf8").split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(Boolean));

const catFilePath = path.join(__dirname, "..", "categories.json");
const data = JSON.parse(fs.readFileSync(catFilePath, "utf8"));

// Daftar hewan dasar yang umum dikenal
const POPULAR_SINGLE_ANIMALS = new Set([
  "angsa", "anjing", "anoa", "ayam", "babi", "badak", "bajing", "bandeng", "banteng",
  "bebek", "bekantan", "belalang", "belut", "beruang", "beruk", "biawak", "bison",
  "blekok", "buaya", "bunglon", "burung", "cacing", "cakalang", "camar", "capung",
  "cecak", "cendrawasih", "cerpelai", "cheetah", "cicak", "codot", "domba", "dugong",
  "duyung", "elang", "entog", "flamingo", "gajah", "gecko", "gibon", "gorila",
  "gurita", "hamster", "harimau", "hiu", "hyena", "iguana", "ikan", "itik", "jaguar",
  "jangkrik", "jerapah", "kadal", "kakaktua", "kalajengking", "kalkun", "kalong",
  "kambing", "kampret", "kancil", "kapibara", "karibu", "kasuari", "katak", "kecebong",
  "kecoak", "kelabang", "keledai", "kelelawar", "kelinci", "kelomang", "kepiting",
  "kera", "kerang", "kerbau", "kijang", "koala", "kobra", "komodo", "kucing", "kukang",
  "kumbang", "kuskus", "kutu", "lalat", "lamantin", "landak", "larva", "lebah", "lele",
  "lemur", "leopard", "lintah", "lipan", "lobster", "lutung", "luwak", "macan",
  "mambruk", "mamut", "mandril", "marmut", "meerkat", "merak", "merpati", "monyet",
  "mujaer", "musang", "naga", "ngengat", "nyamuk", "orangutan", "orca", "orong orong",
  "otter", "panda", "panter", "paus", "pelikan", "penyu", "pesut", "pinguin", "platipus",
  "puma", "puyuh", "rajawali", "rakun", "rusa", "salmon", "sapi", "semut", "serigala",
  "siamang", "sidat", "simpanse", "singa", "sigung", "siput", "sotong", "surili",
  "tapir", "tarantula", "tarsius", "tawon", "tenggiri", "teri", "tikus", "tiram",
  "trenggiling", "tukan", "tuna", "tupai", "ulat", "unta", "walrus", "waran", "wombat",
  "yuyu", "zebra"
]);

// Prefix hewan dasar untuk frasa 2 kata
const ALLOWED_PREFIXES = [
  "anjing", "kucing", "burung", "ikan", "hiu", "belut", "beruang", "babi", "badak",
  "gajah", "buaya", "ayam", "bebek", "kambing", "kanguru", "kangguru", "macan",
  "harimau", "semut", "pari", "cacing", "laba laba", "bintang", "kumbang", "tupai",
  "udang", "ular", "paus", "penyu", "tikus", "monyet", "elang", "camar", "capung",
  "cicak", "cecak", "cupang", "domba", "sapi", "lumba lumba", "penguin", "pinguin",
  "lebah", "tawon", "kura kura", "katak", "kodok", "belalang", "cumi cumi", "ubur ubur",
  "kunang kunang", "singa", "dara", "jalak", "kenari", "kakaktua", "merpati",
  "ulat", "bekantan", "gurita"
];

// Kata kedua yang diperbolehkan untuk membentuk frasa hewan yang valid
const ALLOWED_MODIFIERS = new Set([
  // Warna
  "putih", "hitam", "merah", "kuning", "hijau", "biru", "cokelat", "abu abu", "emas", "perak",
  // Geografi/Habitat
  "jawa", "sumatera", "borneo", "kalimantan", "bali", "papua", "hutan", "laut", "sungai",
  "darat", "air", "rawa", "kutub", "pasir", "sawah", "gunung", "kebun", "taman", "rumput",
  // Sifat/Fisik
  "raksasa", "kecil", "besar", "biasa", "liar", "hantu", "unta", "gereja", "pipit",
  "kacer", "kutilang", "dara", "kakaktua", "kenari", "jalak", "lovebird", "macaw",
  "toucan", "walet", "pelatuk", "pelikan", "flamingo", "puyuh", "elang", "bangau",
  "bakar", "bangkok", "cemani", "jago", "kalkun", "kate", "petelur", "peking",
  "manila", "sembah", "listrik", "beludru", "pita", "tanah", "kaspia", "tertawa",
  "kayu", "melayu", "madu", "angora", "anggora", "persia", "siam", "garut",
  "bondol", "afrika", "benggala", "gergaji", "martil", "paus", "arwana", "badut",
  "bandeng", "bawal", "cupang", "dori", "gabus", "gurame", "kakap", "kerapu",
  "koi", "komet", "lele", "mas", "molly", "mujair", "nila", "pari", "patin",
  "piranha", "salmon", "sarden", "teri", "tongkol", "tuna", "pohon", "kumbang",
  "tutul", "belanda", "ekor panjang", "aedes", "rebon", "windu", "kobra", "piton",
  "sanca", "weling", "perah", "rangrang", "rebus", "hutan", "hias", "tawar",
  "bangkok", "adu", "aduan", "sawah", "kuningan", "tempur", "siberian", "siberia",
  "rahib", "pelacak", "pudel", "belimbing", "hijau", "mahakam", "kaisar", "duri"
]);

// Kata ulang & nama spesifik populer yg langsung boleh
const ANIMAL_WHITELIST = new Set([
  "cumi cumi", "kupu kupu", "ubur ubur", "kunang kunang", "kura kura", "laba laba",
  "undur undur", "undur undur laut", "anjing laut", "singa laut", "kuda laut",
  "bintang laut", "bulu babi", "gajah sumatera", "gajah afrika", "harimau sumatera",
  "harimau benggala", "badak jawa", "badak sumatera", "jalak bali", "pesut mahakam",
  "jalak suren", "burung hantu", "burung unta", "burung gereja", "burung kacer",
  "burung lovebird", "burung nuri", "burung kakaktua", "burung merak", "burung merpati",
  "burung kolibri", "burung walet", "burung puyuh", "burung elang", "burung bangau",
  "burung camar", "burung dara", "burung kenari", "burung kutilang", "burung maleo",
  "burung pelatuk", "burung pelikan", "burung flamingo", "burung gagak", "burung macaw",
  "burung toucan", "burung emu", "burung cenderawasih", "burung camar", "ikan badut",
  "ikan arwana", "ikan mas", "ikan nila", "ikan gurame", "ikan mujair", "ikan lele",
  "ikan patin", "ikan gabus", "ikan bandeng", "ikan bawal", "ikan kerapu", "ikan kakap",
  "ikan tuna", "ikan tongkol", "ikan sarden", "ikan teri", "ikan salmon", "ikan dori",
  "ikan cupang", "ikan koi", "ikan piranha", "macan tutul", "macan kumbang",
  "monyet belanda", "semut rangrang", "semut api", "belalang sembah", "domba garut"
]);

function shouldKeepAnimal(word) {
  if (ANIMAL_WHITELIST.has(word)) return true;

  const parts = word.split(" ").filter(Boolean);

  // Jika kata tunggal
  if (parts.length === 1) {
    // Harus ada di daftar populer atau (ada di kamus dan bukan kata abstrak)
    return POPULAR_SINGLE_ANIMALS.has(word);
  }

  // Jika 2 kata
  if (parts.length === 2) {
    const [p1, p2] = parts;
    // Cek apakah diawali prefix yang diizinkan dan diakhiri modifier yang diizinkan
    const hasValidPrefix = ALLOWED_PREFIXES.some(prefix => {
      // Jika prefix terdiri dari 2 kata (misal "lumba lumba")
      if (prefix.includes(" ")) {
        return word.startsWith(prefix);
      }
      return p1 === prefix;
    });

    if (hasValidPrefix && ALLOWED_MODIFIERS.has(p2)) {
      return true;
    }
  }

  return false;
}

const before = data.hewan.words.length;
const filtered = data.hewan.words.filter(shouldKeepAnimal);
const after = filtered.length;

console.log(`🐾 Hewan & Binatang: ${before} → ${after} kata (-${before - after})`);
const removed = data.hewan.words.filter(w => !shouldKeepAnimal(w));
console.log(`   Dihapus: ${removed.slice(0, 15).join(", ")} ...`);

// Update dan simpan
data.hewan.words = filtered;
fs.writeFileSync(catFilePath, JSON.stringify(data, null, 2), "utf8");
console.log("✅ Berhasil menyaring nama-nama hewan!");
