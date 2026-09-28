# ==========================================================
# AI-Based Predictive Failure Analysis of CNC Tool Life
# Using Random Forest Classifier
# ==========================================================

# -----------------------------
# Import Libraries
# -----------------------------
import joblib
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    classification_report
)

# -----------------------------
# Load Dataset
# -----------------------------
df = pd.read_csv("cnc_tool_condition_dataset.csv")

print("="*60)
print("DATASET PREVIEW")
print("="*60)
print(df.head())

print("\n")

print("="*60)
print("COLUMN NAMES")
print("="*60)
print(df.columns)

print("\n")

print("="*60)
print("DATASET INFORMATION")
print("="*60)
print(df.info())

print("\n")

print("="*60)
print("MISSING VALUES")
print("="*60)
print(df.isnull().sum())

print("\n")

print("="*60)
print("DUPLICATE RECORDS")
print("="*60)
print(df.duplicated().sum())

df = df.drop_duplicates()

# ==========================================================
# Encode Target Variable
# ==========================================================

label_encoder = LabelEncoder()

df["Tool_Condition"] = label_encoder.fit_transform(
    df["Tool_Condition"]
)

print("\n")

print("="*60)
print("CLASS LABELS")
print("="*60)

for i, cls in enumerate(label_encoder.classes_):
    print(f"{cls} --> {i}")

# ==========================================================
# Feature Matrix and Target
# ==========================================================

X = df.drop("Tool_Condition", axis=1)

y = df["Tool_Condition"]

# ==========================================================
# Train Test Split
# ==========================================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("\n")

print("="*60)
print("TRAIN TEST SPLIT")
print("="*60)

print("Training Samples :", len(X_train))
print("Testing Samples  :", len(X_test))

# ==========================================================
# Random Forest Model
# ==========================================================

rf = RandomForestClassifier(
    n_estimators=100,
    random_state=42
)

# ==========================================================
# Train Model
# ==========================================================

rf.fit(X_train, y_train)
# Save trained model and label encoder
import joblib

joblib.dump(rf, "random_forest_model.pkl")
joblib.dump(label_encoder, "label_encoder.pkl")

print("Model and label encoder saved successfully!")
# Save trained model and label encoder
import joblib

joblib.dump(rf, "random_forest_model.pkl")
joblib.dump(label_encoder, "label_encoder.pkl")

print("Model and label encoder saved successfully!")

print("\n")
print("Random Forest Model Trained Successfully")

# ==========================================================
# Prediction
# ==========================================================

y_pred = rf.predict(X_test)

# ==========================================================
# Accuracy
# ==========================================================

accuracy = accuracy_score(y_test, y_pred)

print("\n")

print("="*60)
print("MODEL ACCURACY")
print("="*60)

print(f"Accuracy : {accuracy*100:.2f}%")

# ==========================================================
# Confusion Matrix
# ==========================================================

cm = confusion_matrix(y_test, y_pred)

print("\n")

print("="*60)
print("CONFUSION MATRIX")
print("="*60)

print(cm)

# ==========================================================
# Classification Report
# ==========================================================

print("\n")

print("="*60)
print("CLASSIFICATION REPORT")
print("="*60)

print(
    classification_report(
        y_test,
        y_pred,
        target_names=label_encoder.classes_
    )
)

# ==========================================================
# Feature Importance
# ==========================================================

importance = pd.DataFrame({

    "Feature": X.columns,

    "Importance": rf.feature_importances_

})

importance = importance.sort_values(
    by="Importance",
    ascending=False
)

print("\n")

print("="*60)
print("FEATURE IMPORTANCE")
print("="*60)

print(importance)

# ==========================================================
# Feature Importance Plot
# ==========================================================

plt.figure(figsize=(8,5))

plt.bar(
    importance["Feature"],
    importance["Importance"]
)

plt.title("Feature Importance")

plt.xlabel("Features")

plt.ylabel("Importance")

plt.xticks(rotation=25)

plt.tight_layout()

plt.show()

# ==========================================================
# Predict New CNC Tool
# ==========================================================

print("\n")

print("="*60)
print("NEW TOOL PREDICTION")
print("="*60)

new_data = pd.DataFrame({

    "Cutting_Speed_m_min":[180],

    "Feed_Rate_mm_rev":[0.25],

    "Depth_of_Cut_mm":[2.5],

    "Spindle_Load_pct":[72],

    "Tool_Vibration_mm_s":[4.3]

})

prediction = rf.predict(new_data)

predicted_class = label_encoder.inverse_transform(prediction)

print("Predicted Tool Condition :", predicted_class[0])

# ==========================================================
# Prediction Probability
# ==========================================================

probability = rf.predict_proba(new_data)

print("\nPrediction Probability")

for cls, prob in zip(label_encoder.classes_, probability[0]):
    print(f"{cls} : {prob*100:.2f}%")

print("\n")
print("="*60)
print("PROJECT COMPLETED SUCCESSFULLY")
print("="*60)