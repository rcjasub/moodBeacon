"""Train the landmark -> emotion model on FER2013 landmarks.

    cd sidecar
    pip install -r requirements-emotion.txt
    python -m emotion.train path/to/fer2013_landmarks_nopathsfixed.csv

Input CSV: one row per image, an emotion label column (FER2013 ids 0-6) and the facial
landmark coordinates, either as numeric columns (x0, y0, x1, y1, ... or x0..xN, y0..yN)
or as one column holding a space/comma separated list. Non-numeric columns (pixels, Usage,
paths) are ignored.

Output (sidecar/emotion/models/): emotion_mlp.keras, scaler.joblib, meta.json
"""

import argparse
import json
import re
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_class_weight

from . import LABELS
from .features import normalize

MODELS_DIR = Path(__file__).resolve().parent / "models"
LABEL_CANDIDATES = ["emotion", "label", "emotions", "class"]


def find_label_column(df: pd.DataFrame, name: str | None) -> str:
    if name:
        return name
    lower = {c.lower(): c for c in df.columns}
    for cand in LABEL_CANDIDATES:
        if cand in lower:
            return lower[cand]
    raise SystemExit(f"No label column found (tried {LABEL_CANDIDATES}); pass --label-col")


def split_xy_order(cols: list[str]) -> list[str]:
    """Reorder named coordinate columns to x0, y0, x1, y1, ... when they're named like x_12 / y12."""
    pat = re.compile(r"^([xy])[_\s-]?(\d+)$", re.I)
    parsed = [pat.match(c) for c in cols]
    if not all(parsed):
        return cols  # unnamed / other naming: keep file order (assumed interleaved)
    by_idx = {(m.group(1).lower(), int(m.group(2))): c for m, c in zip(parsed, cols)}
    idxs = sorted({i for _, i in by_idx})
    return [by_idx[(axis, i)] for i in idxs for axis in ("x", "y")]


def load_landmarks(df: pd.DataFrame, label_col: str, layout: str) -> np.ndarray:
    rest = df.drop(columns=[label_col])
    numeric = rest.select_dtypes(include="number")
    if numeric.shape[1] >= 10:
        cols = split_xy_order(list(numeric.columns))
        X = numeric[cols].to_numpy(dtype=np.float32)
    else:
        # One text column holding all coordinates, e.g. "12.0 30.5 13.1 ..."
        text_col = next((c for c in rest.columns if rest[c].astype(str).str.count(r"[\d.]+").min() >= 10), None)
        if text_col is None:
            raise SystemExit("Couldn't find landmark coordinates in the CSV")
        X = np.array([np.array(re.findall(r"-?\d+(?:\.\d+)?", s), dtype=np.float32)
                      for s in rest[text_col].astype(str)])
    if X.shape[1] % 2:
        raise SystemExit(f"Odd number of coordinate values per row ({X.shape[1]}); expected x,y pairs")
    if layout == "split":  # x0..xN then y0..yN
        n = X.shape[1] // 2
        X = np.stack([X[:, :n], X[:, n:]], axis=2).reshape(len(X), -1)
    return X


def build_model(n_features: int, n_classes: int):
    import tensorflow as tf

    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(n_features,)),
        tf.keras.layers.Dense(256, activation="relu"),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.4),
        tf.keras.layers.Dense(128, activation="relu"),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(64, activation="relu"),
        tf.keras.layers.Dense(n_classes, activation="softmax"),
    ])
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3),
                  loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return model


def main() -> None:
    import tensorflow as tf

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", type=Path)
    ap.add_argument("--label-col")
    ap.add_argument("--layout", choices=["interleaved", "split"], default="interleaved",
                    help="Unnamed coordinate columns: x0,y0,x1,y1... (default) or x0..xN,y0..yN")
    ap.add_argument("--epochs", type=int, default=150)
    ap.add_argument("--batch-size", type=int, default=128)
    args = ap.parse_args()

    df = pd.read_csv(args.csv)
    label_col = find_label_column(df, args.label_col)
    df = df.dropna()
    y = df[label_col].astype(int).to_numpy()
    X_raw = load_landmarks(df, label_col, args.layout)
    n_points = X_raw.shape[1] // 2
    print(f"{len(X_raw)} rows, {n_points} landmarks per face, labels {sorted(set(y.tolist()))}")
    if n_points != 68:
        print(f"warning: live inference uses 68-point (dlib layout) landmarks, but the CSV has {n_points}")

    X = np.stack([normalize(row) for row in X_raw])
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.15, stratify=y, random_state=42)
    scaler = StandardScaler().fit(X_tr)
    X_tr, X_te = scaler.transform(X_tr), scaler.transform(X_te)

    # FER2013 is imbalanced (very few "disgust"); weight classes so the model doesn't ignore them.
    classes = np.arange(len(LABELS))
    present = np.unique(y_tr)
    weights = compute_class_weight("balanced", classes=present, y=y_tr)
    class_weight = {int(c): float(w) for c, w in zip(present, weights)}

    model = build_model(X.shape[1], len(LABELS))
    model.fit(
        X_tr, y_tr, validation_split=0.15, epochs=args.epochs, batch_size=args.batch_size,
        class_weight=class_weight, verbose=2,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=12, restore_best_weights=True),
            tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=5),
        ],
    )

    pred = model.predict(X_te, verbose=0).argmax(axis=1)
    print(classification_report(y_te, pred, labels=classes, target_names=LABELS, zero_division=0))

    MODELS_DIR.mkdir(exist_ok=True)
    model.save(MODELS_DIR / "emotion_mlp.keras")
    joblib.dump(scaler, MODELS_DIR / "scaler.joblib")
    (MODELS_DIR / "meta.json").write_text(json.dumps({
        "labels": LABELS, "n_points": n_points,
        "test_accuracy": float((pred == y_te).mean()),
    }, indent=2))
    print(f"saved to {MODELS_DIR}")


if __name__ == "__main__":
    main()
