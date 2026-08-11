import urllib.request
import json
import ssl

PROJECT_ID = "jambulayam-517e1"
BASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"

# 1. Data Akun Admin
ADMIN_DATA = {
    "nim": {"stringValue": "admin"},
    "name": {"stringValue": "Panitia Pemilihan (Admin)"},
    "role": {"stringValue": "ADMIN"},
    "randomPassword": {"stringValue": "admin"},
    "password": {"stringValue": "admin"},
    "hasVoted": {"booleanValue": False},
    "createdAt": {"stringValue": "2026-08-11T12:00:00.000Z"}
}

# 2. Data Pengaturan Aplikasi (Settings)
SETTINGS_DATA = {
    "id": {"stringValue": "default"},
    "appName": {"stringValue": "TPS-DIGITAL"},
    "subTitle": {"stringValue": "Sistem E-Voting Terenkripsi & Transparan"},
    "logoUrl": {"stringValue": "/images/default-logo.png"},
    "bannerUrl": {"stringValue": "/images/default-banner.jpg"},
    "updatedAt": {"stringValue": "2026-08-11T12:00:00.000Z"}
}

def seed_database():
    context = ssl._create_unverified_context()
    
    # --- Seed Admin User ---
    url_admin = f"{BASE_URL}/users/admin"
    body_admin = json.dumps({"fields": ADMIN_DATA}).encode('utf-8')
    req_admin = urllib.request.Request(url_admin, data=body_admin, headers={"Content-Type": "application/json"}, method="PATCH")
    
    # --- Seed Settings ---
    url_settings = f"{BASE_URL}/settings/default"
    body_settings = json.dumps({"fields": SETTINGS_DATA}).encode('utf-8')
    req_settings = urllib.request.Request(url_settings, data=body_settings, headers={"Content-Type": "application/json"}, method="PATCH")
    
    try:
        print(f"[INFO] Memulai Seeding Firestore Project: '{PROJECT_ID}'...")
        
        # Execute Admin
        with urllib.request.urlopen(req_admin, context=context) as res:
            print("[SUCCESS] Akun Admin (users/admin) Berhasil Di-seed!")
            
        # Execute Settings
        with urllib.request.urlopen(req_settings, context=context) as res:
            print("[SUCCESS] Pengaturan Aplikasi (settings/default) Berhasil Di-seed!")
            
        print("\n----------------------------------------")
        print("SEEDING SELESAI & BERHASIL PENUH!")
        print("----------------------------------------")
    except urllib.error.HTTPError as e:
        print(f"\n[ERROR] HTTP Error {e.code}: {e.reason}")
        print(e.read().decode('utf-8'))
    except Exception as err:
        print(f"\n[ERROR] Terjadi kesalahan: {err}")

if __name__ == "__main__":
    seed_database()
