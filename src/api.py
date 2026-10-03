
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from delay_predictor import predict_delay, predict_disposal

app = FastAPI(title="NyayMitra Delay Prediction Service")

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

class CaseInput(BaseModel):
    case_type: str
    court: str
    district: str
    state: str


@app.post("/predict-delay")
@limiter.limit("30/minute")
def predict_delay_endpoint(request: Request, case: CaseInput):
    try:
        result = predict_delay(case.case_type, case.court, case.district, case.state)
    except Exception as e:
        print(f"Internal error: {e}")
        return JSONResponse(status_code=500, content={"error": "Could not generate a prediction for this case."})

    # Both models feed the same "Delay Prediction" action card, so return both
    # predictions in one response.
    result["predicted_next_hearing_days"] = result.get("predicted_delay_days")

    try:
        disposal = predict_disposal(case.case_type, case.court, case.district, case.state)
    except Exception as e:
        # A disposal-model failure must never take down the next-hearing prediction.
        print(f"Disposal prediction error: {e}")
        disposal = None

    if disposal is None:
        # Model not trained (fewer than 25 usable disposed cases).
        result["predicted_disposal_days"] = None
        result["disposal_model_status"] = "not_trained"
    else:
        result["predicted_disposal_days"] = disposal["predicted_disposal_days"]
        result["disposal_model_status"] = "trained"
        result["disposal_explanation"] = disposal["explanation"]
        result["disposal_confidence_label"] = disposal["confidence_label"]
        result["disposal_model_version"] = disposal["model_version"]

    return result


@app.get("/health")
def health():
    return {"status": "ok"}
