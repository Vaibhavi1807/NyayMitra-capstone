# NyayMitra - Delay Prediction Models

Machine-learning service that predicts two time intervals for Indian court cases:

1. **Days to next hearing** - the original model, trained in `notebooks/04_model_building.ipynb`.
2. **Days to disposal** - the newer model, trained by `src/train_disposal_model.py`.

`src/api.py` returns both in a single response
(`predicted_next_hearing_days` and `predicted_disposal_days`).

## Layout

| Path | Description |
|------|-------------|
| `src/api.py` | FastAPI service exposing `/predict-delay` and `/health` |
| `src/delay_predictor.py` | Inference code for **both** models |
| `src/train_disposal_model.py` | Training script for the disposal model |
| `notebooks/04_model_building.ipynb` | Training notebook for the next-hearing model |
| `models/` | Trained artifacts for **both** models (keep together) |
| `requirements.txt` | Pinned Python dependencies |

## Model artifacts

`models/` holds both sets - they must stay together:

- **Next hearing:** `delay_next_hearing_model.pkl`, `feature_columns.pkl`,
  `model_type.pkl`, `court_pace_lookup.pkl`, `case_type_pace_lookup.pkl`,
  `overall_mean_pace.pkl`, `resid_std.pkl`
- **Disposal:** `delay_disposal_model.json`, `feature_columns_disposal.pkl`,
  `case_type_pace_lookup_disposal.pkl`, `court_pace_lookup_disposal.pkl`,
  `overall_mean_pace_disposal.pkl`, `resid_std_disposal.pkl`,
  `model_type_disposal.pkl`, `numeric_defaults_disposal.pkl`,
  `target_cap_disposal.pkl`, `target_report_disposal.pkl`,
  `disposal_model_status.pkl`

## Usage

```bash
pip install -r requirements.txt
cd src
uvicorn api:app --host 0.0.0.0 --port 8000
```

```bash
curl -X POST http://localhost:8000/predict-delay \
  -H "Content-Type: application/json" \
  -d '{"case_type": "Cri.Appeal", "court": "...", "district": "...", "state": "..."}'
```

## Data

Training data (`data/raw/`, `data/processed/`, `data/disposedata/`, `*.csv`) is
**not** shipped with this repository. See `.gitignore`.
