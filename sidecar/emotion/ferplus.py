"""Live expression estimate with the pretrained FER+ CNN: preview JPEG -> face crop -> model -> smoothed scores.

Reads the face image itself instead of landmark positions, so it is much more accurate than the
landmark model in tracker.py (~80-85% vs ~44% on FER test sets). Runs on OpenCV's DNN module,
so it needs neither TensorFlow nor training. Frames are decoded in memory and dropped right away.
"""

import base64
import logging
import urllib.request

import numpy as np

from . import LABELS
from .landmarks import MODELS_DIR

log = logging.getLogger(__name__)

FERPLUS_URL = ("https://github.com/onnx/models/raw/main/validated/vision/body_analysis/"
               "emotion_ferplus/model/emotion-ferplus-8.onnx")
FERPLUS_PATH = MODELS_DIR / "emotion-ferplus-8.onnx"
# Model output order. FER+ adds "contempt", which is folded into "disgust" for our 7 labels.
FERPLUS_LABELS = ["neutral", "happy", "surprise", "sad", "angry", "disgust", "fear", "disgust"]
INPUT_SIZE = 64
FACE_PAD = 0.1  # FER+ faces are cropped a little looser than Haar boxes
SMOOTHING = 0.35  # weight of the newest frame in the moving average


class FerPlusTracker:
    def __init__(self) -> None:
        import cv2

        if not FERPLUS_PATH.exists():
            log.info("downloading FER+ expression model to %s", FERPLUS_PATH)
            MODELS_DIR.mkdir(exist_ok=True)
            urllib.request.urlretrieve(FERPLUS_URL, FERPLUS_PATH)
        self.cv2 = cv2
        self.net = cv2.dnn.readNetFromONNX(str(FERPLUS_PATH))
        self.detector = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        if self.detector.empty():
            raise RuntimeError("OpenCV face detector missing; install opencv-contrib-python-headless<5")
        self.smoothed: np.ndarray | None = None

    @classmethod
    def load_or_none(cls) -> "FerPlusTracker | None":
        try:
            return cls()
        except Exception as e:  # noqa: BLE001
            log.warning("FER+ expression model unavailable: %s", e)
            return None

    def reset(self) -> None:
        """New session: don't carry the last session's average over."""
        self.smoothed = None

    def face_crop(self, jpeg_b64: str) -> np.ndarray | None:
        """Biggest face in the frame as a 64x64 grayscale crop, or None."""
        cv2 = self.cv2
        gray = cv2.imdecode(np.frombuffer(base64.b64decode(jpeg_b64), np.uint8), cv2.IMREAD_GRAYSCALE)
        if gray is None:
            return None
        faces = self.detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(48, 48))
        if not len(faces):
            return None
        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
        pad = int(FACE_PAD * w)
        H, W = gray.shape
        crop = gray[max(0, y - pad):min(H, y + h + pad), max(0, x - pad):min(W, x + w + pad)]
        return cv2.resize(crop, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_AREA)

    def update(self, jpeg_b64: str) -> dict:
        """One frame in, one `emotion` message out. Blocking; call it from a worker thread."""
        face = self.face_crop(jpeg_b64)
        if face is None:
            return {"type": "emotion", "face": False, "scores": None}
        # FER+ takes raw 0-255 pixel values, shape (1, 1, 64, 64), and returns logits.
        self.net.setInput(face.astype(np.float32)[None, None])
        logits = self.net.forward()[0]
        e = np.exp(logits - logits.max())
        raw = e / e.sum()
        probs = np.zeros(len(LABELS), dtype=np.float32)
        for label, p in zip(FERPLUS_LABELS, raw):
            probs[LABELS.index(label)] += p
        self.smoothed = probs if self.smoothed is None else SMOOTHING * probs + (1 - SMOOTHING) * self.smoothed
        return {"type": "emotion", "face": True,
                "scores": {k: round(float(v), 3) for k, v in zip(LABELS, self.smoothed)}}
