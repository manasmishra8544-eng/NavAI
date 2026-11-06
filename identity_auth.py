import os
import re
import sqlite3
import secrets
from pathlib import Path
from datetime import datetime, timedelta, timezone

from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash

identity_bp = Blueprint("identity", __name__, url_prefix="/api/identity")

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get(
    "NAVAI_DB_PATH",
    str(BASE_DIR / "instance" / "navai_identity.sqlite3")
))
AVATAR_DIR = BASE_DIR / "static" / "uploads" / "navai-avatars"
MAX_AVATAR_SIZE = 3 * 1024 * 1024


def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(str(DB_PATH), timeout=15)
    db.row_factory = sqlite3.Row
    return db


def init_identity(app):
    secret = os.environ.get("SECRET_KEY", "").strip()
    if not secret:
        secret_file = BASE_DIR / "instance" / ".identity-secret"
        secret_file.parent.mkdir(parents=True, exist_ok=True)
        if secret_file.exists():
            secret = secret_file.read_text(encoding="utf-8").strip()
        else:
            secret = secrets.token_urlsafe(48)
            secret_file.write_text(secret, encoding="utf-8")

    app.secret_key = secret
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_SECURE"] = (
        os.environ.get("COOKIE_SECURE", "0").lower() in ("1", "true", "yes")
    )
    app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=14)

    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS identity_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                pin_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        columns = {
            row["name"] for row in db.execute(
                "PRAGMA table_info(identity_users)"
            ).fetchall()
        }
        if "full_name" not in columns:
            db.execute(
                "ALTER TABLE identity_users ADD COLUMN full_name TEXT NOT NULL DEFAULT ''"
            )
        if "photo_url" not in columns:
            db.execute(
                "ALTER TABLE identity_users ADD COLUMN photo_url TEXT"
            )

        db.execute("""
            CREATE TABLE IF NOT EXISTS identity_login_attempts (
                username TEXT PRIMARY KEY,
                attempts INTEGER NOT NULL DEFAULT 0,
                locked_until TEXT
            )
        """)

    app.register_blueprint(identity_bp)


def current_user():
    user_id = session.get("identity_user_id")
    if not user_id:
        return None
    with get_db() as db:
        return db.execute(
            """SELECT id, username, full_name, photo_url, created_at
               FROM identity_users WHERE id = ?""",
            (user_id,)
        ).fetchone()


def user_payload(user):
    return {
        "username": user["username"],
        "full_name": user["full_name"] or user["username"],
        "photo_url": user["photo_url"],
        "created_at": user["created_at"]
    }


def save_avatar(upload):
    if not upload or not upload.filename:
        return None, None

    raw = upload.stream.read(MAX_AVATAR_SIZE + 1)
    if len(raw) > MAX_AVATAR_SIZE:
        return None, "Photo must be 3 MB or smaller."

    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        extension = ".png"
    elif raw.startswith(b"\xff\xd8\xff"):
        extension = ".jpg"
    elif len(raw) >= 12 and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        extension = ".webp"
    else:
        return None, "Choose a valid JPG, PNG or WebP image."

    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    filename = secrets.token_hex(16) + extension
    destination = AVATAR_DIR / filename
    destination.write_bytes(raw)

    return "/static/uploads/navai-avatars/" + filename, None


@identity_bp.get("/me")
def identity_me():
    user = current_user()
    if not user:
        return jsonify({"authenticated": False})
    return jsonify({
        "authenticated": True,
        "user": user_payload(user)
    })


