# anda dapat buat manual langsung, tambahkan ke `projects.js`
# ini kebetulan ada buat txt team nya
import json
import re

# 1. Tentukan nama file Anda
file_txt = "../Tim Capstone.txt"  # Ganti dengan nama file teks Anda
file_json_in = "students.json"  # File JSON sumber
file_json_out = "students_with_team.json"  # File hasil akhir

# 2. Baca file TXT Kelompok dan ekstrak ID Tim serta ID Student
student_team_map = {}
current_team = None

with open(file_txt, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue

        # Cari angka setelah tanda # untuk mendeteksi ID Tim
        if line.startswith("#"):
            match_team = re.match(r"#(\d+)", line)
            if match_team:
                current_team = int(match_team.group(1))

        # Ambil ID Student sebelum tanda minus '-'
        elif "-" in line and current_team is not None:
            parts = line.split("-", 1)
            student_id = parts[0].strip().lower()  # Contoh: h1101241042
            student_team_map[student_id] = current_team

# 3. Baca data asli dari students.json
with open(file_json_in, "r", encoding="utf-8") as f:
    students_data = json.load(f)

# 4. Cocokkan ID Student dengan email di JSON, lalu kelompokkan (grouping)
grouped_students = {}

for student in students_data:
    email = student.get("email", "").lower()
    team_found = None

    # Periksa apakah ada ID Student dari TXT yang terkandung di dalam email siswa ini
    for student_id, team_id in student_team_map.items():
        if student_id in email:
            team_found = str(team_id)  # Ubah ke string agar format key JSON konsisten
            break

    # Tentukan index kelompok (jika tidak ketemu kelompok, masuk ke "tanpa_tim")
    key_kelompok = team_found if team_found else "tanpa_tim"

    # Jika key belum ada di dictionary hasil, buat list baru
    if key_kelompok not in grouped_students:
        grouped_students[key_kelompok] = []

    # Masukkan data siswa ke kelompoknya (tanpa perlu menyertakan properti 'team_id' lagi karena sudah terkelompok)
    grouped_students[key_kelompok].append(student)

# 5. Simpan hasil akhir ke file JSON dengan format struktur baru
with open(file_json_out, "w", encoding="utf-8") as f:
    json.dump(grouped_students, f, indent=4, ensure_ascii=False)

print(
    f"Selesai! Data kelompok berhasil dikelompokkan dan disimpan ke '{file_json_out}'"
)
