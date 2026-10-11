"""68-point face landmarks (dlib layout) with OpenCV: Haar face detection + LBF facemark.

Used both to build the training CSV from FER2013 images and on live preview frames,
so the model always sees landmarks from the same extractor.
"""

import logging
import urllib.request
from pathlib import Path

import numpy as np

log = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parent / "models"
LBF_URL = "https://raw.githubusercontent.com/kurnianggoro/GSOC2017/master/data/lbfmodel.yaml"
LBF_PATH = MODELS_DIR / "lbfmodel.yaml"


class LandmarkExtractor:
    def __init__(self) -> None:
        import cv2

        if not LBF_PATH.exists():
            log.info("downloading face landmark model to %s", LBF_PATH)
            MODELS_DIR.mkdir(exist_ok=True)
            urllib.request.urlretrieve(LBF_URL, LBF_PATH)
        self.cv2 = cv2
        self.detector = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        if self.detector.empty():
            raise RuntimeError("OpenCV face detector missing; install opencv-contrib-python-headless<5")
        self.facemark = cv2.face.createFacemarkLBF()
        self.facemark.loadModel(str(LBF_PATH))

    def detect(self, gray: np.ndarray, min_size: int = 48):
        """Biggest face box (x, y, w, h), or None."""
        faces = self.detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(min_size, min_size))
        return max(faces, key=lambda f: f[2] * f[3]) if len(faces) else None

    def fit(self, gray: np.ndarray, box) -> np.ndarray | None:
        """(68, 2) landmarks inside a face box."""
        ok, shapes = self.facemark.fit(gray, np.array([box], dtype=np.int32))
        return shapes[0][0] if ok else None

    def from_frame(self, gray: np.ndarray) -> np.ndarray | None:
        """Live webcam frame: find the face first."""
        box = self.detect(gray)
        return None if box is None else self.fit(gray, box)

    def from_crop(self, gray: np.ndarray, upscale: int = 4) -> np.ndarray | None:
        """Pre-cropped face (FER2013 48x48): detect if possible, else treat the whole crop as the face."""
        big = self.cv2.resize(gray, None, fx=upscale, fy=upscale, interpolation=self.cv2.INTER_CUBIC)
        h, w = big.shape
        box = self.detect(big, min_size=w // 2)
        if box is None:
            box = (0, 0, w, h)
        pts = self.fit(big, box)
        return None if pts is None else pts / upscale
