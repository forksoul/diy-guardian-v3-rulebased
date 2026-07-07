/* ═══════════════════════════════════════════════════════
   DIY Guardian — Background Service Worker v5
   Rule-based DIY analyzer (no API key needed)
   ═══════════════════════════════════════════════════════ */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ANALYZE') {
    try {
      const result = analyzeVideo(msg.payload);
      sendResponse({ ok: true, data: result });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
    return false;
  }
  if (msg.type === 'PING') {
    sendResponse({ ok: true });
    return false;
  }
});

// ── Keyword database ─────────────────────────────────────────────────────────

const DIY_KEYWORDS = [
  'diy','tutorial','cara','how to','howto','buat sendiri','perbaiki','repair',
  'install','pasang','ganti','replace','fix','pemasangan','langkah','step',
  'projek','project','bina','build','masang','rewiring','wiring','paip','plumbing',
  'elektrik','electrical','cat','paint','tile','jubin','decor','renovation',
  'renovate','ubahsuai','servo','motor','engine','baiki','modify','modifikasi',
  'weld','kimpalan','solder','drill','gerudi','potong','cut','ukur','measure'
];

const CATEGORIES = [
  {
    name: 'Elektrik',
    emoji: '⚡',
    keywords: ['elektrik','electrical','wiring','wayar','plug','soket','socket','fuse','circuit','breaker','lampu','light','switch','suis','voltan','voltage','ampere','power'],
    difficulty: 'Sukar',
    risk: 'Tinggi',
    diffScore: 8, riskScore: 9,
    ppe: [
      { name: 'Sarung tangan getah', emoji: '🧤', required: true },
      { name: 'Kasut keselamatan', emoji: '👢', required: true },
      { name: 'Gogal pelindung', emoji: '🥽', required: true },
      { name: 'Tester voltan', emoji: '🔌', required: true }
    ],
    alerts: [
      { level: 'danger',  text: 'Pastikan suis utama (DB box) dimatikan sebelum memulakan kerja.' },
      { level: 'danger',  text: 'Jangan sentuh wayar tanpa tester — semak voltan dahulu.' },
      { level: 'warning', text: 'Kerja elektrik memerlukan lesen wiring (wireman) mengikut undang-undang Malaysia.' }
    ],
    steps: [
      'Matikan bekalan elektrik di DB box dan pasang tanda amaran',
      'Semak tiada voltan menggunakan tester sebelum menyentuh wayar',
      'Kenal pasti wayar fasa (merah/coklat), neutral (biru) dan earth (hijau/kuning)',
      'Buat kerja penyambungan dengan teliti mengikut wiring diagram',
      'Semak semua sambungan sebelum hidupkan semula bekalan',
      'Uji fungsi dan semak tiada percikan atau bau terbakar'
    ],
    tips: [
      'Ambil gambar wiring asal sebelum ditanggalkan sebagai rujukan.',
      'Sentiasa guna alat bertebat (insulated tools) untuk kerja elektrik.',
      'Jika ragu-ragu, hubungi electrician berlesen.'
    ]
  },
  {
    name: 'Paip & Plumbing',
    emoji: '🔧',
    keywords: ['paip','pipe','plumbing','water','air','bocor','leak','sinki','sink','toilet','tandas','shower','pam','pump','drain','saliran','tap','kran','valve','pvc','fitting'],
    difficulty: 'Sederhana',
    risk: 'Sederhana',
    diffScore: 5, riskScore: 4,
    ppe: [
      { name: 'Sarung tangan', emoji: '🧤', required: true },
      { name: 'Gogal pelindung', emoji: '🥽', required: false },
      { name: 'Baju lama', emoji: '👕', required: false },
      { name: 'Tuala/kain', emoji: '🧻', required: true }
    ],
    alerts: [
      { level: 'warning', text: 'Tutup injap air utama (main valve) sebelum memulakan kerja.' },
      { level: 'info',    text: 'Sediakan baldi dan tuala untuk menampung air yang tersisa dalam paip.' },
      { level: 'info',    text: 'Guna plumber tape (PTFE tape) pada thread untuk elak kebocoran.' }
    ],
    steps: [
      'Tutup bekalan air utama dan buka paip untuk kosongkan tekanan',
      'Tanggalkan bahagian yang rosak dengan wrench yang sesuai',
      'Bersihkan thread dan fitting dari kotoran dan karat',
      'Balut thread dengan plumber tape (PTFE) 3-5 pusingan ikut arah jam',
      'Pasang bahagian baru dan ketatkan — jangan terlalu ketat',
      'Buka semula bekalan air dan semak kebocoran selama 5 minit'
    ],
    tips: [
      'Selalu ada spare washer dan O-ring sebagai ganti.',
      'Jangan guna wrench terlalu kuat pada paip PVC — mudah retak.',
      'Ambil gambar sebelum tanggal untuk rujukan semasa pasang semula.'
    ]
  },
  {
    name: 'Automotif',
    emoji: '🚗',
    keywords: ['kereta','car','motor','moto','motorcycle','enjin','engine','oil','minyak','brake','brek','tayar','tyre','tire','battery','bateri','filter','radiator','coolant','transmission','gearbox','spark plug','plug','exhaust','ekzos','belt','rantai','chain'],
    difficulty: 'Sederhana',
    risk: 'Sederhana',
    diffScore: 6, riskScore: 5,
    ppe: [
      { name: 'Sarung tangan mekanikal', emoji: '🧤', required: true },
      { name: 'Gogal pelindung', emoji: '🥽', required: true },
      { name: 'Kasut keselamatan', emoji: '👢', required: false },
      { name: 'Baju workshop', emoji: '🦺', required: false }
    ],
    alerts: [
      { level: 'warning', text: 'Pastikan enjin sejuk sepenuhnya sebelum membuka radiator atau tutup minyak.' },
      { level: 'danger',  text: 'Jangan bekerja di bawah kenderaan tanpa jack stand yang kukuh.' },
      { level: 'info',    text: 'Buang minyak terpakai di pusat kitar semula — jangan buang di longkang.' }
    ],
    steps: [
      'Matikan enjin dan tunggu sejuk sekurang-kurangnya 30 minit',
      'Pasang jack stand jika perlu angkat kenderaan — jangan bergantung pada jack sahaja',
      'Tanggalkan bahagian lama dengan hati-hati dan label semua bolt/skru',
      'Pasang bahagian baru mengikut spesifikasi pengeluar',
      'Semak semua sambungan dan torque bolt mengikut spec',
      'Hidupkan enjin dan uji fungsi — semak kebocoran dan bunyi luar biasa'
    ],
    tips: [
      'Sentiasa rujuk manual kenderaan untuk spesifikasi torque dan jenis cecair.',
      'Gunakan OEM parts atau jenama dipercayai untuk keselamatan.',
      'Simpan rekod semua kerja penyelenggaraan dalam buku log.'
    ]
  },
  {
    name: 'Kayu & Perabot',
    emoji: '🪵',
    keywords: ['kayu','wood','perabot','furniture','potong','cut','gergaji','saw','drill','gerudi','cat','paint','varnish','lacquer','sand','amplas','papan','plywood','mdf','dowel','screw','skru','nail','paku','glue','gam','cabinet','almari','meja','table','kerusi','chair','shelf','rak'],
    difficulty: 'Sederhana',
    risk: 'Rendah',
    diffScore: 5, riskScore: 3,
    ppe: [
      { name: 'Gogal pelindung', emoji: '🥽', required: true },
      { name: 'Pelindung telinga', emoji: '🦻', required: true },
      { name: 'Sarung tangan', emoji: '🧤', required: false },
      { name: 'Pelitup muka (habuk)', emoji: '😷', required: true }
    ],
    alerts: [
      { level: 'warning', text: 'Sentiasa potong menjauhi badan — jangan sekali-kali potong ke arah tangan.' },
      { level: 'info',    text: 'Ukur dua kali, potong sekali — periksa ukuran sebelum memotong.' },
      { level: 'info',    text: 'Pastikan bahan kerja dipegang kukuh dengan clamp sebelum dipotong atau digerudi.' }
    ],
    steps: [
      'Ukur dan tandakan dengan pensil sebelum dipotong',
      'Clamp bahan kerja pada workbench dengan selamat',
      'Guna gergaji/drill dengan kelajuan sesuai untuk jenis kayu',
      'Amplas permukaan mengikut arah ira kayu — mula dengan grit kasar ke halus',
      'Bersihkan habuk sebelum mengecat atau mengilap',
      'Sapukan cat/varnish dalam lapisan nipis dan biarkan kering antara lapisan'
    ],
    tips: [
      'Periksa mata gergaji dan gerudi — yang tumpul lebih berbahaya dari yang tajam.',
      'Baca arah ira kayu sebelum memotong untuk hasil yang lebih kemas.',
      'Gunakan wood filler untuk tampung lubang atau keretakan kecil.'
    ]
  },
  {
    name: 'Konkrit & Bata',
    emoji: '🧱',
    keywords: ['konkrit','concrete','cement','simen','bata','brick','tile','jubin','plaster','render','grout','screed','anchor','bolt','drilling','wall','dinding','floor','lantai','mortar','epoxy'],
    difficulty: 'Sederhana',
    risk: 'Sederhana',
    diffScore: 6, riskScore: 5,
    ppe: [
      { name: 'Gogal pelindung', emoji: '🥽', required: true },
      { name: 'Pelitup muka (habuk)', emoji: '😷', required: true },
      { name: 'Sarung tangan', emoji: '🧤', required: true },
      { name: 'Kasut keselamatan', emoji: '👢', required: true }
    ],
    alerts: [
      { level: 'warning', text: 'Simen basah bersifat alkali — elak sentuh kulit tanpa sarung tangan.' },
      { level: 'danger',  text: 'Semak lokasi paip dan wayar dalam dinding sebelum menggerudi.' },
      { level: 'info',    text: 'Basahkan permukaan brick/konkrit sebelum lepa untuk elak retak.' }
    ],
    steps: [
      'Semak lokasi paip/wayar tersembunyi menggunakan pipe/wire detector',
      'Pakai semua PPE sebelum memulakan kerja',
      'Sediakan campuran simen/mortar mengikut nisbah yang betul',
      'Bersihkan permukaan dari habuk, gris dan bahagian longgar',
      'Sapukan bahan menggunakan trowel dengan tekanan sekata',
      'Biarkan kering mengikut masa yang ditetapkan sebelum meneruskan'
    ],
    tips: [
      'Jangan campurkan terlalu banyak air dalam simen — lemahkan kekuatan.',
      'Tutup kerja simen dengan plastik selama 24 jam untuk curing yang baik.',
      'Simpan simen di tempat kering — yang sudah lembap tidak boleh digunakan.'
    ]
  },
  {
    name: 'Cat & Kemasan',
    emoji: '🎨',
    keywords: ['cat','paint','paint','primer','varnish','lacquer','spray','roller','brush','berus','dinding','wall','ceiling','siling','colour','warna','topcoat','undercoat','weathershield','emulsion','gloss'],
    difficulty: 'Mudah',
    risk: 'Rendah',
    diffScore: 2, riskScore: 2,
    ppe: [
      { name: 'Pelitup muka', emoji: '😷', required: true },
      { name: 'Sarung tangan', emoji: '🧤', required: true },
      { name: 'Baju lama', emoji: '👕', required: false },
      { name: 'Gogal (spray)', emoji: '🥽', required: false }
    ],
    alerts: [
      { level: 'info',    text: 'Pastikan ruangan mempunyai pengudaraan yang baik semasa mengecat.' },
      { level: 'warning', text: 'Cat spray sangat mudah terbakar — jauhkan dari punca api.' },
      { level: 'info',    text: 'Tutup perabot dan lantai dengan plastik/newspaper sebelum mengecat.' }
    ],
    steps: [
      'Bersihkan dan amplas permukaan — tampal lubang/retak dengan filler',
      'Masking tape pada tepi dan kawasan yang tidak mahu dicat',
      'Sapukan primer/undercoat dan biarkan kering sepenuhnya',
      'Cat lapisan pertama dengan gerakan sekata — atas ke bawah',
      'Biarkan kering 2-4 jam sebelum lapisan kedua',
      'Tanggalkan masking tape semasa cat masih sedikit lembap untuk tepi yang kemas'
    ],
    tips: [
      'Kacau cat dengan baik sebelum digunakan — jangan goncang.',
      'Cuci berus/roller dengan segera selepas digunakan.',
      'Simpan cat lebihan dalam bekas kedap udara untuk touch-up kemudian.'
    ]
  }
];

