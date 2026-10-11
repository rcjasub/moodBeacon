"""Landmark -> feature vector. Shared by training and live inference so both see the same input."""

import numpy as np


def normalize(points: np.ndarray) -> np.ndarray:
    """(n, 2) landmark coordinates -> flat vector that ignores where the face is and how big it is.

    FER2013 faces are 48x48 crops; live faces are anywhere in a 320px frame. Centering on the
    landmark mean and dividing by the RMS distance to it makes both comparable.
    """
    pts = np.asarray(points, dtype=np.float32).reshape(-1, 2)
    pts = pts - pts.mean(axis=0)
    scale = np.sqrt((pts ** 2).sum(axis=1).mean())
    if scale > 0:
        pts = pts / scale
    return pts.reshape(-1)
