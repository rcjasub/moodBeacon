"""Facial-expression estimate from landmarks (FER2013 labels), for the live radar chart.

train.py   trains the model on fer2013_landmarks_nopathsfixed.csv
tracker.py runs it on live preview frames inside the sidecar
"""

# FER2013 label ids 0..6, in dataset order.
LABELS = ["angry", "disgust", "fear", "happy", "sad", "surprise", "neutral"]
