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
            "SELECT id, username, created_at FROM identity_users WHERE id = ?",
            (user_id,)
        ).fetchone()

@identity_bp.get("/me")
def identity_me():
    user = current_user()
    if not user:
        return jsonify({"authenticated": False})
    return jsonify({
        "authenticated": True,
        "user": {"username": user["username"], "created_at": user["created_at"]}
    })

@identity_bp.post("/register")
def identity_register():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    pin = str(data.get("pin", "")).strip()

    if not re.fullmatch(r"[A-Za-z0-9_]{3,20}", username):
        return jsonify({"error": "Username must be 3–20 characters (letters, numbers, underscore)."}), 400
    if not re.fullmatch(r"\d{6}", pin):
        return jsonify({"error": "PIN must contain exactly 6 digits."}), 400

    pin_hash = generate_password_hash(pin, method="scrypt")
    created = datetime.now(timezone.utc).isoformat()

    try:
        with get_db() as db:
            cursor = db.execute(
                "INSERT INTO identity_users (username, pin_hash, created_at) VALUES (?, ?, ?)",
                (username, pin_hash, created)
            )
            user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        return jsonify({"error": "That username is already taken. Try another one."}), 409
    except sqlite3.Error:
        return jsonify({"error": "Account storage is temporarily unavailable."}), 500

    session.clear()
    session["identity_user_id"] = user_id
    session.permanent = True
    return jsonify({"ok": True, "username": username})

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
                "SELECT id, username, pin_hash FROM identity_users WHERE username = ? COLLATE NOCASE",
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
    return jsonify({"ok": True, "username": user["username"]})

@identity_bp.post("/logout")
def identity_logout():
    session.clear()
    return jsonify({"ok": True})
