"""
REC Guard — Flask Application Entry Point
"""

import os

import structlog
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from werkzeug.security import generate_password_hash

from config import APP_NAME, APP_VERSION, MAX_UPLOAD_BYTES, cors_origins, flask_debug, flask_port, jwt_expires_seconds
from utils.logger import configure_logging

configure_logging()
log = structlog.get_logger()


def create_app(test_config: dict = None):
    app = Flask(__name__)

    # ── Configuration ─────────────────────────────────────────
    app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-in-prod")
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "jwt-dev-secret")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = False  # Disabled for presentation
    app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES  # 16 MB max upload
    app.config["JSON_SORT_KEYS"] = False
    if test_config:
        app.config.update(test_config)

    # ── Extensions ────────────────────────────────────────────
    CORS(app, origins=cors_origins(), supports_credentials=True)
    jwt = JWTManager(app)

    @jwt.unauthorized_loader
    def _missing_token(reason):
        return jsonify({"success": False, "error": "Authentication required.", "detail": reason}), 401

    @jwt.invalid_token_loader
    def _invalid_token(reason):
        return jsonify({"success": False, "error": "Invalid token.", "detail": reason}), 401

    @jwt.expired_token_loader
    def _expired_token(_header, _payload):
        return jsonify({"success": False, "error": "Token has expired."}), 401

    # ── Blueprints ────────────────────────────────────────────
    from routes.admin_routes import admin_bp
    from routes.audit_routes import audit_bp
    from routes.auth_routes import auth_bp
    from routes.certificate_routes import certificates_bp
    from routes.claim_routes import claims_bp
    from routes.config_routes import config_bp
    from routes.dashboard_routes import dashboard_bp
    from routes.fraud_routes import fraud_bp
    from routes.generation_routes import generation_bp
    from routes.investigation_routes import investigations_bp
    from routes.issue_routes import issue_bp
    from routes.ledger_routes import ledger_bp
    from routes.prediction_routes import prediction_bp
    from routes.registry_routes import registry_bp
    from routes.settings_routes import settings_bp
    from routes.verify_routes import verify_bp
    from routes.officer_routes import officer_bp

    # REC Guard (Module 1 / Module 2)
    app.register_blueprint(issue_bp, url_prefix="/api")
    app.register_blueprint(verify_bp, url_prefix="/api")
    app.register_blueprint(ledger_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    # GreenShield
    app.register_blueprint(registry_bp, url_prefix="/api")
    app.register_blueprint(generation_bp, url_prefix="/api")
    app.register_blueprint(prediction_bp, url_prefix="/api")
    app.register_blueprint(claims_bp, url_prefix="/api")
    app.register_blueprint(certificates_bp, url_prefix="/api")
    app.register_blueprint(fraud_bp, url_prefix="/api")
    app.register_blueprint(investigations_bp, url_prefix="/api")
    app.register_blueprint(audit_bp, url_prefix="/api")
    app.register_blueprint(dashboard_bp, url_prefix="/api")
    app.register_blueprint(settings_bp, url_prefix="/api")
    app.register_blueprint(officer_bp, url_prefix="/api")
    # Shared
    app.register_blueprint(config_bp, url_prefix="/api")

    # ── Health Check ──────────────────────────────────────────
    @app.route("/health")
    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "service": APP_NAME, "version": APP_VERSION, "product": "GreenShield"})

    # ── Error Handlers ────────────────────────────────────────
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"success": False, "error": "Bad request", "message": str(e)}), 400

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"success": False, "error": "Not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"success": False, "error": "Method not allowed"}), 405

    @app.errorhandler(413)
    def file_too_large(e):
        return jsonify({"success": False, "error": "File too large. Maximum 16 MB."}), 413

    @app.errorhandler(415)
    def unsupported_media(e):
        return jsonify({"success": False, "error": "Unsupported media type. Use PNG or PDF."}), 415

    @app.errorhandler(500)
    def server_error(e):
        log.error("unhandled_exception", error=str(e))
        return jsonify({"success": False, "error": "Internal server error"}), 500

    # ── Initialize DB + seed admin ────────────────────────────
    from modules.ledger import create_user, get_user_by_email, init_db

    with app.app_context():
        init_db()
        from modules.settings import load_persisted

        applied = load_persisted()
        if applied:
            log.info("risk_settings_loaded", keys=applied)
        admin_email = os.getenv("ADMIN_EMAIL")
        admin_password = os.getenv("ADMIN_PASSWORD")
        if admin_email and admin_password and not get_user_by_email(admin_email):
            create_user(admin_email, generate_password_hash(admin_password), role="admin", organisation="REC Guard")
            log.info("admin_user_seeded", email=admin_email)

    log.info("app_created", version=APP_VERSION)
    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=flask_port(), debug=flask_debug())
