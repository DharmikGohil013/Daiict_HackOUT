"""JWT authentication: register, login, demo logins, me."""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt, get_jwt_identity, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash

from config import jwt_expires_seconds
from modules.ledger import create_user, get_user_by_email
from utils.validators import validate_register_input

auth_bp = Blueprint("auth", __name__)

DEMO_ACCOUNTS = {
    "government": "gov@greenshield.gov",
    "generator": "ops@gen-001.in",
    "institution": "claims@inst-045.org",
    "issuer": "issuer@greenshield.gov",
}
DEMO_PASSWORD = "Demo@1234"


def _public_user(user: dict) -> dict:
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "role": user["role"],
        "organisation": user.get("organisation"),
        "entity_id": user.get("entity_id"),
        "display_name": user.get("display_name"),
        "created_at": user["created_at"],
    }


def _token_for(user: dict) -> str:
    return create_access_token(
        identity=user["email"],
        additional_claims={
            "role": user["role"],
            "organisation": user.get("organisation"),
            "entity_id": user.get("entity_id"),
            "display_name": user.get("display_name"),
        },
    )


def _session(user: dict, status: int = 200):
    return (
        jsonify(
            {
                "success": True,
                "user": _public_user(user),
                "access_token": _token_for(user),
                "expires_in": jwt_expires_seconds(),
            }
        ),
        status,
    )


@auth_bp.route("/register", methods=["POST"])
def register():
    """POST /api/auth/register — {"email","password","role","organisation","entity_id"?}"""
    data = request.get_json(silent=True) or {}
    errors = validate_register_input(data)
    if errors:
        return jsonify({"success": False, "error": "Validation failed", "details": errors}), 422
    user = create_user(
        email=data["email"],
        password_hash=generate_password_hash(data["password"]),
        role=data.get("role", "auditor"),
        organisation=(data.get("organisation") or "").strip() or None,
        entity_id=(data.get("entity_id") or "").strip() or None,
        display_name=(data.get("display_name") or "").strip() or None,
    )
    if user is None:
        return jsonify({"success": False, "error": "An account with this email already exists."}), 409
    return _session(user, 201)


@auth_bp.route("/login", methods=["POST"])
def login():
    """POST /api/auth/login — {"email","password"} (role is derived from the account, not the form)"""
    data = request.get_json(silent=True) or {}
    email, password = data.get("email", ""), data.get("password", "")
    user = get_user_by_email(email) if email else None
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"success": False, "error": "Invalid email or password."}), 401
    requested_role = data.get("role")
    if requested_role and requested_role != user["role"] and user["role"] != "admin":
        return (
            jsonify(
                {"success": False, "error": f"This account is registered as {user['role']}, not {requested_role}."}
            ),
            403,
        )
    return _session(user)


@auth_bp.route("/demo/<role>", methods=["POST"])
def demo_login(role):
    """POST /api/auth/demo/{government|generator|institution|issuer} — one-click demo session."""
    email = DEMO_ACCOUNTS.get(role)
    if not email:
        return jsonify({"success": False, "error": "Unknown demo role."}), 404
    user = get_user_by_email(email)
    if not user:
        return (
            jsonify({"success": False, "error": "Demo data not seeded. Run: python scripts/seed_greenshield.py"}),
            503,
        )
    return _session(user)


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """GET /api/auth/me — current user from the JWT."""
    claims = get_jwt()
    return jsonify(
        {
            "success": True,
            "email": get_jwt_identity(),
            "role": claims.get("role"),
            "organisation": claims.get("organisation"),
            "entity_id": claims.get("entity_id"),
            "display_name": claims.get("display_name"),
        }
    )
