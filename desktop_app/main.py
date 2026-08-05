import sys
import os
import socket
import json
import time
import subprocess
import threading
import re
from PySide6.QtCore import Qt, QTimer, QUrl, Signal, QObject
from PySide6.QtGui import QIcon, QPixmap, QDesktopServices, QColor
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QFrame, QTableWidget, QTableWidgetItem,
    QHeaderView, QDialog, QLineEdit, QMessageBox, QProgressBar,
    QGraphicsDropShadowEffect, QScrollArea, QTextEdit
)

# ==========================================
# PATHS CONFIG
# ==========================================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(BASE_DIR, "public", "images")
SPLASH_IMG = os.path.join(PUBLIC_DIR, "splashscreen.png")
LOGO_IMG = os.path.join(PUBLIC_DIR, "default-logo.ico")

# Tool Paths (bundled within project root)
NGINX_DIR = os.path.join(BASE_DIR, "nginx-1.29.4")
NGINX_EXE = os.path.join(NGINX_DIR, "nginx.exe")
CLOUDFLARED_EXE = os.path.join(BASE_DIR, "cloudflared-windows-amd64.exe")

ADMIN_DB_FILE = os.path.join(os.path.dirname(__file__), "admins_config.json")

# Nginx listens on port 80, proxies to Next.js on port 3000
NEXTJS_PORT = 3000   # Next.js internal port (npm run dev)
NGINX_PORT  = 80     # Nginx public-facing port


