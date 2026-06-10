# PPBO Gim Project
<img align="center" src="https://raw.githubusercontent.com/Leo42night/Leo42night/main/img/2.5D-virtual-show.png" />

Gim virtual tour dari Capstone Project kelas Praktikum PBO 2025.
- Isometric 2D JS Engine Game (PixiJs)
- Showroom project
- OAuth Google
- Voting system by email & Leaderboard
- Quiz OOP
- Backend PHP

## Database
- users (id, name, email, picture, created_at)
- pojects (id, title, description, image, link_web, link_vid_pitch, link_vid_demo, link_repo, link_doc)
- teams (project_id, user_id, role)
- ratings (user_id, project_id, rate, created_at)

## Config
- Setup Google Auth:
  - APIs & Services → OAuth consent screen 
  - APIs & Services → Credentials → Create Credentials → OAuth Client ID
  - Client Web App (+Authorize Redirect URI)
- Setup Server PHP & Database (MySQL), using Cloud Run & Cloud SQL
- JWT Secret (32 - 64 random): 
  - Linux/MacOS: `openssl rand -hex 32`
  - Powersheel: `[guid]::NewGuid()`
  
## Deployment Setup
- Google Cloud Build (auto-trigger from repo Github)
- Google Cloud Run (domain mapping using Hostinger service)
- Google Cloud SQL (socket connection)

## Tools
- [Figma Design](https://www.figma.com/design/VIOwFx2goOaMaFkiq0onVA/tiled?node-id=0-1&t=P67We6aAWDxqfwbW-1) untuk aset UI game.
- [Tiled app](https://www.mapeditor.org/) editor file `iso.tmx` dan `iso.tsx`

## Asset UI
- [2dClassroomAssetPackByStyloo](https://styloo.itch.io/2dclassroom)
- [Eris Esra's Character Template 4.0](https://erisesra.itch.io/character-templates-pack/devlog/1118816/update-40)

## Run
```bash
php -S localhost:8080 -t public
```

## Repo
- [Main Repo **ppbo-2025**](https://github.com/Leo42night/ppbo-2025) 
