# Menu GX

Aplikasi kecil untuk melihat menu makan kantor per hari di HP Android, **lengkap dengan widget layar utama**.

- Buka aplikasi → langsung tampil menu **hari ini** (Pagi / Siang / Sore). Geser kiri/kanan untuk pindah hari.
- **Widget** menampilkan menu hari ini dalam 3 kolom (Pagi | Siang | Sore): jenis nasi, lauk utama, dan pelengkap. Jam makan yang sedang berlangsung disorot. Mulai jam 20.00 widget menampilkan menu besok. Contoh tampilan: `dist/widget-gelap.png`, `dist/widget-terang.png`.
- Menu bulan baru bisa di-import langsung dari HP: tombol ⬆, lalu pilih file Excel dari kantor.

## Isi folder

| Path | Fungsi |
| --- | --- |
| `www/` | Web app: `index.html`, `app.js`, `parser.js` (pembaca Excel), `menu.json` (data menu bawaan) |
| `android/` | Proyek Android (Capacitor) dan kode widget di `app/src/main/java/com/menugx/app/` |
| `tools/build-menu.js` | Mengubah Excel menjadi `www/menu.json` |
| `dist/MenuGX.apk` | APK siap pasang (build debug) |

Kode widget:

- `MenuData.java`: memilih menu & jam makan yang disorot (dites di `app/src/test/.../MenuDataTest.java`)
- `MenuWidgetProvider.java`: menggambar widget dan menyegarkannya tiap 30 menit + saat jam makan berganti
- `MenuGXPlugin.java`: jembatan dari `app.js` (kirim data ke widget, tombol "Pasang widget", bagikan ke WhatsApp)
- Tampilan: `res/layout/widget_menu.xml`, warna terang/gelap di `res/values*/widget_colors.xml`

## Pasang di HP

1. Kirim `dist/MenuGX.apk` ke HP (WhatsApp/Drive/kabel USB), buka file-nya, lalu izinkan "instal aplikasi tidak dikenal".
2. Buka aplikasi **Menu GX** → tekan **Pasang widget di layar utama** (atau tekan lama layar utama → Widget → Menu GX).

## Update menu tiap bulan

- **Dari HP**: tombol ⬆ di aplikasi → pilih Excel bulan baru. Widget ikut diperbarui.
- **Bawaan APK**: `npm run menu -- "D:\Download\Menu Makan GX - November 2026.xlsx"` lalu build ulang APK.

## Build

Butuh Node 22+, Android Studio (JDK 21 & Android SDK). Pertama kali: `npm install`.

```bash
npm run apk
```

APK hasilnya ada di `android/app/build/outputs/apk/debug/app-debug.apk`. Bisa juga buka folder `android/` di Android Studio lalu Run ke HP.

Kalau `JAVA_HOME` belum diatur, arahkan ke JDK bawaan Android Studio (`D:\Devtools\Android Studio\jbr`).

## Versi web (opsional)

`npm run serve` lalu buka http://localhost:5173. Folder `www/` juga bisa di-online-kan ke hosting statis (GitHub Pages, Netlify, dll.) sebagai PWA. Kalau sudah online, isi `REMOTE_MENU_URL` di `www/app.js` dengan link `menu.json`, supaya aplikasi Android ikut mengambil menu terbaru tanpa import.

## Pengaturan

- Jam untuk tanda "Sekarang": `NOW_SLOTS` di `www/app.js` dan `SLOT_END` di `MenuData.java` (default Pagi sebelum 10.00, Siang sebelum 15.00, sisanya Sore).
- Jam widget mulai menampilkan menu besok: `SHOW_TOMORROW_FROM` di `MenuData.java` (default 20.00).