@identity_bp.post("/register")
def identity_register():
    if request.is_json:
        data = request.get_json(silent=True) or {}
        username = str(data.get("username", "")).strip()
        pin = str(data.get("pin", "")).strip()
        full_name = str(data.get("full_name", "")).strip()
        upload = None
    else:
        username = str(request.form.get("username", "")).strip()
        pin = str(request.form.get("pin", "")).strip()
        full_name = str(request.form.get("full_name", "")).strip()
        upload = request.files.get("photo")

    if not re.fullmatch(r"[A-Za-z0-9_]{3,20}", username):
        return jsonify({"error": "Username must be 3–20 characters (letters, numbers, underscore)."}), 400

    if not re.fullmatch(r"\d{6}", pin):
        return jsonify({"error": "PIN must contain exactly 6 digits."}), 400

    if not full_name or len(full_name) > 40:
        return jsonify({"error": "Enter your name (1–40 characters)."}), 400

    photo_url = None
    if upload and upload.filename:
        photo_url, error = save_avatar(upload)
        if error:
            return jsonify({"error": error}), 400

    pin_hash = generate_password_hash(pin, method="scrypt")
    created = datetime.now(timezone.utc).isoformat()

    try:
        with get_db() as db:
            cursor = db.execute(
                """INSERT INTO identity_users
                   (username, pin_hash, created_at, full_name, photo_url)
                   VALUES (?, ?, ?, ?, ?)""",
                (username, pin_hash, created, full_name, photo_url)
            )
            user_id = cursor.lastrowid
            user = db.execute(
                """SELECT id, username, full_name, photo_url, created_at
                   FROM identity_users WHERE id = ?""",
                (user_id,)
            ).fetchone()
    except sqlite3.IntegrityError:
        return jsonify({"error": "That username is already taken. Try another one."}), 409
    except sqlite3.Error:
        return jsonify({"error": "Account storage is temporarily unavailable."}), 500

    session.clear()
    session["identity_user_id"] = user_id
    session.permanent = True
    return jsonify({"ok": True, "user": user_payload(user)})


@identity_bp.post("/login")
def identity_login():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    pin = str(data.get("pin", "")).strip()

    if not username or not re.fullmatch(r"\d{6}", pin):
        return jsonify({"error": "Enter your username and 6-digit PIN."}), 400

    now = datetime.now(timezone.utc)
    try:
        with get_db() as db:
            attempt = db.execute(
                "SELECT attempts, locked_until FROM identity_login_attempts WHERE username = ?",
                (username.lower(),)
            ).fetchone()

            if attempt and attempt["locked_until"]:
                locked = datetime.fromisoformat(attempt["locked_until"])
                if now < locked:
                    return jsonify({"error": "Too many attempts. Please try again in 10 minutes."}), 429

            user = db.execute(
                """SELECT id, username, pin_hash, full_name, photo_url, created_at
                   FROM identity_users WHERE username = ? COLLATE NOCASE""",
                (username,)
            ).fetchone()

            if not user or not check_password_hash(user["pin_hash"], pin):
                attempts = (attempt["attempts"] if attempt else 0) + 1
                locked_until = (now + timedelta(minutes=10)).isoformat() if attempts >= 5 else None
                db.execute("""
                    INSERT INTO identity_login_attempts (username, attempts, locked_until)
                    VALUES (?, ?, ?)
                    ON CONFLICT(username) DO UPDATE SET
                    attempts = excluded.attempts,
                    locked_until = excluded.locked_until
                """, (username.lower(), attempts, locked_until))
                return jsonify({"error": "Incorrect username or PIN."}), 401

            db.execute(
                "DELETE FROM identity_login_attempts WHERE username = ?",
                (username.lower(),)
            )
    except sqlite3.Error:
        return jsonify({"error": "Account storage is temporarily unavailable."}), 500

    session.clear()
    session["identity_user_id"] = user["id"]
    session.permanent = True
    return jsonify({"ok": True, "user": user_payload(user)})


@identity_bp.post("/profile")
def identity_profile():
    user = current_user()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    full_name = str(request.form.get("full_name", "")).strip()
    if not full_name or len(full_name) > 40:
        return jsonify({"error": "Name must be 1–40 characters."}), 400

    photo_url = user["photo_url"]
    upload = request.files.get("photo")

    if upload and upload.filename:
        new_photo, error = save_avatar(upload)
        if error:
            return jsonify({"error": error}), 400
        photo_url = new_photo

    try:
        with get_db() as db:
            db.execute(
                "UPDATE identity_users SET full_name = ?, photo_url = ? WHERE id = ?",
                (full_name, photo_url, user["id"])
            )
            updated = db.execute(
                """SELECT id, username, full_name, photo_url, created_at
                   FROM identity_users WHERE id = ?""",
                (user["id"],)
            ).fetchone()
    except sqlite3.Error:
        return jsonify({"error": "Could not save your profile. Please try again."}), 500

    return jsonify({"ok": True, "user": user_payload(updated)})


@identity_bp.post("/logout")
def identity_logout():
    session.clear()
    return jsonify({"ok": True})