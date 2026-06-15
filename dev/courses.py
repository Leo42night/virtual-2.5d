# ? ambil data course_id
# untuk dapat data user (name, email, picture) dari student yang melakukan pameran.
# sebagai teacher, ambil data dari classroom pakai dari courses id

# 1. buat proyek GCP, aktifkan API di bawah.
# 2. Konfigurasi OAuth Consent Screen (Layar Persetujuan)
# 3. Create Credentials -> pilih OAuth client ID (Desktop App)
#   -> Download JSON (rename jadi `credentials.json`, simpan ke folder dev/ ini)
# 4. click nama Client ID, akan muncul menu 'Data Access',
#       -> Add Scope -> manual paste-kan AUTH_SCOPE di bawah -> Update -> Save
# pip install google-api-python-client google-auth-oauthlib

# 1. ambil data courses id
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

import os

# =========================
# SCOPES (! Hapus token.json tiap ada perubahan scope)
# =========================
# API: Classroom
AUTH_SCOPES = [
    # lihat course (id, name)
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    # lihat data student dalam course (name)
    "https://www.googleapis.com/auth/classroom.rosters.readonly",
    # lihat data student dalam course (email)
    "https://www.googleapis.com/auth/classroom.profile.emails",
    # lihat data student dalam course (photo)
    "https://www.googleapis.com/auth/classroom.profile.photos",
]

TOKEN_FILE = "token.json"
CLIENT_SECRET_FILE = "credentials.json"


# =========================
# CORE OAUTH CREDS
# =========================
def _get_auth_creds():
    creds = None

    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, AUTH_SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                CLIENT_SECRET_FILE, AUTH_SCOPES
            )
            creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, "w") as token:
            token.write(creds.to_json())

    return creds


def get_service_courses():
    return build("classroom", "v1", credentials=_get_auth_creds())


service = get_service_courses()
courses = service.courses().list().execute()

# Course ID
if __name__ == "__main__":
    for c in courses.get("courses", []):
        print(c["id"], "-", c["name"])
    # 806297523272 - Praktikum PBO Asdos 2025/2026
