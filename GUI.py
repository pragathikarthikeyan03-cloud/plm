
import tkinter as tk

print("GUI PROGRAM STARTED")
from tkinter import ttk, messagebox
from pathlib import Path
from datetime import datetime
import csv
import joblib
import pandas as pd

# Load saved model
BASE_DIR = Path(__file__).resolve().parent

model = joblib.load(BASE_DIR / "random_forest_model.pkl")
encoder = joblib.load(BASE_DIR / "label_encoder.pkl")

features = [
    "Cutting_Speed_m_min",
    "Feed_Rate_mm_rev",
    "Depth_of_Cut_mm",
    "Spindle_Load_pct",
    "Tool_Vibration_mm_s"
]

# Change these to match your actual dataset labels
alert_classes = {"Warning", "Worn", "Critical", "Failure"}

root = tk.Tk()
root.title("AI CNC Tool Predictive Maintenance")
root.geometry("650x650")

tk.Label(
    root,
    text="CNC TOOL HEALTH MONITOR",
    font=("Arial", 19, "bold"),
    fg="#174A82"
).pack(pady=20)

tk.Label(
    root,
    text="AI-Based Predictive Failure Analysis",
    font=("Arial", 12)
).pack()

frame = ttk.LabelFrame(
    root,
    text="Machining Parameters",
    padding=20
)
frame.pack(fill="x", padx=30, pady=20)

labels = [
    "Cutting Speed (m/min)",
    "Feed Rate (mm/rev)",
    "Depth of Cut (mm)",
    "Spindle Load (%)",
    "Tool Vibration (mm/s)"
]

defaults = ["180", "0.25", "2.5", "72", "4.3"]

entries = {}

for i, feature in enumerate(features):
    ttk.Label(
        frame,
        text=labels[i]
    ).grid(row=i, column=0, padx=10, pady=10)

    entry = ttk.Entry(frame, width=25)
    entry.insert(0, defaults[i])
    entry.grid(row=i, column=1, padx=10, pady=10)

    entries[feature] = entry

result_label = tk.Label(
    root,
    text="Tool Condition: Not Predicted",
    font=("Arial", 15, "bold")
)
result_label.pack(pady=10)

probability_label = tk.Label(
    root,
    text="Prediction probabilities will appear here.",
    font=("Arial", 11),
    justify="left"
)
probability_label.pack(pady=10)

status_label = tk.Label(
    root,
    text="Windchill: Simulation Mode",
    fg="orange"
)
status_label.pack(pady=10)


def predict_tool():
    try:
        values = [
            float(entries[f].get())
            for f in features
        ]

        if any(v < 0 for v in values):
            raise ValueError(
                "Parameters cannot be negative."
            )

        if values[3] > 100:
            raise ValueError(
                "Spindle load must not exceed 100%."
            )

        data = pd.DataFrame(
            [values],
            columns=features
        )

        prediction = model.predict(data)
        condition = encoder.inverse_transform(
            prediction
        )[0]

        probabilities = model.predict_proba(data)[0]

        result_label.config(
            text=f"Tool Condition: {condition}"
        )

        probability_text = "\n".join(
            f"{encoder.inverse_transform([cls])[0]}: "
            f"{prob * 100:.2f}%"
            for cls, prob in zip(
                model.classes_,
                probabilities
            )
        )

        probability_label.config(
            text=probability_text
        )

        is_alert = str(condition).lower() in {
            c.lower() for c in alert_classes
        }

        timestamp = datetime.now().isoformat(
            timespec="seconds"
        )

        log_path = BASE_DIR / "prediction_history.csv"
        new_file = not log_path.exists()

        with open(
            log_path,
            "a",
            newline="",
            encoding="utf-8"
        ) as file:
            writer = csv.writer(file)

            if new_file:
                writer.writerow(
                    ["Timestamp"]
                    + features
                    + ["Condition", "Alert"]
                )

            writer.writerow(
                [timestamp]
                + values
                + [condition, is_alert]
            )

        if is_alert:
            status_label.config(
                text="Maintenance Alert Generated (Simulation)",
                fg="red"
            )

            messagebox.showwarning(
                "Maintenance Alert",
                f"Predicted tool condition: {condition}\n"
                "Administrator notification simulated."
            )
        else:
            status_label.config(
                text="No Maintenance Alert",
                fg="green"
            )

    except ValueError as error:
        messagebox.showerror(
            "Invalid Input",
            str(error)
        )

    except Exception as error:
        messagebox.showerror(
            "Prediction Error",
            str(error)
        )


ttk.Button(
    root,
    text="PREDICT TOOL CONDITION",
    command=predict_tool
).pack(pady=15)

print("STARTING TKINTER WINDOW")
root.mainloop()