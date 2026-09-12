"""
Random Forest generation model (MVP) — one forest per energy type.

* Target is *specific yield* (kWh per kW of installed capacity per day), so plants from
  2 MW to 100 MW share one weather→output relationship; predictions are scaled back by
  capacity.
* A separate forest per energy type (Solar / Wind / Hydro / other) keeps solar trees
  splitting on irradiance and wind trees on wind speed instead of mixing the two.
* Per-tree spread gives a 10–90 % prediction interval.
* Trained on synthetic physics-derived data at first use and persisted with joblib.
  Replace this class with a production model without touching the service layer.
"""

import os
import threading
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np
import structlog

from config import generation_model_path
from modules.ml.features import FEATURE_COLUMNS

log = structlog.get_logger()

MODEL_VERSION = "rf-v3-per-type"
GLOBAL_KEY = "all"
MIN_ROWS_PER_TYPE = 60
_lock = threading.Lock()
_instance: Optional["GenerationModel"] = None
_CAP_IDX = FEATURE_COLUMNS.index("capacity_mw")
_TYPE_IDX = FEATURE_COLUMNS.index("energy_type_code")


class GenerationModel:
    version = MODEL_VERSION

    def __init__(self):
        self.models: Dict[str, object] = {}
        self.trained_at: Optional[str] = None
        self.metrics: Dict[str, object] = {}
        self.n_rows = 0

    # ── training ───────────────────────────────────────────
    def train(self, frame=None, n_estimators: int = 150, seed: int = 42) -> Dict[str, object]:
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.metrics import mean_absolute_error, r2_score
        from sklearn.model_selection import train_test_split

        if frame is None:
            from modules.ml.synthetic import generate_training_frame

            frame = generate_training_frame(seed=seed)

        def fit(X, y):
            m = RandomForestRegressor(
                n_estimators=n_estimators, min_samples_leaf=2, max_features=0.7, random_state=seed, n_jobs=-1
            )
            m.fit(X, y)
            return m

        X_all = frame[FEATURE_COLUMNS].to_numpy(dtype=float)
        cap_all = X_all[:, _CAP_IDX] * 1000.0
        y_all = frame["generation_kwh"].to_numpy(dtype=float) / cap_all  # specific yield
        codes = X_all[:, _TYPE_IDX].astype(int)

        pooled_true, pooled_pred, pooled_cap = [], [], []
        per_type: Dict[str, Dict[str, float]] = {}
        self.models = {}
        for code in sorted(set(codes)):
            mask = codes == code
            if mask.sum() < MIN_ROWS_PER_TYPE:
                continue
            X, y, cap = X_all[mask], y_all[mask], cap_all[mask]
            X_tr, X_te, y_tr, y_te, _, cap_te = train_test_split(X, y, cap, test_size=0.2, random_state=seed)
            m = fit(X_tr, y_tr)
            pred = m.predict(X_te)
            per_type[str(code)] = {
                "r2": round(float(r2_score(y_te, pred)), 4),
                "mae_kwh": round(float(mean_absolute_error(y_te * cap_te, pred * cap_te)), 1),
                "rows": int(mask.sum()),
            }
            pooled_true.append(y_te), pooled_pred.append(pred), pooled_cap.append(cap_te)
            self.models[str(code)] = fit(X, y)  # refit on everything for deployment
        self.models[GLOBAL_KEY] = fit(X_all, y_all)  # fallback for unseen types

        yt, yp, ct = (np.concatenate(v) for v in (pooled_true, pooled_pred, pooled_cap))
        self.metrics = {
            "r2": round(float(r2_score(yt, yp)), 4),
            "mae_kwh": round(float(mean_absolute_error(yt * ct, yp * ct)), 1),
            "mape_pct": round(float(np.mean(np.abs((yt - yp) / np.maximum(yt, 0.05))) * 100), 2),
            "holdout_rows": int(len(yt)),
            "per_type": per_type,
        }
        self.n_rows = int(len(y_all))
        self.trained_at = datetime.now(timezone.utc).isoformat()
        log.info(
            "generation_model_trained",
            version=self.version,
            rows=self.n_rows,
            r2=self.metrics["r2"],
            mape=self.metrics["mape_pct"],
        )
        return self.metrics

    # ── inference ──────────────────────────────────────────
    def predict(self, rows: List[Dict]) -> List[Tuple[float, float, float]]:
        """Return (prediction, lower, upper) in kWh per row; bounds are the 10th/90th percentile across trees."""
        if not self.models:
            raise RuntimeError("Model not trained")
        X = np.array([[float(r[c]) for c in FEATURE_COLUMNS] for r in rows], dtype=float)
        out: List[Optional[Tuple[float, float, float]]] = [None] * len(rows)
        groups = defaultdict(list)
        for i, code in enumerate(X[:, _TYPE_IDX].astype(int)):
            groups[str(code)].append(i)
        for code, idxs in groups.items():
            model = self.models.get(code) or self.models[GLOBAL_KEY]
            Xg = X[idxs]
            cap_kw = Xg[:, _CAP_IDX] * 1000.0
            per_tree = np.stack([est.predict(Xg) for est in model.estimators_], axis=0) * cap_kw  # (trees, rows) kWh
            mean, lo, hi = (
                per_tree.mean(axis=0),
                np.percentile(per_tree, 10, axis=0),
                np.percentile(per_tree, 90, axis=0),
            )
            for j, i in enumerate(idxs):
                m = max(0.0, float(mean[j]))
                out[i] = (round(m, 1), round(max(0.0, min(float(lo[j]), m)), 1), round(max(float(hi[j]), m), 1))
        return out  # type: ignore[return-value]

    def feature_importance(self) -> Dict[str, float]:
        typed = [m for k, m in self.models.items() if k != GLOBAL_KEY]
        if not typed:
            return {}
        imp = np.mean([m.feature_importances_ for m in typed], axis=0)
        return {c: round(float(v), 4) for c, v in zip(FEATURE_COLUMNS, imp)}

    # ── persistence ────────────────────────────────────────
    def save(self, path: Optional[str] = None) -> str:
        import joblib

        path = path or generation_model_path()
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        joblib.dump(
            {
                "version": self.version,
                "models": self.models,
                "trained_at": self.trained_at,
                "metrics": self.metrics,
                "n_rows": self.n_rows,
            },
            path,
        )
        return path

    @classmethod
    def load(cls, path: Optional[str] = None) -> Optional["GenerationModel"]:
        import joblib

        path = path or generation_model_path()
        if not os.path.exists(path):
            return None
        try:
            blob = joblib.load(path)
        except Exception as e:  # corrupt / incompatible pickle → retrain
            log.warning("generation_model_load_failed", path=path, error=str(e))
            return None
        if blob.get("version") != MODEL_VERSION:
            return None
        inst = cls()
        inst.models, inst.trained_at = blob["models"], blob.get("trained_at")
        inst.metrics, inst.n_rows = blob.get("metrics", {}), blob.get("n_rows", 0)
        return inst

    def info(self) -> Dict:
        return {
            "version": self.version,
            "algorithm": "RandomForestRegressor (one forest per energy type, specific-yield target)",
            "trained_at": self.trained_at,
            "training_rows": self.n_rows,
            "metrics": self.metrics,
            "features": FEATURE_COLUMNS,
            "feature_importance": self.feature_importance(),
        }


def get_model(force_retrain: bool = False) -> GenerationModel:
    """Process-wide singleton: load from disk, else train on synthetic data and persist."""
    global _instance
    with _lock:
        if _instance is not None and not force_retrain:
            return _instance
        inst = None if force_retrain else GenerationModel.load()
        if inst is None:
            inst = GenerationModel()
            inst.train()
            try:
                inst.save()
            except Exception as e:  # read-only FS etc. — keep the in-memory model
                log.warning("generation_model_save_failed", error=str(e))
        _instance = inst
        return inst


def reset_model_cache() -> None:
    global _instance
    with _lock:
        _instance = None
