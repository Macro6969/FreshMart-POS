
from pathlib import Path
import math

import joblib
import pandas as pd

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "sales_forecast_model.pkl"

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model not found at {MODEL_PATH}. Run train_ml.py first."
    )

model = joblib.load(MODEL_PATH)

app = FastAPI(
    title="FreshMart Demand Forecast API",
    description="Predict product demand using machine learning",
    version="1.0"
)


class PredictionInput(BaseModel):
    productId: int
    lag_1: float = Field(ge=0)
    lag_7: float = Field(ge=0)
    rolling_mean_7: float = Field(ge=0)
    day_of_week: int = Field(ge=0, le=6)
    month: int = Field(ge=1, le=12)


class HistoryRow(BaseModel):
    date: str
    productId: int
    name: str
    quantity: float


class InventoryRow(BaseModel):
    productId: int
    name: str
    stock: int
    reorderLevel: int


class ForecastInput(BaseModel):
    history: list[HistoryRow]
    inventory: list[InventoryRow]


@app.get("/")
def home():
    return {
        "message": "FreshMart ML API is running!"
    }


@app.post("/predict")
def predict(data: PredictionInput):
    try:
        input_data = pd.DataFrame([{
            "productId": data.productId,
            "lag_1": data.lag_1,
            "lag_7": data.lag_7,
            "rolling_mean_7": data.rolling_mean_7,
            "day_of_week": data.day_of_week,
            "month": data.month
        }])

        prediction = float(model.predict(input_data)[0])

        return {
            "product_id": data.productId,
            "predicted_quantity": round(max(0, prediction), 2)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/forecast")
def forecast(data: ForecastInput):
    try:
        if not data.history:
            raise HTTPException(
                status_code=400,
                detail="Sales history is empty"
            )

        df = pd.DataFrame([
            row.model_dump() for row in data.history
        ])

        df["date"] = pd.to_datetime(df["date"]).dt.normalize()

        df = (
            df.groupby(["productId", "date"], as_index=False)
            .agg({
                "quantity": "sum",
                "name": "last"
            })
        )

        all_dates = pd.date_range(
            start=df["date"].min(),
            end=df["date"].max(),
            freq="D"
        )

        forecast_date = all_dates[-1] + pd.Timedelta(days=1)

        inventory_map = {
            item.productId: item
            for item in data.inventory
        }

        results = []

        for product_id, group in df.groupby("productId"):
            quantities = (
                group.set_index("date")["quantity"]
                .reindex(all_dates, fill_value=0)
                .astype(float)
            )

            if len(quantities) < 7:
                continue

            input_data = pd.DataFrame([{
                "productId": int(product_id),
                "lag_1": float(quantities.iloc[-1]),
                "lag_7": float(quantities.iloc[-7]),
                "rolling_mean_7": float(quantities.iloc[-7:].mean()),
                "day_of_week": forecast_date.day_of_week,
                "month": forecast_date.month
            }])

            prediction = float(model.predict(input_data)[0])
            prediction = max(0, prediction)

            inventory_item = inventory_map.get(int(product_id))

            current_stock = (
                inventory_item.stock
                if inventory_item else 0
            )

            product_name = group.iloc[-1]["name"]

            
            supplier_lead_time = 3
            safety_stock_days = 2

            reorder_point = math.ceil(
                prediction * (supplier_lead_time + safety_stock_days)
            )

            suggested_order = max(
                0,
                reorder_point - current_stock
            )

            results.append({
                "product_id": int(product_id),
                "product_name": product_name,
                "predicted_quantity": round(prediction, 2),
                "current_stock": current_stock,
                "supplier_lead_time_days": supplier_lead_time,
                "safety_stock_days": safety_stock_days,
                "reorder_point": reorder_point,
                "suggested_restock": suggested_order
            })


        return {
            "configured": True,
            "forecast_date": forecast_date.date().isoformat(),
            "total_products": len(results),
            "predictions": results
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
