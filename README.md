<img align="center" src="https://raw.githubusercontent.com/Leo42night/Leo42night/main/img/2.5D-virtual-show.png" />

# PPBO Gim Project
![GitHub](https://img.shields.io/badge/github-%23121011.svg?style=for-the-badge&logo=github&logoColor=white)

Gim virtual tour dari Capstone Project kelas Praktikum PBO 2025.
- Isometric 2D JS Engine Game (PixiJs)
- Showroom project
- OAuth Google (+Firebase JWT)
- Voting system by email & Leaderboard
- Quiz OOP
- Backend PHP

## Database
- users (id, name, email, picture, created_at)
- ratings (user_id, project_id, rate, created_at)
data static seperti project & team disimpan di js langsung. name, email, profileUrl dari team didapat dari kode di `dev/`

## Config
- buat `.env` dari `.env.example`
- Setup Google Auth:
  - APIs & Services → OAuth consent screen 
  - APIs & Services → Credentials → Create Credentials → OAuth Client ID
  - Client Web App (+Authorize Redirect URI), tambahkan GOOGLE_REDIRECT_URI
- Setup Server PHP & Database
- JWT Secret (32 - 64 random): 
  - Linux/MacOS: `openssl rand -hex 32`
  - Powersheel: `[guid]::NewGuid()`

## Run
```sh
composer install
php -S localhost:8080 -t public
```
Struktur Proyek:
- `App/`: Kode PHP MVC
- `dev/`: Ambil data student team (statis, tidak perlu di db)
- `public/`: frontend, berisi js logika game. `index.php` akses kode `App/`

Struktur PHP MVC:
- `App/Controllers`: atur route pertama (`/api`, `/auth`, `/home`), method di dalamnya adalah route kedua (cth. `/home/index`, `/api/ratings`, dsb.)
- `App/Core`: atur logika Model View Controller
- `App/config/config.php`: load data env
  
## Deployment
Current:
- Vercel
- Database: Turso SQLite (HTTP API)

1st [6537b5](https://github.com/Leo42night/virtual-2.5d/commit/6537b5041c4880cc18acafd9038d88d0a9f4e5f4):
- Google Cloud Build (auto-trigger from repo Github)
- Google Cloud Run (domain mapping using Hostinger service)
- Google Cloud SQL (socket connection PDO)

## Ideas
- pakai `websocket` untuk dashboard rating & multiplayer.

## Tools
- [Figma Design](https://www.figma.com/design/VIOwFx2goOaMaFkiq0onVA/tiled?node-id=0-1&t=P67We6aAWDxqfwbW-1) untuk aset UI game.
- [Tiled app](https://www.mapeditor.org/) editor file `iso.tmx` dan `iso.tsx`

## Asset UI
- [2dClassroomAssetPackByStyloo](https://styloo.itch.io/2dclassroom)
- [Eris Esra's Character Template 4.0](https://erisesra.itch.io/character-templates-pack/devlog/1118816/update-40)

## Repo
- [**ppbo-2025**](https://github.com/Leo42night/ppbo-2025) (Referensi konten proyek)
