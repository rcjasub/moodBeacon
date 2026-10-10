"""Live expression estimate: preview JPEG -> 68 face landmarks -> trained model -> smoothed scores.

Landmarks come from OpenCV's LBF facemark, which uses the same 68-point layout as dlib
(the layout of the FER2013 landmark CSV). Frames are decoded in memory and dropped right away.
"""

import base64
import json
import logging
import urllib.request
from pathlib import Path

import numpy as np

from . import LABELS
from .features import normalize

log = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parent / "models"
LBF_URL = "https://raw.githubusercontent.com/kurnianggoro/GSOC2017/master/data/lbfmodel.yaml"
LBF_PATH = MODELS_DIR / "lbfmodel.yaml"
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
        if not LBF_PATH.exists():
            log.info("downloading face landmark model to %s", LBF_PATH)
            urllib.request.urlretrieve(LBF_URL, LBF_PATH)
        self.cv2 = cv2
        self.detector = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        if self.detector.empty():
            raise RuntimeError("OpenCV face detector missing; install opencv-contrib-python-headless<5")
        self.facemark = cv2.face.createFacemarkLBF()
        self.facemark.loadModel(str(LBF_PATH))
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
        if img is None:
            return None
        faces = self.detector.detectMultiScale(img, scaleFactor=1.1, minNeighbors=5, minSize=(48, 48))
        if len(faces) == 0:
            return None
        biggest = max(faces, key=lambda f: f[2] * f[3])
        ok, shapes = self.facemark.fit(img, np.array([biggest]))
        return shapes[0][0] if ok else None  # (68, 2)

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