const NOT_DIY_KEYWORDS = [
  'review','unboxing','vlog','gaming','game','music','lagu','movie','filem',
  'drama','cerita','story','funny','lawak','comedy','prank','challenge',
  'reaction','podcast','interview','news','berita','documentary','documentary',
  'mukbang','food review','travel','hiking','workout','gym','dance','tiktok'
];

// ── Main analyzer ────────────────────────────────────────────────────────────

function analyzeVideo({ title, description }) {
  const text = `${title} ${description}`.toLowerCase();

  // Check if NOT DIY
  const notDiyScore = NOT_DIY_KEYWORDS.filter(k => text.includes(k)).length;
  const isDiyScore  = DIY_KEYWORDS.filter(k => text.includes(k)).length;

  if (notDiyScore > isDiyScore && isDiyScore < 2) {
    return {
      isDIY: false,
      notDIYReason: `Video ini nampaknya bukan tutorial atau projek DIY berdasarkan kandungan tajuk dan deskripsi.`
    };
  }

  // Match category
  let bestCategory = null;
  let bestScore    = 0;

  for (const cat of CATEGORIES) {
    const score = cat.keywords.filter(k => text.includes(k)).length;
    if (score > bestScore) {
      bestScore    = score;
      bestCategory = cat;
    }
  }

  // Default category if no match
  if (!bestCategory || bestScore === 0) {
    bestCategory = {
      name: 'Kerja Am DIY',
      emoji: '🔨',
      difficulty: 'Sederhana',
      risk: 'Sederhana',
      diffScore: 5, riskScore: 4,
      ppe: [
        { name: 'Sarung tangan', emoji: '🧤', required: true },
        { name: 'Gogal pelindung', emoji: '🥽', required: false },
        { name: 'Kasut keselamatan', emoji: '👢', required: false },
        { name: 'Pelitup muka', emoji: '😷', required: false }
      ],
      alerts: [
        { level: 'info',    text: 'Baca arahan pengeluar sebelum menggunakan mana-mana alat.' },
        { level: 'warning', text: 'Pastikan kawasan kerja bersih, teratur dan mempunyai pencahayaan yang baik.' }
      ],
      steps: [
        'Rancang kerja dan sediakan semua bahan/alat yang diperlukan',
        'Pakai PPE yang sesuai sebelum memulakan',
        'Ikuti langkah-langkah mengikut turutan yang betul',
        'Semak hasil kerja sebelum menggunakan',
        'Bersihkan kawasan kerja selepas selesai'
      ],
      tips: [
        'Jangan tergesa-gesa — kerja perlahan lebih selamat.',
        'Gunakan alat yang betul untuk setiap kerja.',
        'Hubungi profesional jika kerja di luar kemampuan.'
      ]
    };
  }

  // Build summary from title
  const summary = `Video ini menunjukkan cara ${title.toLowerCase().replace('cara','').replace('tutorial','').trim() || 'melakukan kerja DIY'} yang melibatkan kerja ${bestCategory.name.toLowerCase()}.`;

  return {
    isDIY:         true,
    category:      `${bestCategory.emoji} ${bestCategory.name}`,
    summary,
    difficulty:    bestCategory.difficulty,
    difficultyScore: bestCategory.diffScore,
    risk:          bestCategory.risk,
    riskScore:     bestCategory.riskScore,
    safetyAlerts:  bestCategory.alerts,
    ppe:           bestCategory.ppe,
    steps:         bestCategory.steps,
    safeTips:      bestCategory.tips,
    note:          '⚙️ Analisis berdasarkan sistem rule-based. Gunakan pertimbangan sendiri mengikut situasi sebenar.'
  };
}
