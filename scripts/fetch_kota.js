const fs = require("fs");
const path = require("path");

const WIKI_API = "https://id.wikipedia.org/w/api.php";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function apiGet(params) {
  const url = new URL(WIKI_API);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "KajepitBot/1.0 (WordWich game)" }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function run() {
  console.log("🏙️ Mengambil daftar nama kota di Indonesia dari Wikipedia...\n");

  const citySet = new Set();

  // 1. Parse dari Wikipedia
  const pagesToQuery = [
    "Daftar_kota_otonom_di_Indonesia",
    "Daftar_kabupaten_dan_kota_di_Indonesia",
    "Daftar_kota_di_Indonesia_menurut_jumlah_penduduk",
    "Daftar_kota_di_Indonesia_menurut_provinsi"
  ];

  for (const pTitle of pagesToQuery) {
    console.log(`   📄 Parsing ${pTitle}...`);
    const data = await apiGet({
      action: "query",
      prop: "links",
      titles: pTitle,
      pllimit: 500
    });

    if (data?.query?.pages) {
      for (const pid in data.query.pages) {
        const links = data.query.pages[pid].links || [];
        for (const l of links) {
          let t = l.title;
          if (t.startsWith("Kota ")) {
            citySet.add(t);
            citySet.add(t.replace(/^Kota\s+/i, ""));
          }
        }
      }
    }
    await sleep(200);
  }

  // 2. Daftar nama kota & daerah perkotaan di Indonesia (98 kota otonom/admin + kota kabupaten populer)
  const POPULAR_CITIES = [
    "ambon", "balikpapan", "banda aceh", "bandar lampung", "bandung", "banjar",
    "banjarbaru", "banjarmasin", "batam", "batu", "baubau", "bekasi", "bengkulu",
    "bima", "binjai", "bitung", "blitar", "bogor", "bontang", "bukittinggi",
    "cilegon", "cimahi", "cirebon", "denpasar", "depok", "dumai", "gorontalo",
    "gunungsitoli", "jakarta", "jakarta barat", "jakarta pusat", "jakarta selatan",
    "jakarta timur", "jakarta utara", "jambi", "jayapura", "jogja", "yogyakarta",
    "kediri", "kendari", "kotamobagu", "kupang", "langsa", "lhokseumawe",
    "lubuklinggau", "madiun", "magelang", "makassar", "malang", "manado",
    "mataram", "medan", "metro", "mojokerto", "nusantara", "padang", "padang panjang",
    "padangsidimpuan", "pagar alam", "palangkaraya", "palembang", "palopo",
    "palu", "pangkalpinang", "parepare", "pariaman", "pasuruan", "payakumbuh",
    "pekalongan", "pekanbaru", "pematangsiantar", "pontianak", "prabumulih",
    "probolinggo", "sabang", "salatiga", "samarinda", "sawahlunto", "semarang",
    "serang", "sibolga", "singkawang", "solok", "solo", "surakarta", "sorong",
    "subulussalam", "sukabumi", "sungai penuh", "surabaya", "tangerang",
    "tangerang selatan", "tanjungbalai", "tanjungpinang", "tarakan", "tasikmalaya",
    "tebing tinggi", "ternate", "tidore", "tomohon", "tual", "banyuwangi",
    "purwokerto", "garut", "cianjur", "indramayu", "sumedang", "subang",
    "kuningan", "majalengka", "brebes", "tegal", "pemalang", "kendal",
    "kudus", "jepara", "pati", "rembang", "blora", "sragen", "karanganyar",
    "wonogiri", "boyolali", "klaten", "sukoharjo", "wonosobo", "temanggung",
    "banjarnegara", "purbalingga", "cilacap", "kebumen", "purworejo", "sleman",
    "bantul", "kulon progo", "gunungkidul", "ngawi", "magetan", "ponorogo",
    "pacitan", "trenggalek", "tulungagung", "nganjuk", "jombang", "lamongan",
    "gresik", "sidoarjo", "situbondo", "bondowoso", "lumajang", "jember",
    "pamekasan", "sampang", "sumenep", "bangkalan", "singaraja", "ubud",
    "kuta", "sanur", "tenggarong", "nunukan", "merauke", "biak", "timika",
    "wamena", "nabire", "manokwari", "fakfak", "kaimana", "saumlaki",
    "labuan bajo", "ende", "ruteng", "waingapu", "kalabahi", "atambua",
    "tahuna", "raha", "kolaka", "maros", "gowa", "takalar", "bantaeng",
    "bulukumba", "sinjai", "bone", "soppeng", "wajo", "sidrap", "pinrang",
    "enrekang", "toraja", "mamuju", "majene", "luwuk", "poso", "toli toli",
    "buol", "donggala", "parigi", "sampit", "pangkalan bun", "singkawang",
    "sambas", "ketapang", "sintang", "sanggau", "duri", "bengkalis",
    "siak", "bangkinang", "kotabumi", "kalianda", "pringsewu", "muara enim",
    "lahat", "baturaja", "curup", "bengkulu", "muara bungo", "sungai penuh",
    "kabanjahe", "tarutung", "balige", "sigli", "bireuen", "meulaboh", "calang"
  ];

  POPULAR_CITIES.forEach(c => citySet.add(c));

  // Cleaning & Normalization
  const cleanedSet = new Set();

  for (let raw of citySet) {
    if (!raw) continue;
    let name = raw
      .replace(/\s*\([^)]*\)/g, "") // Hapus penjelasan dalam kurung
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")   // Hapus karakter khusus
      .replace(/\s+/g, " ")        // Normalisasi spasi
      .trim();

    if (!name || name.length < 2 || name.length > 30) continue;
    if (name.includes("administrasi") || name.includes("otonom") || name.includes("daftar")) continue;

    // Hapus awalan "kota " jika ada, hanya simpan nama kota murni (misal: "bandung", "medan")
    if (name.startsWith("kota ")) {
      name = name.replace(/^kota\s+/, "").trim();
    }

    const STOP_WORDS = new Set(["kota", "kabupaten", "provinsi", "daerah", "wilayah", "kecamatan", "kelurahan", "indonesia", "satelit", "otonom"]);
    if (name.length >= 2 && !STOP_WORDS.has(name) && !name.includes("administrasi") && !name.includes("otonom") && !name.includes("daftar")) {
      cleanedSet.add(name);
    }
  }

  const finalWords = Array.from(cleanedSet).sort();

  console.log(`   ✅ Total ${finalWords.length} nama kata kota siap dimasukkan.\n`);

  // Muat categories.json
  const catPath = path.join(__dirname, "..", "categories.json");
  const categories = JSON.parse(fs.readFileSync(catPath, "utf8"));

  // Tambahkan kategori kota
  categories["kota"] = {
    name: "Kota di Indonesia",
    emoji: "🏙️",
    words: finalWords
  };

  fs.writeFileSync(catPath, JSON.stringify(categories, null, 2), "utf8");
  console.log(`🎉 Berhasil menambahkan kategori "kota" ke ${catPath}!`);
}

run().catch(console.error);
