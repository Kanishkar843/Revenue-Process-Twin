import os
import pickle
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

def train_isolation_forest():
    print("Training Isolation Forest Anomaly Detection Model...")
    os.makedirs("ml/models", exist_ok=True)

    # Synthesize background data for training
    np.random.seed(42)
    n_samples = 1500

    disc_z = np.random.normal(0, 1, n_samples)
    latency = np.random.exponential(5, n_samples)
    refund_ratio = np.random.beta(0.5, 5, n_samples)
    amount_z = np.random.normal(0, 1, n_samples)

    # Inject 5% anomalies
    n_anomalies = int(n_samples * 0.05)
    disc_z[:n_anomalies] += np.random.uniform(3, 6, n_anomalies)
    latency[:n_anomalies] += np.random.uniform(40, 90, n_anomalies)
    refund_ratio[:n_anomalies] += np.random.uniform(0.3, 0.7, n_anomalies)

    X = np.column_stack([disc_z, latency, refund_ratio, amount_z])

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = IsolationForest(contamination=0.05, random_state=42)
    model.fit(X_scaled)

    with open("ml/models/isolation_forest.pkl", "wb") as f:
        pickle.dump({"model": model, "scaler": scaler}, f)

    print("Isolation Forest trained and saved to ml/models/isolation_forest.pkl")

if __name__ == "__main__":
    train_isolation_forest()
