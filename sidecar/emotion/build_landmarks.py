"""Build the landmark CSV that train.py reads, from FER2013 face images.

    python -m emotion.build_landmarks fer2013.csv -o landmarks.csv            # Kaggle CSV (emotion, pixels)
    python -m emotion.build_landmarks train.parquet valid.parquet -o landmarks.csv   # Hugging Face parquet (label, image)

Uses the same extractor as the live camera (emotion/landmarks.py), so training and live
landmarks match. Output columns: emotion, x0, y0, ..., x67, y67.
"""

import argparse
import io
from multiprocessing import Pool
from pathlib import Path

import numpy as np
import pandas as pd

_extractor = None


def _init_worker() -> None:
    global _extractor
    from .landmarks import LandmarkExtractor
    _extractor = LandmarkExtractor()


def _decode(item) -> np.ndarray:
    """48x48 grayscale image from a Kaggle pixel string or parquet image bytes."""
    if isinstance(item, str):
        return np.array(item.split(), dtype=np.uint8).reshape(48, 48)
    import cv2
    data = item["bytes"] if isinstance(item, dict) else item
    return cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_GRAYSCALE)


def _landmarks(item):
    pts = _extractor.from_crop(_decode(item))
    return None if pts is None else pts.reshape(-1)


def load(paths: list[Path]) -> pd.DataFrame:
    frames = []
    for p in paths:
        df = pd.read_parquet(p) if p.suffix == ".parquet" else pd.read_csv(p)
        df = df.rename(columns={"label": "emotion", "pixels": "image"})
        frames.append(df[["emotion", "image"]])
    return pd.concat(frames, ignore_index=True)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", type=Path, nargs="+")
    ap.add_argument("-o", "--out", type=Path, required=True)
    args = ap.parse_args()

    df = load(args.inputs)
    print(f"{len(df)} images; extracting landmarks…")
    with Pool(initializer=_init_worker) as pool:
        pts = pool.map(_landmarks, df["image"], chunksize=256)
    keep = [i for i, p in enumerate(pts) if p is not None]
    out = pd.DataFrame(np.stack([pts[i] for i in keep]).round(2),
                       columns=[f"{axis}{i}" for i in range(68) for axis in ("x", "y")])
    out.insert(0, "emotion", df["emotion"].to_numpy()[keep])
    out.to_csv(args.out, index=False)
    print(f"wrote {len(out)} rows to {args.out} ({len(df) - len(out)} images skipped)")


if __name__ == "__main__":
    main()
