# AI-Based CNC Tool Predictive Maintenance System with Windchill PLM Integration

A responsive React dashboard for CNC tool condition monitoring, predictive maintenance and future Windchill PLM integration. The current frontend uses clearly labeled sample data and a mock prediction service; it does not load or claim results from the Python model until an API is configured.

## Project Layout

The web application lives in `frontend/` so the existing Python scripts, model files and dataset at the project root remain unchanged.

```text
plm_proj/
  GUI.py
  PLM.py
  random_forest_model.pkl
  label_encoder.pkl
  cnc_tool_condition_dataset.csv
  frontend/
    src/data/          Sample tools, alerts, history and chart data
    src/services/      Axios prediction and Windchill service boundaries
    src/Workspace.tsx  Routes, shared demo state and page workflows
```

## Requirements

- Node.js 20.19+ (or 22.12+)
- npm

## Install and Run

From a terminal, in the `frontend` directory:

```powershell
npm install
npm run dev
```

Open the local URL Vite prints, normally `http://localhost:5173/`.

For a production check:

```powershell
npm run build
npm run preview
```

## Demo Behavior

The overview, tool register, prediction workflow, administrator alert center, prediction history, analytics, Windchill configuration and settings are interactive. Demo records and appearance/rule preferences are stored in browser local storage. No Windchill password, access token or email credential is requested or stored.

Predictions default to **Simulation mode**. The mock service returns fabricated class probabilities derived from the submitted machining parameters. Notification delivery and Windchill connectivity are also simulated; no email or PLM workflow is sent. Analytics accuracy and feature-importance values stay unavailable until the backend supplies verified metrics.

## Connect the Python Random Forest

1. Run an authorized FastAPI service separately from the frontend. Keep `random_forest_model.pkl` and `label_encoder.pkl` on the Python server; never copy or load pickle files in React.
2. Implement `POST /api/predict`. The frontend sends a JSON body with `tool_id`, `machine_id`, `cad_document_number`, and the five feature names expected by the trained model:

```json
{
  "tool_id": "T-2048",
  "machine_id": "CNC-04",
  "cad_document_number": "WT-0001842",
  "Cutting_Speed_m_min": 180,
  "Feed_Rate_mm_rev": 0.25,
  "Depth_of_Cut_mm": 2.5,
  "Spindle_Load_pct": 72,
  "Tool_Vibration_mm_s": 4.3
}
```

3. Return this response shape. Probability keys must be the decoded class labels from the backend's `label_encoder`, and values should be floats from 0 to 1. The frontend renders the labels it receives rather than assuming the backend class names.

```json
{
  "prediction_id": "pred-uuid",
  "predicted_condition": "Warning",
  "class_probabilities": {
    "Healthy": 0.12,
    "Warning": 0.68,
    "Worn": 0.16,
    "Failed": 0.04
  },
  "alert_required": false,
  "timestamp": "2026-09-28T10:30:00Z"
}
```

4. Configure the frontend using `frontend/.env.local` (copy `.env.example`):

```dotenv
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_MOCK_DATA=false
```

Restart Vite after changing environment variables. The Axios request is in `src/services/api.ts`. Configure FastAPI CORS for the Vite origin during local development. The backend should own authentication, class/alert policy, model loading, audit persistence and notification delivery.

A minimal prediction handler should construct a one-row Pandas DataFrame with columns in the exact training feature names/order, call `model.predict()` and `model.predict_proba()`, decode the prediction and every `model.classes_` value with `label_encoder.inverse_transform()`, then return the contract above. Load model artifacts once at server startup, not once per request. Keep pickle loading restricted to trusted, access-controlled artifacts.

## Windchill Preparation

The Windchill page holds a project/product container, a separate student workspace, CAD document references and connection status. Its test-connection action is intentionally a simulation. For real access, route authorized REST operations through a secured backend using the college-approved authentication method; do not place shared account credentials in frontend code, `.env` variables prefixed with `VITE_`, or browser storage. Configure the server-side integration for the project-specific container/workspace and enforce the college's access controls.
