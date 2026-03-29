#!/usr/bin/env python3
"""
startup.py - Run before uvicorn to copy CMaps data to the persistent disk path.
Ensures the data/CMaps directory has the NASA files needed for ML training.
"""
import os
import shutil
import sys

DATA_DIR = "./data"
CMAPS_DEST = os.path.join(DATA_DIR, "CMaps")
CMAPS_SOURCES = [
    "./CMaps",         # If bundled in repo
    "../../CMaps",     # Legacy relative path
]

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(CMAPS_DEST, exist_ok=True)

# Copy CMaps files if destination is empty
if not os.listdir(CMAPS_DEST):
    for src in CMAPS_SOURCES:
        if os.path.isdir(src):
            print(f"[startup] Copying CMaps from {src} to {CMAPS_DEST}")
            for f in os.listdir(src):
                shutil.copy2(os.path.join(src, f), CMAPS_DEST)
            print("[startup] CMaps data copied successfully.")
            break
    else:
        print("[startup] WARNING: No CMaps source directory found. Backend will run with fallback data.")
else:
    print(f"[startup] CMaps data already present in {CMAPS_DEST}.")

# Copy pre-trained model if exists and not already in data dir
MODEL_SRC = "./maintainxx_model.joblib"
MODEL_DST = os.path.join(DATA_DIR, "maintainxx_model.joblib")
if os.path.exists(MODEL_SRC) and not os.path.exists(MODEL_DST):
    shutil.copy2(MODEL_SRC, MODEL_DST)
    print("[startup] ML model copied to data dir.")

print("[startup] Done. Starting uvicorn...")
