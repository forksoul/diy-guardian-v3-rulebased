# 🛡️ DIY Guardian v2 — Chrome Extension (Gemini AI)

Analisis video DIY YouTube secara automatik menggunakan **Google Gemini AI**.

---

## 📦 Cara Install

1. Buka Chrome → pergi ke `chrome://extensions/`
2. Aktifkan **Developer mode** (toggle kanan atas)
3. Klik **"Load unpacked"**
4. Pilih folder `diy-guardian-extension` ini
5. Extension 🛡️ akan muncul di toolbar Chrome

---

## 🔑 Dapatkan Gemini API Key (PERCUMA)

1. Pergi ke → **https://aistudio.google.com/app/apikey**
2. Log masuk dengan Google Account
3. Klik **"Create API Key"**
4. Salin key (bermula dengan `AIza...`)

---

## ⚙️ Tetapan API Key

1. Klik ikon 🛡️ DIY Guardian di toolbar Chrome
2. Tampal **Gemini API Key** dalam kotak
3. Klik **💾 Simpan Tetapan**

---

## 🚀 Cara Guna

1. Pergi ke mana-mana video YouTube
2. Panel DIY Guardian muncul di kanan skrin
3. Klik **⚡ Analisis**
4. Gemini akan analisis dan paparkan:

| Maklumat | Penerangan |
|----------|-----------|
| 📊 Tahap Kesukaran | Mudah / Sederhana / Sukar |
| ⚠️ Tahap Risiko | Rendah / Sederhana / Tinggi |
| 🚨 Amaran Keselamatan | Bahaya khusus dalam video |
| 🦺 Senarai PPE | Alat perlindungan yang diperlukan |
| 📋 Senarai Langkah | Checklist interaktif (boleh ditick) |
| 💡 Tip Selamat | Cadangan keselamatan tambahan |
| ⭐ Rating Kefahaman | Nilai kefahaman anda (disimpan) |
| 📝 Nota Peribadi | Nota per video (disimpan) |

---

## 💾 Penyimpanan Data

- Analisis di-cache per video (tak perlu analisis semula)
- Nota, rating & checklist disimpan dalam `chrome.storage.local`
- Tiada data dihantar ke server selain Gemini API

---

## 📁 Struktur Fail

```
diy-guardian-extension/
├── manifest.json    ← Konfigurasi extension
├── content.js       ← Logik utama (inject ke YouTube)
├── panel.css        ← Gaya visual panel
├── popup.html       ← UI tetapan API key
├── popup.js         ← Logik tetapan
└── icons/           ← Ikon extension
```
