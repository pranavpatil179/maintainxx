"""
ML Engine – trains on NASA CMAPSS data and exposes prediction utilities.
Uses GradientBoostingRegressor to predict RUL from sensor features.
"""
import os
import glob
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import r2_score
import logging
import joblib

logger = logging.getLogger(__name__)

# Sensor columns that are useful for prediction (drop constant ones)
SENSOR_COLS = [f"s{i}" for i in range(1, 22)]
OP_COLS = ["op_setting_1", "op_setting_2", "op_setting_3"]
FEATURE_COLS = OP_COLS + SENSOR_COLS

COLUMN_NAMES = (
    ["unit", "cycle"]
    + OP_COLS
    + SENSOR_COLS
    + ["s22", "s23", "s24", "s25"]           # extra unnamed cols in some rows
)[:26]


class MLEngine:
    def __init__(self):
        self.model: GradientBoostingRegressor | None = None
        self.scaler = MinMaxScaler()
        self.r2: float = 0.0
        self.trained = False
        self.feature_cols: list[str] = []
        self.max_rul = 375.0            # cap RUL for normalization

    # ─── Data helpers ─────────────────────────────────────────────────────────

    def _read_cmaps_file(self, path: str) -> pd.DataFrame:
        df = pd.read_csv(
            path,
            sep=r"\s+",
            header=None,
            names=COLUMN_NAMES,
            engine="python",
        )
        df = df.iloc[:, :26]
        df.columns = ["unit", "cycle"] + OP_COLS + SENSOR_COLS
        return df

    def _add_rul_column(self, df: pd.DataFrame) -> pd.DataFrame:
        max_cycle = df.groupby("unit")["cycle"].max().reset_index()
        max_cycle.columns = ["unit", "max_cycle"]
        df = df.merge(max_cycle, on="unit")
        df["rul"] = df["max_cycle"] - df["cycle"]
        df.drop(columns=["max_cycle"], inplace=True)
        df["rul"] = df["rul"].clip(upper=self.max_rul)
        return df

    def _drop_low_variance(self, df: pd.DataFrame, threshold=0.001) -> list[str]:
        variances = df[SENSOR_COLS].var()
        useful = variances[variances > threshold].index.tolist()
        return OP_COLS + useful

    def _build_features(self, df: pd.DataFrame, feature_cols: list[str]) -> pd.DataFrame:
        """Add rolling statistics as additional features."""
        df = df.sort_values(["unit", "cycle"])
        for col in feature_cols:
            if col in SENSOR_COLS:
                df[f"{col}_roll3"] = (
                    df.groupby("unit")[col]
                    .transform(lambda x: x.rolling(3, min_periods=1).mean())
                )
        return df

    # ─── Training ────────────────────────────────────────────────────────────

    def load_or_train(self, data_dir: str, model_path: str = "maintainxx_model.joblib") -> bool:
        if os.path.exists(model_path):
            try:
                state = joblib.load(model_path)
                self.model = state["model"]
                self.scaler = state["scaler"]
                self.r2 = state["r2"]
                self.feature_cols = state["feature_cols"]
                self._all_feats = state["all_feats"]
                self.trained = True
                logger.info("Loaded pre-trained ML model from %s (R²=%.4f)", model_path, self.r2)
                return True
            except Exception as e:
                logger.error("Failed to load ML model: %s. Retraining...", e)

        success = self.train(data_dir)
        if success:
            try:
                state = {
                    "model": self.model,
                    "scaler": self.scaler,
                    "r2": self.r2,
                    "feature_cols": self.feature_cols,
                    "all_feats": self._all_feats
                }
                joblib.dump(state, model_path)
                logger.info("Saved trained ML model to %s", model_path)
            except Exception as e:
                logger.warning("Failed to save ML model: %s", e)
        return success

    def train(self, data_dir: str) -> bool:
        """Read all train_FDxxx.txt files, engineer features, train model."""
        train_files = glob.glob(os.path.join(data_dir, "train_FD*.txt"))
        if not train_files:
            logger.warning("No training files found in %s", data_dir)
            return False

        frames = []
        for f in sorted(train_files):
            fd_name = os.path.basename(f).replace("train_", "").replace(".txt", "")
            df = self._read_cmaps_file(f)
            df = self._add_rul_column(df)
            df["dataset"] = fd_name
            frames.append(df)

        data = pd.concat(frames, ignore_index=True)
        data.fillna(data.median(numeric_only=True), inplace=True)

        # Feature selection
        self.feature_cols = self._drop_low_variance(data)
        data = self._build_features(data, self.feature_cols)

        # Roll features get added
        roll_cols = [c for c in data.columns if c.endswith("_roll3")]
        all_feats = self.feature_cols + roll_cols

        X = data[all_feats].values
        y = data["rul"].values

        X_scaled = self.scaler.fit_transform(X)

        self.model = GradientBoostingRegressor(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            random_state=42,
        )
        self.model.fit(X_scaled, y)
        preds = self.model.predict(X_scaled)
        self.r2 = r2_score(y, preds)
        self.trained = True
        self._all_feats = all_feats
        logger.info("ML model trained. R²=%.4f on %d samples", self.r2, len(y))
        return True

    # ─── Prediction helpers ──────────────────────────────────────────────────

    def predict_from_sensor_row(self, row: dict) -> dict:
        """
        Predict RUL from a dict of sensor + op_setting values.
        Returns: {rul, health_score, risk_level}
        """
        if not self.trained or self.model is None:
            return {"rul": 100.0, "health_score": 75.0, "risk_level": "Medium"}

        X = []
        for feat in self._all_feats:
            X.append(float(row.get(feat, row.get(feat.replace("_roll3", ""), 0.0) or 0.0)))

        X_arr = np.array([X])
        X_scaled = self.scaler.transform(X_arr)
        rul = float(self.model.predict(X_scaled)[0])
        rul = max(0.0, round(rul, 1))

        health_score = min(100.0, max(0.0, (rul / self.max_rul) * 100.0))
        risk_level = self._risk_level(rul)

        return {"rul": rul, "health_score": round(health_score, 1), "risk_level": risk_level}

    def predict_from_last_cycles(self, cycles_df: pd.DataFrame) -> dict:
        """
        Predict RUL from a DataFrame of sensor cycles for a single machine.
        Uses the last row + rolling averages.
        """
        if not self.trained or self.model is None or cycles_df.empty:
            return {"rul": 100.0, "health_score": 75.0, "risk_level": "Medium"}

        df = cycles_df.copy()
        df = self._build_features(df, self.feature_cols)
        roll_cols = [c for c in df.columns if c.endswith("_roll3")]
        all_feats = self.feature_cols + roll_cols

        last = df.iloc[-1]
        X = []
        for feat in self._all_feats:
            X.append(float(last.get(feat, 0.0) or 0.0))

        X_arr = np.array([X])
        try:
            X_scaled = self.scaler.transform(X_arr)
            rul = float(self.model.predict(X_scaled)[0])
        except Exception:
            rul = 100.0
        rul = max(0.0, round(rul, 1))
        health_score = min(100.0, max(0.0, (rul / self.max_rul) * 100.0))

        return {"rul": rul, "health_score": round(health_score, 1), "risk_level": self._risk_level(rul)}

    @staticmethod
    def _risk_level(rul: float) -> str:
        if rul < 50:
            return "High"
        elif rul < 150:
            return "Medium"
        return "Low"

    @staticmethod
    def health_to_status(health: float) -> str:
        if health < 30:
            return "critical"
        elif health < 60:
            return "warning"
        return "operational"

    @staticmethod
    def failure_date_estimate(rul: float, machine_id: str = "FD001-1") -> str:
        """
        Return ISO date string of estimated failure.
        Includes machine-specific 'usage intensity' jitter to prevent date clustering.
        """
        import hashlib
        from datetime import datetime, timedelta, UTC
        
        # Consistent jitter based on machine_id hash (random-ish but persistent)
        seed = int(hashlib.md5(machine_id.encode()).hexdigest(), 16)
        usage_intensity = 0.4 + (seed % 60) / 100.0 # 0.4 to 1.0 days per cycle
        
        # Calculate offset
        days_offset = rul * usage_intensity
        
        est = datetime.now(UTC) + timedelta(days=days_offset)
        return est.strftime("%Y-%m-%d")


# Global singleton
ml_engine = MLEngine()
