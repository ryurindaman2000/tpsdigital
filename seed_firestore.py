import json
import urllib.request
import datetime

# Kredensial Firebase Project
PROJECT_ID = "tps-digital"
COLLECTION_NAME = "users"
DOCUMENT_ID = "admin"

# REST API Endpoint Firestore
url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/{COLLECTION_NAME}?documentId={DOCUMENT_ID}"

# Data Admin yang akan di-seed ke Firestore
data = {
    "fields": {
        "nim": {"stringValue": "admin"},
        "name": {"stringValue": "Panitia Pemilihan (Admin)"},
        "randomPassword": {"stringValue": "admin"},
        "role": {"stringValue": "ADMIN"},
        "hasVoted": {"booleanValue": False},
        "createdAt": {"stringValue": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    }
}

print(f"[INFO] Memulai Seeding Firestore untuk Admin [{DOCUMENT_ID}] di Project: {PROJECT_ID}...")

req = urllib.request.Request(
    url,
    data=json.dumps(data).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST"
)

try:
    with urllib.request.urlopen(req) as response:
        res_body = response.read().decode("utf-8")
        print("[SUCCESS] BERHASIL SEEDING ADMIN KE FIRESTORE!")
        print("Response dari Firestore REST API:")
        print(json.dumps(json.loads(res_body), indent=2))
except urllib.error.HTTPError as e:
    err_body = e.read().decode("utf-8")
    if e.code == 409: # Document ALREADY EXISTS -> Coba update / patch
        patch_url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/{COLLECTION_NAME}/{DOCUMENT_ID}"
        patch_req = urllib.request.Request(
            patch_url,
            data=json.dumps(data).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="PATCH"
        )
        try:
            with urllib.request.urlopen(patch_req) as patch_res:
                print("[INFO] Dokumen Admin sudah ada. Berhasil melakukan UPDATE/PATCH di Firestore!")
                print(json.dumps(json.loads(patch_res.read().decode("utf-8")), indent=2))
        except Exception as patch_err:
            print(f"[ERROR] Gagal melakukan Update: {patch_err}")
    else:
        print(f"[ERROR] HTTP Error {e.code}: {e.reason}")
        print(err_body)
except Exception as e:
    print(f"[ERROR] Terjadi kesalahan: {e}")