def get_local_ip():
    """Mendapatkan IP Address lokal komputer di WiFi/LAN."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def load_admins():
    # Ambil password default dari .env jika ada
    env_pass = "TpsDigital@2026"
    env_file = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_file):
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("ADMIN_PASSWORD="):
                        env_pass = line.split("=", 1)[1].strip().strip('"')
        except Exception:
            pass

    default_admin = {"username": "admin", "password": env_pass, "name": "Administrator Utama", "created_at": time.strftime("%Y-%m-%d")}

    if not os.path.exists(ADMIN_DB_FILE):
        default_list = [default_admin]
        save_admins(default_list)
        return default_list

    try:
        with open(ADMIN_DB_FILE, "r", encoding="utf-8") as f:
            admins = json.load(f)

        if not isinstance(admins, list) or len(admins) == 0:
            admins = [default_admin]
            save_admins(admins)
            return admins

        # Pastikan setiap admin memiliki password valid
        updated = False
        has_admin_user = any(a.get("username") == "admin" for a in admins)

        for a in admins:
            if not a.get("password"):
                a["password"] = env_pass
                updated = True

        if updated:
            save_admins(admins)

        return admins
    except Exception:
        return [default_admin]


def save_admins(admins):
    with open(ADMIN_DB_FILE, "w", encoding="utf-8") as f:
        json.dump(admins, f, indent=2)

    # Sinkronisasi kredensial admin ke file .env untuk Next.js Web Server
    if admins and len(admins) > 0:
        first_admin = admins[0]
        u = first_admin.get("username", "admin")
        p = first_admin.get("password") or "TpsDigital@2026"

        env_file = os.path.join(BASE_DIR, ".env")
        if os.path.exists(env_file):
            try:
                with open(env_file, "r", encoding="utf-8") as f:
                    lines = f.readlines()

                new_lines = []
                has_u = False
                has_p = False

                for line in lines:
                    if line.startswith("ADMIN_USERNAME="):
                        new_lines.append(f'ADMIN_USERNAME="{u}"\n')
                        has_u = True
                    elif line.startswith("ADMIN_PASSWORD="):
                        new_lines.append(f'ADMIN_PASSWORD="{p}"\n')
                        has_p = True
                    else:
                        new_lines.append(line)

                if not has_u:
                    new_lines.append(f'ADMIN_USERNAME="{u}"\n')
                if not has_p:
                    new_lines.append(f'ADMIN_PASSWORD="{p}"\n')

                with open(env_file, "w", encoding="utf-8") as f:
                    f.writelines(new_lines)
            except Exception as e:
                print(f"[AdminSync] Failed to update .env: {e}")



# ==========================================
# SIGNAL BRIDGE (Thread → Qt)
# ==========================================
class WorkerSignals(QObject):
    tunnel_url_found = Signal(str)
    tunnel_stopped   = Signal()
    server_ready     = Signal()


# ==========================================
# 1. SPLASH SCREEN PREMIUM
# ==========================================
class SplashScreen(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowFlags(Qt.SplashScreen | Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.resize(620, 410)
        self.center()
        self.init_ui()

    def center(self):
        qr = self.frameGeometry()
        cp = QApplication.primaryScreen().availableGeometry().center()
        qr.moveCenter(cp)
        self.move(qr.topLeft())

    def init_ui(self):
        layout = QVBoxLayout()
        layout.setContentsMargins(12, 12, 12, 12)

        card = QFrame()
        card.setObjectName("SplashCard")
        card.setStyleSheet("""
            QFrame#SplashCard {
                background-color: #ffffff;
                border-radius: 16px;
                border: 1px solid #cbd5e1;
            }
        """)

        shadow = QGraphicsDropShadowEffect(self)
        shadow.setBlurRadius(24)
        shadow.setColor(QColor(0, 0, 0, 80))
        shadow.setOffset(0, 4)
        card.setGraphicsEffect(shadow)

        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(20, 16, 20, 16)
        card_layout.setSpacing(12)

        lbl_top_title = QLabel("TPS-DIGITAL Loading...")
        lbl_top_title.setStyleSheet("font-size: 13px; font-weight: bold; color: #0f172a; border: none; background: transparent;")
        card_layout.addWidget(lbl_top_title)

        self.lbl_img = QLabel()
        self.lbl_img.setAlignment(Qt.AlignCenter)
        if os.path.exists(SPLASH_IMG):
            pix = QPixmap(SPLASH_IMG).scaled(540, 240, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            self.lbl_img.setPixmap(pix)
        else:
            self.lbl_img.setText("TPS-DIGITAL WEB SERVER")
            self.lbl_img.setStyleSheet("color: #0f172a; font-size: 22px; font-weight: bold; border: none;")
        card_layout.addWidget(self.lbl_img, stretch=1)

        self.lbl_status = QLabel("MEMERIKSA JARINGAN & OTENTIKASI SERVER...")
        self.lbl_status.setAlignment(Qt.AlignCenter)
        self.lbl_status.setStyleSheet("color: #475569; font-size: 11px; font-weight: 800; border: none; background: transparent; letter-spacing: 0.5px;")
        card_layout.addWidget(self.lbl_status)

        self.progress = QProgressBar()
        self.progress.setRange(0, 100)
        self.progress.setValue(0)
        self.progress.setFixedHeight(4)
        self.progress.setTextVisible(False)
        self.progress.setStyleSheet("""
            QProgressBar { background-color: #f1f5f9; border-radius: 2px; border: none; }
            QProgressBar::chunk { background-color: #2563eb; border-radius: 2px; }
        """)
        card_layout.addWidget(self.progress)

        lbl_footer = QLabel("TPS-DIGITAL Platform v1.0.0-tps • PancakaLabs")
        lbl_footer.setAlignment(Qt.AlignCenter)
        lbl_footer.setStyleSheet("color: #94a3b8; font-size: 10px; font-style: italic; border: none; background: transparent;")
        card_layout.addWidget(lbl_footer)

        layout.addWidget(card)
        self.setLayout(layout)

        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update_progress)
        self.step = 0
        self.timer.start(25)

    def update_progress(self):
        self.step += 2
        self.progress.setValue(self.step)
        if self.step == 25:
            self.lbl_status.setText("MEMERIKSA ANTARMUKA JARINGAN LOKAL & IP ADDRESS...")
        elif self.step == 55:
            self.lbl_status.setText("MEMUAT PENGATURAN AKUN ADMIN & DATABASE...")
        elif self.step == 85:
            self.lbl_status.setText("MENYIAPKAN CONTROL PANEL WEB SERVER...")
        elif self.step >= 100:
            self.timer.stop()
            self.close()


# ==========================================
# 2. DIALOG PANDUAN & ADMIN CRUD
# ==========================================
class GuideDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Panduan Operasional Server TPS-DIGITAL")
        self.setFixedSize(560, 500)
        self.setStyleSheet("background-color: #ffffff; color: #0f172a;")
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(18, 18, 18, 18)
        layout.setSpacing(12)

        title = QLabel("📖 Panduan Operasional Web Server Control")
        title.setStyleSheet("font-size: 15px; font-weight: bold; color: #0f172a; border: none;")
        layout.addWidget(title)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet("border: 1px solid #e2e8f0; border-radius: 10px; background-color: #f8fafc;")

        content_widget = QWidget()
        content_layout = QVBoxLayout(content_widget)
        content_layout.setSpacing(10)

        steps = [
            ("1. Menjalankan Web Server (Nginx)",
             "Klik '▶ Start Server'. Aplikasi akan menjalankan Nginx (port 80) sebagai reverse proxy ke Next.js (port 8080). Status berubah menjadi 'Server Running'."),
            ("2. Mengaktifkan Terowongan Publik (Cloudflare Tunnel)",
             "Klik '⚡ Start Tunnel'. Aplikasi menjalankan cloudflared untuk membuat URL publik gratis. URL otomatis terdeteksi & tampil di panel."),
            ("3. Kelola Akun Admin (Maksimal 3 Akun)",
             "Klik '👤 Akun Admin' untuk menambah atau menghapus administrator TPS. Dibatasi maksimal 3 akun demi keamanan."),
            ("4. Sambungkan HP / Tablet Pemilih",
             "Bagikan 'Network URL' (LAN) atau 'Tunnel URL' (internet publik) ke HP pemilih melalui browser atau scan QR Code."),
            ("5. Cek Perangkat Server",
             "Klik '💻 Cek Perangkat' untuk melihat kondisi RAM, CPU, dan estimasi kapasitas pemilih yang dapat ditangani server ini."),
        ]

        for step_title, step_desc in steps:
            box = QFrame()
            box.setStyleSheet("background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px;")
            b_layout = QVBoxLayout(box)
            st = QLabel(step_title)
            st.setStyleSheet("font-size: 12px; font-weight: bold; color: #059669; border: none;")
            sd = QLabel(step_desc)
            sd.setWordWrap(True)
            sd.setStyleSheet("font-size: 11px; color: #334155; line-height: 1.4; border: none;")
            b_layout.addWidget(st)
            b_layout.addWidget(sd)
            content_layout.addWidget(box)

        scroll.setWidget(content_widget)
        layout.addWidget(scroll)

        btn_close = QPushButton("Tutup Panduan")
        btn_close.setFixedHeight(36)
        btn_close.setStyleSheet("background-color: #0f172a; color: #ffffff; font-weight: bold; border-radius: 8px; font-size: 12px;")
        btn_close.clicked.connect(self.accept)
        layout.addWidget(btn_close)


class AdminManagerDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Kelola Akun Admin")
        self.setFixedSize(420, 520)
        self.setStyleSheet("""
            QDialog { background-color: #f8fafc; color: #0f172a; font-family: system-ui, -apple-system, sans-serif; }
            QLabel  { border: none; background: transparent; }
        """)
        self.admins = load_admins()
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 18, 20, 16)
        layout.setSpacing(10)

        # ── HEADER ──────────────────────────────────────
        hdr_box = QVBoxLayout(); hdr_box.setSpacing(2); hdr_box.setAlignment(Qt.AlignCenter)
        lbl_icon_title = QLabel("👤  Kelola Akun Admin")
        lbl_icon_title.setAlignment(Qt.AlignCenter)
        lbl_icon_title.setStyleSheet("font-size: 17px; font-weight: 800; color: #0f172a;")
        lbl_sub = QLabel("Kelola username dan password akun administrator")
        lbl_sub.setAlignment(Qt.AlignCenter)
        lbl_sub.setStyleSheet("font-size: 11px; color: #94a3b8; font-weight: 400;")
        hdr_box.addWidget(lbl_icon_title); hdr_box.addWidget(lbl_sub)
        layout.addLayout(hdr_box)

        # ── COUNTER BADGE ────────────────────────────────
        badge_frame = QFrame(); badge_frame.setObjectName("BadgeFrame")
        badge_frame.setStyleSheet("QFrame#BadgeFrame { background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 12px; }")
        badge_frame.setFixedWidth(100)
        badge_layout = QVBoxLayout(badge_frame); badge_layout.setContentsMargins(8, 6, 8, 6); badge_layout.setSpacing(0)
        self.lbl_count_num = QLabel("0 / 3")
        self.lbl_count_num.setAlignment(Qt.AlignCenter)
        self.lbl_count_num.setStyleSheet("font-size: 18px; font-weight: 900; color: #2563eb; letter-spacing: 1px;")
        lbl_count_sub = QLabel("AKUN ADMIN")
        lbl_count_sub.setAlignment(Qt.AlignCenter)
        lbl_count_sub.setStyleSheet("font-size: 9px; font-weight: 700; color: #64748b; letter-spacing: 0.5px;")
        badge_layout.addWidget(self.lbl_count_num); badge_layout.addWidget(lbl_count_sub)

        badge_row = QHBoxLayout(); badge_row.setAlignment(Qt.AlignCenter)
        badge_row.addWidget(badge_frame)
        layout.addLayout(badge_row)

        # ── ADMIN LIST (scroll area) ──────────────────────
        scroll = QScrollArea(); scroll.setWidgetResizable(True)
        scroll.setStyleSheet("QScrollArea { border: none; background: transparent; } QScrollBar:vertical { width: 6px; background: #f1f5f9; } QScrollBar::handle:vertical { background: #cbd5e1; border-radius: 3px; }")
        self.list_widget = QWidget(); self.list_widget.setStyleSheet("background: transparent;")
        self.list_layout = QVBoxLayout(self.list_widget)
        self.list_layout.setContentsMargins(0, 0, 0, 0); self.list_layout.setSpacing(8)
        self.list_layout.addStretch(1)
        scroll.setWidget(self.list_widget)
        layout.addWidget(scroll, stretch=1)

        # ── SECURITY WARNING ─────────────────────────────
        warn_frame = QFrame(); warn_frame.setObjectName("WarnFrame")
        warn_frame.setStyleSheet("QFrame#WarnFrame { background-color: #fefce8; border: 1px solid #fde68a; border-radius: 10px; }")
        warn_layout = QVBoxLayout(warn_frame); warn_layout.setContentsMargins(12, 10, 12, 10); warn_layout.setSpacing(3)
        lbl_warn_title = QLabel("⚠  Peringatan Keamanan")
        lbl_warn_title.setAlignment(Qt.AlignCenter)
        lbl_warn_title.setStyleSheet("font-size: 12px; font-weight: 800; color: #d97706;")
        lbl_warn_body = QLabel("Segera Ubah Password Default Akun Admin Demi\nKeamanan Sistem.")
        lbl_warn_body.setAlignment(Qt.AlignCenter)
        lbl_warn_body.setStyleSheet("font-size: 11px; color: #92400e; font-style: italic;")
        warn_layout.addWidget(lbl_warn_title); warn_layout.addWidget(lbl_warn_body)
        layout.addWidget(warn_frame)

        # ── BOTTOM BUTTONS ───────────────────────────────
        btn_row = QHBoxLayout(); btn_row.setSpacing(8)
        btn_close = QPushButton("⚠  Tutup")
        btn_close.setFixedHeight(40); btn_close.setCursor(Qt.PointingHandCursor)
        btn_close.setStyleSheet("QPushButton { background-color: #ef4444; color: #ffffff; font-weight: 700; border-radius: 8px; font-size: 12px; border: none; } QPushButton:hover { background-color: #dc2626; }")
        btn_close.clicked.connect(self.accept)
        btn_add = QPushButton("👤  Tambah Akun Admin")
        btn_add.setFixedHeight(40); btn_add.setCursor(Qt.PointingHandCursor)
        btn_add.setStyleSheet("QPushButton { background-color: #2563eb; color: #ffffff; font-weight: 700; border-radius: 8px; font-size: 12px; border: none; } QPushButton:hover { background-color: #1d4ed8; }")
        btn_add.clicked.connect(self.add_admin)
        btn_row.addWidget(btn_close); btn_row.addWidget(btn_add, stretch=1)
        layout.addLayout(btn_row)

        self.refresh_list()

    def refresh_list(self):
        self.admins = load_admins()
        self.lbl_count_num.setText(f"{len(self.admins)} / 3")

        # Clear old widgets (except the trailing stretch)
        while self.list_layout.count() > 1:
            item = self.list_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        for adm in self.admins:
            card = QFrame(); card.setObjectName("AdminCard")
            card.setStyleSheet("QFrame#AdminCard { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; }")
            c_layout = QVBoxLayout(card); c_layout.setContentsMargins(12, 10, 12, 10); c_layout.setSpacing(4)

            # Top row: username + role badge (Panitia TPS)
            top_row = QHBoxLayout()
            lbl_uname = QLabel(adm.get("username", ""))
            lbl_uname.setStyleSheet("font-size: 14px; font-weight: 800; color: #0f172a;")
            lbl_role = QLabel("PANITIA TPS")
            lbl_role.setStyleSheet("font-size: 9px; font-weight: 800; color: #ffffff; background: #2563eb; border-radius: 4px; padding: 2px 7px;")
            top_row.addWidget(lbl_uname); top_row.addWidget(lbl_role); top_row.addStretch(1)

            # Info password status & Eye Toggle Button
            pwd_text = adm.get("password", "")
            lbl_pwd_info = QLabel(f"Password: {'•' * min(len(pwd_text), 12)}" if pwd_text else "Password: (Kosong)")
            lbl_pwd_info.setStyleSheet("font-size: 11px; color: #475569; font-weight: 700; font-family: 'Consolas', monospace;")

            btn_eye = QPushButton("👁")
            btn_eye.setFixedSize(28, 28)
            btn_eye.setCursor(Qt.PointingHandCursor)
            btn_eye.setToolTip("Lihat / Sembunyikan Password")
            btn_eye.setStyleSheet("QPushButton { background: #f1f5f9; color: #475569; border-radius: 6px; font-size: 13px; border: 1px solid #cbd5e1; } QPushButton:hover { background: #e2e8f0; }")

            def _toggle_pwd(label, button, real_p):
                if button.text() == "👁":
                    label.setText(f"Password: {real_p}" if real_p else "Password: (Kosong)")
                    label.setStyleSheet("font-size: 11px; color: #2563eb; font-weight: 800; font-family: 'Consolas', monospace;")
                    button.setText("🙈")
                else:
                    label.setText(f"Password: {'•' * min(len(real_p), 12)}" if real_p else "Password: (Kosong)")
                    label.setStyleSheet("font-size: 11px; color: #475569; font-weight: 700; font-family: 'Consolas', monospace;")
                    button.setText("👁")

            btn_eye.clicked.connect(lambda _, l=lbl_pwd_info, b=btn_eye, p=pwd_text: _toggle_pwd(l, b, p))

            # Action buttons row
            btn_row = QHBoxLayout(); btn_row.setSpacing(6)
            btn_row.addWidget(lbl_pwd_info)
            btn_row.addWidget(btn_eye)
            btn_row.addStretch(1)
            btn_del = QPushButton("⚠  Hapus")
            btn_del.setFixedHeight(30); btn_del.setCursor(Qt.PointingHandCursor)
            btn_del.setStyleSheet("QPushButton { background: #fee2e2; color: #dc2626; border-radius: 7px; font-size: 11px; font-weight: 700; border: 1px solid #fca5a5; padding: 0 10px; } QPushButton:hover { background: #fecaca; }")
            btn_del.clicked.connect(lambda _, u=adm.get("username"): self.delete_admin(u))
            btn_edit = QPushButton("👤  Edit")
            btn_edit.setFixedHeight(30); btn_edit.setCursor(Qt.PointingHandCursor)
            btn_edit.setStyleSheet("QPushButton { background: #f1f5f9; color: #0f172a; border-radius: 7px; font-size: 11px; font-weight: 700; border: 1px solid #e2e8f0; padding: 0 10px; } QPushButton:hover { background: #e2e8f0; }")
            btn_edit.clicked.connect(lambda _, u=adm.get("username"): self.edit_admin(u))
            btn_row.addWidget(btn_del); btn_row.addWidget(btn_edit)

            c_layout.addLayout(top_row)
            c_layout.addLayout(btn_row)
            self.list_layout.insertWidget(self.list_layout.count() - 1, card)

    def add_admin(self):
        if len(self.admins) >= 3:
            QMessageBox.warning(self, "Batas Akun", "Maksimal 3 akun admin diperbolehkan!")
            return
        dlg = AddAdminDialog(self)
        if dlg.exec() == QDialog.Accepted:
            self.admins.append(dlg.result_data)
            save_admins(self.admins)
            self.refresh_list()
            QMessageBox.information(self, "Berhasil", f"Akun '{dlg.result_data['username']}' berhasil ditambahkan!")

    def edit_admin(self, username):
        adm = next((a for a in self.admins if a["username"] == username), None)
        if not adm:
            return
        dlg = EditAdminDialog(self, adm)
        if dlg.exec() == QDialog.Accepted:
            for i, a in enumerate(self.admins):
                if a["username"] == username:
                    self.admins[i] = dlg.result_data
                    break
            save_admins(self.admins)
            self.refresh_list()
            QMessageBox.information(self, "Berhasil", "Akun admin berhasil diperbarui!")

    def delete_admin(self, username):
        if len(self.admins) <= 1:
            QMessageBox.warning(self, "Proteksi", "Minimal harus ada 1 akun admin aktif!")
            return
        reply = QMessageBox.question(self, "Konfirmasi Hapus", f"Yakin hapus akun '{username}'?", QMessageBox.Yes | QMessageBox.No)
        if reply == QMessageBox.Yes:
            self.admins = [a for a in self.admins if a["username"] != username]
            save_admins(self.admins)
            self.refresh_list()


class AddAdminDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Tambah Akun Admin")
        self.setFixedSize(360, 230)
        self.setStyleSheet("QDialog { background-color: #f8fafc; color: #0f172a; font-family: system-ui; } QLabel { border: none; }")
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self); layout.setContentsMargins(20, 18, 20, 16); layout.setSpacing(10)

        title = QLabel("👤  Tambah Akun Admin Baru")
        title.setStyleSheet("font-size: 14px; font-weight: 800; color: #0f172a;")
        title.setAlignment(Qt.AlignCenter)
        layout.addWidget(title)

        self.txt_u = QLineEdit(); self.txt_u.setPlaceholderText("Username (contoh: admin2)")
        self.txt_u.setFixedHeight(36)
        self.txt_u.setStyleSheet("QLineEdit { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 7px; font-size: 12px; background: #fff; }")
        layout.addWidget(self.txt_u)

        self.txt_p = QLineEdit(); self.txt_p.setPlaceholderText("Password")
        self.txt_p.setEchoMode(QLineEdit.Password); self.txt_p.setFixedHeight(36)
        self.txt_p.setStyleSheet("QLineEdit { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 7px; font-size: 12px; background: #fff; }")
        layout.addWidget(self.txt_p)

        btn_row = QHBoxLayout(); btn_row.setSpacing(8)
        btn_c = QPushButton("Batal"); btn_c.setFixedHeight(36); btn_c.setCursor(Qt.PointingHandCursor)
        btn_c.setStyleSheet("QPushButton { background: #e2e8f0; color: #0f172a; border-radius: 7px; font-weight: 700; border: none; } QPushButton:hover { background: #cbd5e1; }")
        btn_c.clicked.connect(self.reject)
        btn_s = QPushButton("Simpan"); btn_s.setFixedHeight(36); btn_s.setCursor(Qt.PointingHandCursor)
        btn_s.setStyleSheet("QPushButton { background: #2563eb; color: white; border-radius: 7px; font-weight: 700; border: none; } QPushButton:hover { background: #1d4ed8; }")
        btn_s.clicked.connect(self.save)
        btn_row.addWidget(btn_c); btn_row.addWidget(btn_s)
        layout.addLayout(btn_row)

    def save(self):
        u = self.txt_u.text().strip()
        p = self.txt_p.text().strip()
        if not u or not p:
            QMessageBox.warning(self, "Peringatan", "Harap isi Username & Password!")
            return
        self.result_data = {"username": u, "password": p, "created_at": time.strftime("%Y-%m-%d")}
        self.accept()


class EditAdminDialog(QDialog):
    def __init__(self, parent=None, admin_data=None):
        super().__init__(parent)
        self.admin_data = admin_data or {}
        self.setWindowTitle("Edit Akun Admin")
        self.setFixedSize(360, 250)
        self.setStyleSheet("QDialog { background-color: #f8fafc; color: #0f172a; font-family: system-ui; } QLabel { border: none; }")
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self); layout.setContentsMargins(20, 18, 20, 16); layout.setSpacing(10)

        title = QLabel("👤  Edit Akun Admin")
        title.setStyleSheet("font-size: 14px; font-weight: 800; color: #0f172a;")
        title.setAlignment(Qt.AlignCenter)
        layout.addWidget(title)

        self.txt_u = QLineEdit(self.admin_data.get("username", ""))
        self.txt_u.setFixedHeight(36)
        self.txt_u.setStyleSheet("QLineEdit { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 7px; font-size: 12px; background: #fff; }")
        layout.addWidget(self.txt_u)

        self.txt_p = QLineEdit(); self.txt_p.setPlaceholderText("Password baru (kosongkan jika tidak diubah)")
        self.txt_p.setEchoMode(QLineEdit.Password); self.txt_p.setFixedHeight(36)
        self.txt_p.setStyleSheet("QLineEdit { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 7px; font-size: 12px; background: #fff; }")
        layout.addWidget(self.txt_p)

        self.txt_p2 = QLineEdit(); self.txt_p2.setPlaceholderText("Konfirmasi password baru")
        self.txt_p2.setEchoMode(QLineEdit.Password); self.txt_p2.setFixedHeight(36)
        self.txt_p2.setStyleSheet("QLineEdit { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 7px; font-size: 12px; background: #fff; }")
        layout.addWidget(self.txt_p2)

        btn_row = QHBoxLayout(); btn_row.setSpacing(8)
        btn_c = QPushButton("Batal"); btn_c.setFixedHeight(36); btn_c.setCursor(Qt.PointingHandCursor)
        btn_c.setStyleSheet("QPushButton { background: #e2e8f0; color: #0f172a; border-radius: 7px; font-weight: 700; border: none; } QPushButton:hover { background: #cbd5e1; }")
        btn_c.clicked.connect(self.reject)
        btn_s = QPushButton("Simpan Perubahan"); btn_s.setFixedHeight(36); btn_s.setCursor(Qt.PointingHandCursor)
        btn_s.setStyleSheet("QPushButton { background: #2563eb; color: white; border-radius: 7px; font-weight: 700; border: none; } QPushButton:hover { background: #1d4ed8; }")
        btn_s.clicked.connect(self.save)
        btn_row.addWidget(btn_c); btn_row.addWidget(btn_s)
        layout.addLayout(btn_row)

    def save(self):
        u = self.txt_u.text().strip()
        p = self.txt_p.text().strip()
        p2 = self.txt_p2.text().strip()
        if not u:
            QMessageBox.warning(self, "Peringatan", "Username tidak boleh kosong!")
            return
        if p and p != p2:
            QMessageBox.warning(self, "Peringatan", "Konfirmasi password tidak cocok!")
            return
        data = dict(self.admin_data)
        data["username"] = u
        if p:
            data["password"] = p
        self.result_data = data
        self.accept()






# ==========================================
# 3. DIALOG DIAGNOSTIK PERANGKAT & KAPASITAS TPS
# ==========================================
class HardwareCheckDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Diagnostik Perangkat & Kapasitas TPS")
        self.setFixedSize(520, 530)
        self.setStyleSheet("background-color: #ffffff; color: #0f172a; font-family: system-ui, -apple-system, sans-serif;")
        self.init_ui()

    def get_hardware_specs(self):
        import multiprocessing, platform, ctypes
        cpu_cores = multiprocessing.cpu_count()
        arch = platform.machine()
        total_ram = 8.0; free_ram = 3.5; used_ram = 4.5; percent_used = 56
        try:
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ('dwLength', ctypes.c_ulong), ('dwMemoryLoad', ctypes.c_ulong),
                    ('ullTotalPhys', ctypes.c_ulonglong), ('ullAvailPhys', ctypes.c_ulonglong),
                    ('ullTotalPageFile', ctypes.c_ulonglong), ('ullAvailPageFile', ctypes.c_ulonglong),
                    ('ullTotalVirtual', ctypes.c_ulonglong), ('ullAvailVirtual', ctypes.c_ulonglong),
                    ('sExtendedMemory', ctypes.c_ulonglong),
                ]
            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
            total_ram = stat.ullTotalPhys / (1024 ** 3)
            free_ram  = stat.ullAvailPhys / (1024 ** 3)
            used_ram  = total_ram - free_ram
            percent_used = int(stat.dwMemoryLoad)
        except Exception:
            pass
        max_v = int(free_ram * 120); safe_v = int(free_ram * 85)
        return {
            "cpu_cores": f"{cpu_cores} Core ({arch})",
            "total_ram": f"{total_ram:.2f} GB",
            "free_ram":  f"{free_ram:.2f} GB",
            "used_ram":  f"{used_ram:.2f} GB ({percent_used}%)",
            "safe_voters": f"10 - {max(50, safe_v)} Pemilih",
            "max_voters":  f"~{max(80, max_v)} Pemilih",
            "is_limited": free_ram < 2.0
        }

    def init_ui(self):
        specs = self.get_hardware_specs()
        layout = QVBoxLayout(self)
        layout.setContentsMargins(18, 16, 18, 16)
        layout.setSpacing(12)

        hdr = QHBoxLayout()
        lbl_title = QLabel("💻 Diagnostik Perangkat & Kapasitas TPS")
        lbl_title.setStyleSheet("font-size: 15px; font-weight: 800; color: #0f172a; border: none;")
        hdr.addStretch(1); hdr.addWidget(lbl_title); hdr.addStretch(1)
        layout.addLayout(hdr)

        # Card HARDWARE
        card_hw = QFrame(); card_hw.setObjectName("CardHw")
        card_hw.setStyleSheet("QFrame#CardHw { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; }")
        hw_layout = QVBoxLayout(card_hw); hw_layout.setContentsMargins(12, 10, 12, 10); hw_layout.setSpacing(6)
        lbl_hw_head = QLabel("🗄️ SPESIFIKASI HARDWARE")
        lbl_hw_head.setStyleSheet("font-size: 11px; font-weight: 800; color: #0f172a; border: none;")
        hw_layout.addWidget(lbl_hw_head)
        rows = [("Total RAM", specs["total_ram"], "#0f172a"), ("RAM Idle (Bebas)", specs["free_ram"], "#059669"),
                ("RAM Terpakai", specs["used_ram"], "#0f172a"), ("Jumlah Core CPU", specs["cpu_cores"], "#0f172a")]
        for label, val, color in rows:
            r = QHBoxLayout()
            lbl_l = QLabel(label); lbl_l.setStyleSheet("font-size: 11px; color: #64748b; font-weight: 600; border: none;")
            lbl_v = QLabel(val);   lbl_v.setStyleSheet(f"font-size: 11px; color: {color}; font-weight: 800; border: none;")
            r.addWidget(lbl_l); r.addStretch(1); r.addWidget(lbl_v)
            ln = QFrame(); ln.setFrameShape(QFrame.HLine); ln.setStyleSheet("background-color: #f1f5f9; border: none;")
            hw_layout.addLayout(r); hw_layout.addWidget(ln)
        layout.addWidget(card_hw)

        # Card KAPASITAS
        card_cap = QFrame(); card_cap.setObjectName("CardCap")
        card_cap.setStyleSheet("QFrame#CardCap { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; }")
        cap_layout = QVBoxLayout(card_cap); cap_layout.setContentsMargins(12, 10, 12, 10); cap_layout.setSpacing(6)
        lbl_cap_head = QLabel("⚡ ESTIMASI KAPASITAS PEMILIH")
        lbl_cap_head.setStyleSheet("font-size: 11px; font-weight: 800; color: #0f172a; border: none;")
        cap_layout.addWidget(lbl_cap_head)

        r_safe = QHBoxLayout()
        lbl_s_t = QLabel("Pemilih Ter-handle (Sesi Aman)"); lbl_s_t.setStyleSheet("font-size: 11px; color: #64748b; font-weight: 600; border: none;")
        lbl_s_v = QLabel(specs["safe_voters"]); lbl_s_v.setStyleSheet("font-size: 11px; color: #2563eb; font-weight: 800; border: none;")
        r_safe.addWidget(lbl_s_t); r_safe.addStretch(1); r_safe.addWidget(lbl_s_v)
        cap_layout.addLayout(r_safe)

        ln2 = QFrame(); ln2.setFrameShape(QFrame.HLine); ln2.setStyleSheet("background-color: #f1f5f9; border: none;")
        cap_layout.addWidget(ln2)

        r_max = QHBoxLayout()
        lbl_m_t = QLabel("Kapasitas Maksimum (Max Pemilih)"); lbl_m_t.setStyleSheet("font-size: 11px; color: #64748b; font-weight: 600; border: none;")
        lbl_m_v = QLabel(specs["max_voters"]); lbl_m_v.setStyleSheet("font-size: 11px; color: #0f172a; font-weight: 800; border: none;")
        r_max.addWidget(lbl_m_t); r_max.addStretch(1); r_max.addWidget(lbl_m_v)
        cap_layout.addLayout(r_max)

        status_box = QLabel("Status: Terbatas (Disarankan Pemilihan Sesi Bertahap)" if specs["is_limited"] else "Status: Optimal (Siap Digunakan Perhitungan TPS)")
        status_box.setAlignment(Qt.AlignCenter); status_box.setFixedHeight(30)
        status_box.setStyleSheet("QLabel { background-color: #fff7ed; border: 1px solid #fed7aa; color: #c2410c; font-size: 11px; font-weight: 800; border-radius: 6px; }")
        cap_layout.addWidget(status_box)
        layout.addWidget(card_cap)

        # Tips Banner
        card_tips = QFrame(); card_tips.setObjectName("CardTips")
        card_tips.setStyleSheet("QFrame#CardTips { background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; }")
        t_layout = QHBoxLayout(card_tips); t_layout.setContentsMargins(8, 8, 8, 8)
        lbl_tips = QLabel("ⓘ <b>Tips:</b> Tutup aplikasi lain (Browser/Game) lalu Muat Ulang untuk mengosongkan RAM & memperbanyak kapasitas pemilih.")
        lbl_tips.setWordWrap(True); lbl_tips.setAlignment(Qt.AlignCenter)
        lbl_tips.setStyleSheet("font-size: 10px; color: #1e40af; border: none; background: transparent;")
        t_layout.addWidget(lbl_tips); layout.addWidget(card_tips)

        # Buttons
        btn_box = QHBoxLayout(); btn_box.setSpacing(10)
        btn_refresh = QPushButton("🔄 Muat Ulang"); btn_refresh.setFixedHeight(40); btn_refresh.setCursor(Qt.PointingHandCursor)
        btn_refresh.setStyleSheet("QPushButton { background-color: #10b981; color: #ffffff; font-weight: bold; border-radius: 8px; font-size: 12px; border: none; } QPushButton:hover { background-color: #059669; }")
        btn_refresh.clicked.connect(self.reload_dialog)
        btn_close = QPushButton("Tutup"); btn_close.setFixedHeight(40); btn_close.setCursor(Qt.PointingHandCursor)
        btn_close.setStyleSheet("QPushButton { background-color: #f87171; color: #ffffff; font-weight: bold; border-radius: 8px; font-size: 12px; border: none; } QPushButton:hover { background-color: #ef4444; }")
        btn_close.clicked.connect(self.accept)
        btn_box.addWidget(btn_refresh, stretch=1); btn_box.addWidget(btn_close, stretch=1)
        layout.addLayout(btn_box)

    def reload_dialog(self):
        self.close()
        HardwareCheckDialog(self.parent()).exec()


# ==========================================
# 4. MAIN WINDOW — REAL NGINX + CLOUDFLARED
# ==========================================
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("TPS-DIGITAL Web Server Control")
        self.setFixedSize(540, 450)
        self.setStyleSheet("background-color: #f1f5f9; color: #0f172a; font-family: system-ui, -apple-system, sans-serif;")

        self.is_server_running  = False
        self.is_tunnel_running  = False
        self._nginx_proc        = None
        self._nextjs_proc       = None
        self._pg_proc           = None
        self._tunnel_proc       = None
        self._tunnel_thread     = None

        self.local_ip   = get_local_ip()
        self.local_url  = f"http://{self.local_ip}"
        self.tunnel_url = ""

        self.signals = WorkerSignals()
        self.signals.tunnel_url_found.connect(self._on_tunnel_url_found)
        self.signals.tunnel_stopped.connect(self._on_tunnel_stopped)
        self.signals.server_ready.connect(self._on_server_ready)

        self.init_ui()

    # --------------------------------------------------
    # UI BUILD
    # --------------------------------------------------
    def init_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        main_layout = QVBoxLayout(central)
        main_layout.setContentsMargins(12, 10, 12, 10)
        main_layout.setSpacing(8)

        # ── HEADER ──────────────────────────────────────
        hdr_frame = QFrame()
        hdr_frame.setObjectName("HdrFrame")
        hdr_frame.setStyleSheet("QFrame#HdrFrame { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; }")
        hdr = QHBoxLayout(hdr_frame)
        hdr.setContentsMargins(10, 8, 10, 8)
        hdr.setSpacing(10)

        lbl_logo = QLabel()
        lbl_logo.setFixedSize(36, 36)
        lbl_logo.setStyleSheet("border: none; background: transparent;")
        if os.path.exists(LOGO_IMG):
            pix = QPixmap(LOGO_IMG).scaled(36, 36, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            lbl_logo.setPixmap(pix)
        else:
            lbl_logo.setText("🗳️")
            lbl_logo.setStyleSheet("font-size: 22px; border: none;")

        t_box = QVBoxLayout(); t_box.setSpacing(0)
        lbl_app_name = QLabel("TPS-DIGITAL WEB SERVER")
        lbl_app_name.setStyleSheet("font-size: 14px; font-weight: 900; color: #0f172a; border: none; padding: 0; margin: 0;")
        lbl_ver = QLabel("Nginx + Cloudflare Tunnel  •  v1.0.0")
        lbl_ver.setStyleSheet("font-size: 10px; color: #94a3b8; font-weight: 500; border: none; padding: 0; margin: 0;")
        t_box.addWidget(lbl_app_name); t_box.addWidget(lbl_ver)

        # Inline status pills (horizontal, right-aligned)
        pills_box = QHBoxLayout(); pills_box.setSpacing(6); pills_box.setContentsMargins(0, 0, 0, 0)
        self.pill_server = QLabel("● Stopped")
        self.pill_server.setAlignment(Qt.AlignCenter)
        self.pill_server.setStyleSheet("QLabel { background-color: #fee2e2; color: #dc2626; font-size: 10px; font-weight: 800; padding: 3px 10px; border-radius: 8px; border: none; }")
        self.pill_tunnel = QLabel("● Tunnel Off")
        self.pill_tunnel.setAlignment(Qt.AlignCenter)
        self.pill_tunnel.setStyleSheet("QLabel { background-color: #f1f5f9; color: #94a3b8; font-size: 10px; font-weight: 800; padding: 3px 10px; border-radius: 8px; border: none; }")
        pills_box.addWidget(self.pill_server); pills_box.addWidget(self.pill_tunnel)

        hdr.addWidget(lbl_logo)
        hdr.addLayout(t_box)
        hdr.addStretch(1)
        hdr.addLayout(pills_box)
        main_layout.addWidget(hdr_frame)

        # ── DETIL KONEKSI ──────────────────────────────
        card_conn = QFrame(); card_conn.setObjectName("CardConn")
        card_conn.setStyleSheet("QFrame#CardConn { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; }")
        cc = QVBoxLayout(card_conn); cc.setContentsMargins(10, 8, 10, 8); cc.setSpacing(6)

        lbl_conn_title = QLabel("🌐  DETIL KONEKSI")
        lbl_conn_title.setStyleSheet("font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 0.5px; border: none; background: transparent;")
        cc.addWidget(lbl_conn_title)

        # Divider
        div0 = QFrame(); div0.setFrameShape(QFrame.HLine); div0.setStyleSheet("background: #f1f5f9; border: none; max-height: 1px;")
        cc.addWidget(div0)

        # Network URL row
        r1 = QHBoxLayout(); r1.setSpacing(6)
        lbl_net_label = QLabel("LAN")
        lbl_net_label.setFixedWidth(36)
        lbl_net_label.setStyleSheet("font-size: 10px; font-weight: 800; color: #ffffff; background: #059669; border-radius: 4px; padding: 2px 4px; border: none;")
        lbl_net_label.setAlignment(Qt.AlignCenter)
        self.lbl_net_url = QLabel("—")
        self.lbl_net_url.setStyleSheet("font-size: 11px; color: #475569; font-weight: 600; border: none; background: transparent;")
        self.btn_open_net = self._make_url_btn("Buka", False)
        self.btn_open_net.clicked.connect(lambda: QDesktopServices.openUrl(QUrl(self.local_url)))
        self.btn_copy_net = self._make_copy_btn(False)
        self.btn_copy_net.clicked.connect(lambda: self.copy_url(self.local_url, "Network URL"))
        r1.addWidget(lbl_net_label); r1.addWidget(self.lbl_net_url, stretch=1)
        r1.addWidget(self.btn_open_net); r1.addWidget(self.btn_copy_net)
        cc.addLayout(r1)

        # Tunnel URL row
        r2 = QHBoxLayout(); r2.setSpacing(6)
        lbl_tun_label = QLabel("WAN")
        lbl_tun_label.setFixedWidth(36)
        lbl_tun_label.setStyleSheet("font-size: 10px; font-weight: 800; color: #ffffff; background: #2563eb; border-radius: 4px; padding: 2px 4px; border: none;")
        lbl_tun_label.setAlignment(Qt.AlignCenter)
        self.lbl_tun_url = QLabel("—")
        self.lbl_tun_url.setStyleSheet("font-size: 11px; color: #475569; font-weight: 600; border: none; background: transparent;")
        self.btn_open_tun = self._make_url_btn("Buka", False)
        self.btn_open_tun.clicked.connect(lambda: QDesktopServices.openUrl(QUrl(self.tunnel_url)))
        self.btn_copy_tun = self._make_copy_btn(False)
        self.btn_copy_tun.clicked.connect(lambda: self.copy_url(self.tunnel_url, "Tunnel URL"))
        r2.addWidget(lbl_tun_label); r2.addWidget(self.lbl_tun_url, stretch=1)
        r2.addWidget(self.btn_open_tun); r2.addWidget(self.btn_copy_tun)
        cc.addLayout(r2)

        main_layout.addWidget(card_conn)

        # ── LOG BOX ──────────────────────────────────────
        card_log = QFrame(); card_log.setObjectName("CardLog")
        card_log.setStyleSheet("QFrame#CardLog { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; }")
        cl = QVBoxLayout(card_log); cl.setContentsMargins(10, 6, 10, 6); cl.setSpacing(3)
        lbl_log_title = QLabel("📋  LOG AKTIVITAS")
        lbl_log_title.setStyleSheet("font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 0.5px; border: none;")
        cl.addWidget(lbl_log_title)
        self.log_box = QTextEdit()
        self.log_box.setReadOnly(True)
        self.log_box.setFixedHeight(52)
        self.log_box.setStyleSheet("background: transparent; border: none; font-size: 10px; color: #475569; font-family: 'Consolas', monospace; padding: 0;")
        cl.addWidget(self.log_box)
        main_layout.addWidget(card_log)

        # ── KONTROL UTAMA ──────────────────────────────
        card_ctrl = QFrame(); card_ctrl.setObjectName("CardCtrl")
        card_ctrl.setStyleSheet("QFrame#CardCtrl { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; }")
        cx = QVBoxLayout(card_ctrl); cx.setContentsMargins(10, 8, 10, 8); cx.setSpacing(7)

        lbl_ctrl_title = QLabel("⚡  KONTROL UTAMA")
        lbl_ctrl_title.setStyleSheet("font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 0.5px; border: none; background: transparent;")
        cx.addWidget(lbl_ctrl_title)

        row1 = QHBoxLayout(); row1.setSpacing(7)
        self.btn_start_server = QPushButton("▶  Start Server")
        self.btn_start_server.setFixedHeight(34); self.btn_start_server.setCursor(Qt.PointingHandCursor)
        self.btn_start_server.setStyleSheet("QPushButton { background-color: #059669; color: #ffffff; font-weight: 700; border-radius: 7px; font-size: 12px; border: none; } QPushButton:hover { background-color: #047857; }")
        self.btn_start_server.clicked.connect(self.toggle_server)

        self.btn_start_tunnel = QPushButton("⚡  Start Tunnel")
        self.btn_start_tunnel.setFixedHeight(34)
        self.btn_start_tunnel.clicked.connect(self.toggle_tunnel)
        self._style_tunnel_btn(False)

        row1.addWidget(self.btn_start_server); row1.addWidget(self.btn_start_tunnel)
        cx.addLayout(row1)

        row2 = QHBoxLayout(); row2.setSpacing(7)
        btn_hw = QPushButton("💻  Cek Perangkat")
        btn_hw.setFixedHeight(30); btn_hw.setCursor(Qt.PointingHandCursor)
        btn_hw.setStyleSheet("QPushButton { background-color: #f59e0b; color: #ffffff; font-weight: 700; border-radius: 7px; font-size: 11px; border: none; } QPushButton:hover { background-color: #d97706; }")
        btn_hw.clicked.connect(self.check_hardware)

        btn_admin = QPushButton("👤  Akun Admin")
        btn_admin.setFixedHeight(30); btn_admin.setCursor(Qt.PointingHandCursor)
        btn_admin.setStyleSheet("QPushButton { background-color: #10b981; color: #ffffff; font-weight: 700; border-radius: 7px; font-size: 11px; border: none; } QPushButton:hover { background-color: #059669; }")
        btn_admin.clicked.connect(self.manage_admins)

        btn_panduan = QPushButton("📘  Panduan")
        btn_panduan.setFixedHeight(30); btn_panduan.setCursor(Qt.PointingHandCursor)
        btn_panduan.setStyleSheet("QPushButton { background-color: #6366f1; color: #ffffff; font-weight: 700; border-radius: 7px; font-size: 11px; border: none; } QPushButton:hover { background-color: #4f46e5; }")
        btn_panduan.clicked.connect(self.show_guide)

        row2.addWidget(btn_hw); row2.addWidget(btn_admin); row2.addWidget(btn_panduan)
        cx.addLayout(row2)
        main_layout.addWidget(card_ctrl)

        # ── FOOTER ─────────────────────────────────────
        footer_box = QHBoxLayout(); footer_box.setSpacing(4); footer_box.setAlignment(Qt.AlignCenter)
        lbl_c = QLabel("© 2026 TPS-DIGITAL  •")
        lbl_c.setStyleSheet("font-size: 10px; color: #94a3b8; border: none;")
        lbl_p = QLabel('Powered by <a href="https://pancakalabs.my.id" style="color:#2563eb; font-weight:bold; text-decoration:none;">PancakaLabs</a>')
        lbl_p.setStyleSheet("font-size: 10px; color: #64748b; border: none;")
        lbl_p.setOpenExternalLinks(True)
        footer_box.addStretch(1); footer_box.addWidget(lbl_c); footer_box.addWidget(lbl_p); footer_box.addStretch(1)
        main_layout.addLayout(footer_box)

    # --------------------------------------------------
    # HELPER: build small URL action buttons
    # --------------------------------------------------
    def _make_url_btn(self, label, enabled):
        btn = QPushButton(label)
        btn.setFixedHeight(30); btn.setCursor(Qt.PointingHandCursor); btn.setEnabled(enabled)
        self._style_url_btn(btn, enabled)
        return btn

    def _make_copy_btn(self, enabled):
        btn = QPushButton("📋")
        btn.setFixedHeight(30); btn.setFixedWidth(34); btn.setCursor(Qt.PointingHandCursor); btn.setEnabled(enabled)
        self._style_copy_btn(btn, enabled)
        return btn

    def _style_url_btn(self, btn, enabled):
        if enabled:
            btn.setStyleSheet("QPushButton { background-color: #0f172a; color: #ffffff; font-weight: bold; border-radius: 6px; padding: 0 8px; font-size: 11px; border: none; } QPushButton:hover { background-color: #1e293b; }")
        else:
            btn.setStyleSheet("QPushButton { background-color: #f1f5f9; color: #94a3b8; font-weight: bold; border-radius: 6px; padding: 0 8px; font-size: 11px; border: 1px solid #e2e8f0; }")

    def _style_copy_btn(self, btn, enabled):
        if enabled:
            btn.setStyleSheet("QPushButton { background-color: #e2e8f0; color: #0f172a; font-weight: bold; border-radius: 6px; font-size: 11px; border: none; } QPushButton:hover { background-color: #cbd5e1; }")
        else:
            btn.setStyleSheet("QPushButton { background-color: #f1f5f9; color: #94a3b8; font-weight: bold; border-radius: 6px; font-size: 11px; border: 1px solid #e2e8f0; }")

    def _style_tunnel_btn(self, enabled):
        self.btn_start_tunnel.setEnabled(enabled)
        if enabled:
            self.btn_start_tunnel.setCursor(Qt.PointingHandCursor)
            self.btn_start_tunnel.setStyleSheet("QPushButton { background-color: #2563eb; color: #ffffff; font-weight: 700; border-radius: 7px; font-size: 12px; border: none; } QPushButton:hover { background-color: #1d4ed8; }")
        else:
            self.btn_start_tunnel.setCursor(Qt.ForbiddenCursor)
            self.btn_start_tunnel.setStyleSheet("QPushButton { background-color: #f1f5f9; color: #94a3b8; font-weight: 700; border-radius: 7px; font-size: 12px; border: 1px solid #e2e8f0; }")

    # --------------------------------------------------
    # LOG HELPER
    # --------------------------------------------------
    def log(self, msg):
        ts = time.strftime("%H:%M:%S")
        self.log_box.append(f"[{ts}] {msg}")
        self.log_box.verticalScrollBar().setValue(self.log_box.verticalScrollBar().maximum())

    # --------------------------------------------------
    # SERVER CONTROL — REAL NGINX
    # --------------------------------------------------
    def toggle_server(self):
        if not self.is_server_running:
            self._start_nginx()
        else:
            self._stop_nginx()

    def _start_nginx(self):
        if not os.path.exists(NGINX_EXE):
            QMessageBox.critical(self, "Nginx Tidak Ditemukan", f"File nginx.exe tidak ditemukan:\n{NGINX_EXE}")
            return

        # Disable button while starting
        self.btn_start_server.setText("⏳  Memulai...")
        self.btn_start_server.setEnabled(False)

        def _do_start():
            try:
                # 0. Force-kill semua nginx.exe dan node.exe lama yang ter-cache
                self.log("Membersihkan proses nginx & node.exe lama...")
                try:
                    subprocess.run(
                        ["taskkill", "/F", "/IM", "nginx.exe"],
                        creationflags=subprocess.CREATE_NO_WINDOW,
                        timeout=5, capture_output=True
                    )
                    subprocess.run(
                        ["taskkill", "/F", "/IM", "node.exe"],
                        creationflags=subprocess.CREATE_NO_WINDOW,
                        timeout=5, capture_output=True
                    )
                    time.sleep(1)
                except Exception:
                    pass

                # 0.5. Otomatis Mulai PostgreSQL Server Portable (Port 5432) jika belum berjalan
                pgsql_dir = os.path.join(BASE_DIR, "pgsql")
                pgsql_bin = os.path.join(pgsql_dir, "bin")
                pgsql_data = os.path.join(pgsql_dir, "data")
                postgres_exe = os.path.join(pgsql_bin, "postgres.exe")
                initdb_exe = os.path.join(pgsql_bin, "initdb.exe")

                # Cek apakah port 5432 sudah aktif
                pg_ready = False
                try:
                    with socket.create_connection(("127.0.0.1", 5432), timeout=1):
                        pg_ready = True
                except OSError:
                    pg_ready = False

                if pg_ready:
                    self.log("✓ PostgreSQL Server sudah aktif di port 5432.")
                else:
                    self.log("Memulai PostgreSQL Portable Server (Port 5432)...")
                    if os.path.exists(postgres_exe):
                        # Inisialisasi data directory jika belum ada
                        if not os.path.exists(os.path.join(pgsql_data, "PG_VERSION")):
                            self.log("Menginisialisasi Kluster Data PostgreSQL...")
                            try:
                                subprocess.run(
                                    [initdb_exe, "-U", "postgres", "-A", "trust", "-E", "UTF8", pgsql_data],
                                    creationflags=subprocess.CREATE_NO_WINDOW,
                                    timeout=30
                                )
                            except Exception as init_err:
                                self.log(f"⚠ Initdb error: {init_err}")

                        # Jalankan postgres.exe di background
                        try:
                            self._pg_proc = subprocess.Popen(
                                [postgres_exe, "-D", pgsql_data, "-p", "5432", "-h", "127.0.0.1"],
                                cwd=pgsql_dir,
                                stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL,
                                creationflags=subprocess.CREATE_NO_WINDOW
                            )
                            # Tunggu hingga 10 detik sampai port 5432 aktif
                            for _ in range(10):
                                time.sleep(1)
                                try:
                                    with socket.create_connection(("127.0.0.1", 5432), timeout=1):
                                        pg_ready = True
                                        break
                                except OSError:
                                    pass
                            if pg_ready:
                                self.log("✓ PostgreSQL Portable Server berhasil diaktifkan!")
                            else:
                                self.log("⚠ PostgreSQL Server dimulai tetapi belum merespons di port 5432.")
                        except Exception as pg_err:
                            self.log(f"⚠ Gagal menjalankan postgres.exe: {pg_err}")
                    else:
                        self.log("⚠ Executable postgres.exe tidak ditemukan di folder pgsql.")

                # 1. Jalankan Next.js production server (npm run start)
                self.log("Memulai Next.js production server...")
                self._nextjs_proc = subprocess.Popen(
                    "npm run start",
                    cwd=BASE_DIR,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    creationflags=subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP,
                    shell=True
                )
                self.log(f"Next.js starting (PID {self._nextjs_proc.pid})...")

                # 2. Tunggu sampai port 3000 siap (maks 30 detik)
                self.log("Menunggu Next.js siap di port 3000...")
                ready = False
                for i in range(30):
                    time.sleep(1)
                    try:
                        with socket.create_connection(("127.0.0.1", NEXTJS_PORT), timeout=1):
                            ready = True
                            break
                    except OSError:
                        pass
                    self.log(f"  ... menunggu ({i+1}s)")

                if not ready:
                    self.log("⚠ Next.js tidak merespons dalam 30 detik.")
                else:
                    self.log("✓ Next.js siap di port 3000!")

                # 3. Test config nginx sebelum start
                result = subprocess.run(
                    [NGINX_EXE, "-t"],
                    cwd=NGINX_DIR,
                    capture_output=True, text=True,
                    creationflags=subprocess.CREATE_NO_WINDOW,
                    timeout=5
                )
                if result.returncode != 0:
                    err = (result.stderr or result.stdout or "").strip()
                    self.log(f"⚠ nginx config error: {err}")
                else:
                    self.log("✓ Nginx config OK.")

                # 4. Start nginx
                self._nginx_proc = subprocess.Popen(
                    [NGINX_EXE],
                    cwd=NGINX_DIR,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    creationflags=subprocess.CREATE_NO_WINDOW
                )
                time.sleep(1)

                # 5. Baca error log nginx untuk konfirmasi
                nginx_err_log = os.path.join(NGINX_DIR, "logs", "error.log")
                if os.path.exists(nginx_err_log):
                    try:
                        with open(nginx_err_log, "r", errors="replace") as f:
                            lines = f.readlines()
                        # Ambil 3 baris terakhir
                        recent = [l.strip() for l in lines[-3:] if l.strip()]
                        for l in recent:
                            if "error" in l.lower() or "warn" in l.lower():
                                self.log(f"nginx: {l}")
                    except Exception:
                        pass

                self.log(f"Nginx started (PID {self._nginx_proc.pid}). Port 80 → {NEXTJS_PORT}.")

                # Update UI via signal (thread-safe)
                self.signals.server_ready.emit()

            except Exception as e:
                self.log(f"ERROR: {e}")
                self.signals.tunnel_stopped.emit()

        # Jalankan di background thread agar UI tidak freeze
        t = threading.Thread(target=_do_start, daemon=True)
        t.start()



    def _stop_nginx(self):
        # Stop Next.js production server & clean background node processes
        try:
            subprocess.run(
                ["taskkill", "/F", "/IM", "node.exe"],
                creationflags=subprocess.CREATE_NO_WINDOW, timeout=5
            )
        except Exception:
            pass

        if self._nextjs_proc:
            try:
                self._nextjs_proc.terminate()
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(self._nextjs_proc.pid)],
                    creationflags=subprocess.CREATE_NO_WINDOW, timeout=5
                )
            except Exception:
                pass
            self._nextjs_proc = None
            self.log("Next.js server stopped.")

        # Stop Nginx
        try:
            subprocess.run([NGINX_EXE, "-s", "stop"], cwd=NGINX_DIR,
                           creationflags=subprocess.CREATE_NO_WINDOW, timeout=5)
        except Exception:
            pass
        if self._nginx_proc:
            try: self._nginx_proc.terminate()
            except Exception: pass
            self._nginx_proc = None
        # Hentikan tunnel secara otomatis jika sedang berjalan
        if self.is_tunnel_running or self._tunnel_proc:
            self._stop_tunnel()

        self.log("Nginx stopped.")
        self.is_server_running = False
        self.pill_server.setText("● Stopped")
        self.pill_server.setStyleSheet("QLabel { background-color: #fee2e2; color: #dc2626; font-size: 10px; font-weight: 800; padding: 3px 10px; border-radius: 8px; border: none; }")
        self.lbl_net_url.setText("—")
        self.lbl_net_url.setStyleSheet("font-size: 11px; color: #475569; font-weight: 600; border: none;")
        self.btn_open_net.setEnabled(False); self._style_url_btn(self.btn_open_net, False)
        self.btn_copy_net.setEnabled(False); self._style_copy_btn(self.btn_copy_net, False)
        self._style_tunnel_btn(False)
        self.btn_start_server.setText("▶  Start Server")
        self.btn_start_server.setStyleSheet("QPushButton { background-color: #059669; color: #ffffff; font-weight: 700; border-radius: 7px; font-size: 12px; border: none; } QPushButton:hover { background-color: #047857; }")

    # --------------------------------------------------
    # TUNNEL CONTROL — REAL CLOUDFLARED
    # --------------------------------------------------
    def toggle_tunnel(self):
        if not self.is_tunnel_running:
            self._start_tunnel()
        else:
            self._stop_tunnel()

    def _start_tunnel(self):
        if not os.path.exists(CLOUDFLARED_EXE):
            QMessageBox.critical(self, "Cloudflared Tidak Ditemukan", f"File cloudflared-windows-amd64.exe tidak ditemukan:\n{CLOUDFLARED_EXE}")
            return

        self.btn_start_tunnel.setText("⏳  Menghubungkan...")
        self.btn_start_tunnel.setEnabled(False)
        self.log("Memulai Cloudflare Tunnel ke port 80...")

        def run_tunnel():
            try:
                self._tunnel_proc = subprocess.Popen(
                    [CLOUDFLARED_EXE, "tunnel", "--url", f"http://localhost:{NGINX_PORT}"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    creationflags=subprocess.CREATE_NO_WINDOW,
                    text=True,
                    bufsize=1
                )
                # Parse output until we find the trycloudflare.com URL
                for line in self._tunnel_proc.stdout:
                    line = line.strip()
                    # Look for the public URL in the output
                    match = re.search(r'https://[\w\-]+\.trycloudflare\.com', line)
                    if match:
                        url = match.group(0)
                        self.signals.tunnel_url_found.emit(url)
                self.signals.tunnel_stopped.emit()
            except Exception as e:
                self.signals.tunnel_stopped.emit()

        self._tunnel_thread = threading.Thread(target=run_tunnel, daemon=True)
        self._tunnel_thread.start()

    def _on_server_ready(self):
        """Dipanggil dari background thread saat nginx + Next.js siap."""
        self.is_server_running = True
        self.pill_server.setText("● Running")
        self.pill_server.setStyleSheet("QLabel { background-color: #dcfce7; color: #15803d; font-size: 10px; font-weight: 800; padding: 3px 10px; border-radius: 8px; border: none; }")

        self.lbl_net_url.setText(self.local_url)
        self.lbl_net_url.setStyleSheet("font-size: 11px; color: #059669; font-weight: 800; font-family: 'Consolas', monospace; border: none;")
        self.btn_open_net.setEnabled(True); self._style_url_btn(self.btn_open_net, True)
        self.btn_copy_net.setEnabled(True); self._style_copy_btn(self.btn_copy_net, True)

        self.btn_start_server.setEnabled(True)
        self.btn_start_server.setText("⏹  Stop Server")
        self.btn_start_server.setStyleSheet("QPushButton { background-color: #dc2626; color: #ffffff; font-weight: 700; border-radius: 7px; font-size: 12px; border: none; } QPushButton:hover { background-color: #b91c1c; }")

        # Aktifkan tombol Start Tunnel sekarang karena Web Server sudah berjalan
        self._style_tunnel_btn(True)

    def _on_tunnel_url_found(self, url: str):
        self.tunnel_url = url
        self.is_tunnel_running = True
        self.log(f"Tunnel aktif: {url}")

        self.pill_tunnel.setText("● Tunnel ON")
        self.pill_tunnel.setStyleSheet("QLabel { background-color: #dbeafe; color: #1d4ed8; font-size: 10px; font-weight: 800; padding: 3px 10px; border-radius: 8px; border: none; }")

        self.lbl_tun_url.setText(url)
        self.lbl_tun_url.setStyleSheet("font-size: 11px; color: #2563eb; font-weight: 800; font-family: 'Consolas', monospace; border: none;")
        self.btn_open_tun.setEnabled(True); self._style_url_btn(self.btn_open_tun, True)
        self.btn_copy_tun.setEnabled(True); self._style_copy_btn(self.btn_copy_tun, True)

        self.btn_start_tunnel.setEnabled(True)
        self.btn_start_tunnel.setText("⏹  Stop Tunnel")
        self.btn_start_tunnel.setStyleSheet("QPushButton { background-color: #dc2626; color: #ffffff; font-weight: 700; border-radius: 7px; font-size: 12px; border: none; } QPushButton:hover { background-color: #b91c1c; }")

    def _on_tunnel_stopped(self):
        self.is_tunnel_running = False
        self.tunnel_url = ""
        self.log("Tunnel berhenti.")
        self.pill_tunnel.setText("● Tunnel Off")
        self.pill_tunnel.setStyleSheet("QLabel { background-color: #f1f5f9; color: #94a3b8; font-size: 10px; font-weight: 800; padding: 3px 10px; border-radius: 8px; border: none; }")
        self.lbl_tun_url.setText("—")
        self.lbl_tun_url.setStyleSheet("font-size: 11px; color: #475569; font-weight: 600; border: none;")
        self.btn_open_tun.setEnabled(False); self._style_url_btn(self.btn_open_tun, False)
        self.btn_copy_tun.setEnabled(False); self._style_copy_btn(self.btn_copy_tun, False)
        self.btn_start_tunnel.setEnabled(True)
        self.btn_start_tunnel.setText("⚡  Start Tunnel")
        self.btn_start_tunnel.setStyleSheet("QPushButton { background-color: #2563eb; color: #ffffff; font-weight: 700; border-radius: 7px; font-size: 12px; border: none; } QPushButton:hover { background-color: #1d4ed8; }")

    def _stop_tunnel(self):
        if self._tunnel_proc:
            try: self._tunnel_proc.terminate()
            except Exception: pass
            self._tunnel_proc = None
        self._on_tunnel_stopped()

    # --------------------------------------------------
    # MISC ACTIONS
    # --------------------------------------------------
    def copy_url(self, text, label):
        if not text:
            QMessageBox.warning(self, "URL Kosong", "URL belum tersedia.")
            return
        QApplication.clipboard().setText(text)
        QMessageBox.information(self, "URL Disalin", f"{label} berhasil disalin:\n{text}")

    def check_hardware(self):
        HardwareCheckDialog(self).exec()

    def manage_admins(self):
        AdminManagerDialog(self).exec()

    def show_guide(self):
        GuideDialog(self).exec()

    # --------------------------------------------------
    # CLEANUP ON CLOSE
    # --------------------------------------------------
    def closeEvent(self, event):
        if self.is_server_running:
            self._stop_nginx()
        if self.is_tunnel_running or self._tunnel_proc:
            self._stop_tunnel()
        event.accept()


# ==========================================
# 5. ENTRY POINT
# ==========================================
if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setApplicationName("TPS-DIGITAL Web Server Control")

    if os.path.exists(LOGO_IMG):
        app.setWindowIcon(QIcon(LOGO_IMG))

    splash = SplashScreen()
    splash.show()

    while splash.isVisible():
        app.processEvents()
        time.sleep(0.01)

    main_win = MainWindow()
    main_win.show()

    sys.exit(app.exec())
