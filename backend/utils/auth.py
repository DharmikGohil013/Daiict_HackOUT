"""Role-based access helpers built on Flask-JWT-Extended."""

from functools import wraps
from typing import Optional

from flask import jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

# Government-equivalent roles: full read access + decisions. 'admin' is always allowed.
GOV_ROLES = ("government", "regulator")
ISSUER_ROLES = ("issuer",)


def roles_required(*roles):
    """Require a valid JWT whose 'role' claim is one of *roles* ('admin' always allowed)."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            role = claims.get("role")
            if role == "admin" or role in roles:
                return fn(*args, **kwargs)
            return jsonify({"success": False, "error": f"Requires role: {', '.join(roles)}."}), 403

        return wrapper

    return decorator


def current_identity(optional: bool = True) -> Optional[dict]:
    """{email, role, entity_id, display_name} for the caller, or None when anonymous (optional=True)."""
    verify_jwt_in_request(optional=optional)
    email = get_jwt_identity()
    if not email:
        return None
    claims = get_jwt()
    return {
        "email": email,
        "role": claims.get("role"),
        "entity_id": claims.get("entity_id"),
        "display_name": claims.get("display_name"),
        "organisation": claims.get("organisation"),
    }


def is_government(identity: Optional[dict]) -> bool:
    return bool(identity) and (identity["role"] in GOV_ROLES or identity["role"] == "admin")


def may_access_entity(identity: Optional[dict], entity_id: str) -> bool:
    """Government sees everything; generators/institutions only their own entity."""
    if identity is None:
        return True  # public read endpoints call this only when they want to restrict writes
    if is_government(identity):
        return True
    return identity.get("entity_id") == entity_id
