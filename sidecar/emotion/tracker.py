"""Live expression estimate: preview JPEG -> 68 face landmarks -> trained model -> smoothed scores.

Frames are decoded in memory and dropped right away.
"""

import base64
import json
import logging

import numpy as np

from . import LABELS
from .features import normalize
from .landmarks import MODELS_DIR, LandmarkExtractor

log = logging.getLogger(__name__)

SMOOTHING = 0.35  # weight of the newest frame in the moving average


class EmotionTracker:
    def __init__(self) -> None:
        import cv2
        import joblib
        import tensorflow as tf

        meta = json.loads((MODELS_DIR / "meta.json").read_text())
        if meta["n_points"] != 68:
            raise RuntimeError(f"model was trained on {meta['n_points']} landmarks; live landmarks have 68")
        self.model = tf.keras.models.load_model(MODELS_DIR / "emotion_mlp.keras")
        self.scaler = joblib.load(MODELS_DIR / "scaler.joblib")
        self.cv2 = cv2
        self.extractor = LandmarkExtractor()
        self.smoothed: np.ndarray | None = None

    @classmethod
    def load_or_none(cls) -> "EmotionTracker | None":
        """The radar is optional: without the model or its packages the sidecar runs as before."""
        if not (MODELS_DIR / "emotion_mlp.keras").exists():
            log.info("emotion model not trained yet (see sidecar/README.md); expression radar off")
            return None
        try:
            return cls()
        except Exception as e:  # noqa: BLE001
            log.warning("expression radar off: %s", e)
            return None

    def reset(self) -> None:
        """New session: don't carry the last session's average over."""
        self.smoothed = None

    def landmarks(self, jpeg_b64: str) -> np.ndarray | None:
        cv2 = self.cv2
        img = cv2.imdecode(np.frombuffer(base64.b64decode(jpeg_b64), np.uint8), cv2.IMREAD_GRAYSCALE)
        return None if img is None else self.extractor.from_frame(img)

    def update(self, jpeg_b64: str) -> dict:
        """One frame in, one `emotion` message out. Blocking; call it from a worker thread."""
        pts = self.landmarks(jpeg_b64)
        if pts is None:
            return {"type": "emotion", "face": False, "scores": None}
        x = self.scaler.transform(normalize(pts)[None, :])
        probs = self.model(x, training=False).numpy()[0]
        self.smoothed = probs if self.smoothed is None else SMOOTHING * probs + (1 - SMOOTHING) * self.smoothed
        return {"type": "emotion", "face": True,
                "scores": {k: round(float(v), 3) for k, v in zip(LABELS, self.smoothed)}}
