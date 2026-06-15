# ! jalankan dulu courses.py
# ? ambil name, email, photoUrl dari student di dalam course (by COURSE_ID)

from courses import get_service_courses
import json

service_courses = get_service_courses()
COURSE_ID = "806297523272"  # sesuaikan dgn course anda

# 1. Ambil daftar siswa dari Google Classroom
print("Mengambil data siswa dari Classroom...")
results = service_courses.courses().students().list(courseId=COURSE_ID).execute()
students_classroom = results.get("students", [])

# Membuat list baru dengan struktur [{ "nama": "...", "email": "..." }]
student_list = []

for s in students_classroom:
    profile = s.get("profile", {})
    name_obj = profile.get("name", {})

    full_name = name_obj.get("fullName", "")
    email = profile.get("emailAddress", "")
    photoUrl = "https:" + profile.get("photoUrl", "")

    # Masukkan ke dalam list sesuai struktur yang diminta
    student_list.append({"nama": full_name, "email": email, "photoUrl": photoUrl})

# # Menentukan nama file JSON
nama_file = "students.json"

# # Menyimpan ke file JSON
with open(nama_file, "w", encoding="utf-8") as f:
    json.dump(student_list, f, indent=4, ensure_ascii=False)

print(f"Data berhasil disimpan ke {nama_file}")
