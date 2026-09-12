"""
GreenShield ML service — generation prediction.

Kept as its own package with a small public interface so it can be lifted into a
separate FastAPI process without touching callers:

    from modules.ml import predict_period, forecast, get_model
"""

from modules.ml.service import forecast, predict_daily, predict_period, anomaly_score  # noqa: F401
from modules.ml.model import get_model, GenerationModel, MODEL_VERSION  # noqa: F401
