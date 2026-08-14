# ZYN Inner Chamber Print

Next.js bridge yang:

1. Meng-embed kiosk [inner-chamber.tech](https://inner-chamber.tech/) di iframe
2. Mem-poll `GET /api/posters/latest` (proxy server-side, token tidak ke browser)
3. Menyimpan byte PNG lalu memicu print dialog saat ada poster

## Setup

```bash
npm install
cp .env.example .env.local
# isi POSTER_ACCESS_TOKEN di .env.local
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

## PWA (install + fullscreen)

App ini installable sebagai PWA:

- `display: fullscreen` (portrait)
- Service worker di `/sw.js` (API polling **tidak** di-cache)
- Install dari Chrome/Edge: ikon install di address bar, atau menu → **Install app**

Untuk mini PC kiosk:

```bash
npm run build && npm run start
# lalu buka http://localhost:3000 → Install → buka app terpasang (fullscreen)
```

Catatan: install PWA butuh HTTPS atau `localhost`.

## Test print 4 hasil

Buka [http://localhost:3000/print](http://localhost:3000/print):

- Logic & config **terpisah** dari kiosk (tidak pakai wrap `cover-result.png`)
- Grid 4 gambar, klik ON/OFF
- Config width `%` / top-left `px` (localStorage sendiri)
- Ctrl+C toggle panel config

## Env

| Key | Keterangan |
| --- | --- |
| `POSTER_ACCESS_TOKEN` | Bearer token dari Inner Chamber |
| `POSTER_API_BASE_URL` | Default `https://inner-chamber.tech` |
| `KIOSK_URL` | URL iframe |
| `POLL_INTERVAL_MS` | Interval polling (default `3000`) |

## Catatan

- Upstream memakai consume-on-read: response `200` menghapus poster di server.
- Bridge menyimpan blob lokal dulu sebelum `window.print()`.
- Iframe cross-origin → URL halaman result tidak bisa dibaca; sinyal cetak datang dari API (slot terisi setelah result upload).
