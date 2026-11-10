# FreshMart forecasting service

The forecasting service is optional. The POS continues to work without it.

## Data sent by the backend

The Express API sends the following JSON to `ML_FORECAST_URL`:

- `history`: daily sales rows with `date`, `productId`, `name` and `quantity`
- `inventory`: current stock and reorder level for each product

The current FastAPI service exposes `POST /forecast` and expects that request shape.

## Forecast response

The service returns `forecast_date`, `total_products` and a `predictions` array. Each prediction contains:

- `product_id`
- `product_name`
- `predicted_quantity`
- `current_stock`
- `supplier_lead_time_days`
- `safety_stock_days`
- `reorder_point`
- `suggested_restock`

The current reorder suggestion uses three days of supplier lead time and two days of safety stock. Review these assumptions for the shop before relying on the suggested quantities.

## Train and run

Train the model from the shop's recorded sales after at least ten days of history are available:

```bash
cd freshmart-ml
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python train_ml.py
uvicorn ml_api:app --host 0.0.0.0 --port 8000
```

Set `ML_FORECAST_URL` in `server/.env` to the service's `/forecast` endpoint. Set `ML_FORECAST_TOKEN` if the service is protected by a bearer token.

Forecasts are estimates, not purchase orders. Review stock levels, supplier lead times, minimum order quantities and unusual sales before ordering.
