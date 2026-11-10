
from pathlib import Path
import sqlite3
import joblib
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR.parent / "server" / "data" / "freshmart.sqlite"
MODEL_PATH = BASE_DIR / "sales_forecast_model.pkl"

conn = sqlite3.connect(DB_PATH)

query = """
SELECT
    date(s.created_at) AS date,
    si.product_id AS productId,
    si.name AS productName,
    SUM(si.quantity) AS quantity
FROM sales s
JOIN sale_items si ON si.sale_id = s.id
GROUP BY date(s.created_at), si.product_id, si.name
ORDER BY date
"""

raw_df = pd.read_sql_query(query, conn)
conn.close()

if raw_df.empty:
    raise ValueError("No synthetic sales data found.")

raw_df["date"] = pd.to_datetime(raw_df["date"])

all_dates = pd.date_range(
    start=raw_df["date"].min(),
    end=raw_df["date"].max(),
    freq="D"
)

product_names = (
    raw_df.groupby("productId")["productName"]
    .last()
    .to_dict()
)

daily_data = []

for product_id, group in raw_df.groupby("productId"):
    daily_sales = (
        group.groupby("date")["quantity"]
        .sum()
        .reindex(all_dates, fill_value=0)
    )

    for date, quantity in daily_sales.items():
        daily_data.append({
            "date": date,
            "productId": int(product_id),
            "productName": product_names[product_id],
            "quantity": float(quantity)
        })

df = pd.DataFrame(daily_data)

df = df.sort_values(
    ["productId", "date"]
).reset_index(drop=True)

grouped = df.groupby("productId")["quantity"]

df["lag_1"] = grouped.shift(1)
df["lag_7"] = grouped.shift(7)

df["rolling_mean_7"] = grouped.transform(
    lambda x: x.shift(1).rolling(7).mean()
)

df["day_of_week"] = df["date"].dt.day_of_week
df["month"] = df["date"].dt.month

df = df.dropna().copy()

unique_dates = sorted(df["date"].unique())

if len(unique_dates) < 10:
    raise ValueError("At least 10 days of sales history are required before training.")

split_index = int(len(unique_dates) * 0.8)
split_date = unique_dates[split_index]

train_df = df[df["date"] < split_date].copy()
test_df = df[df["date"] >= split_date].copy()

features = [
    "productId",
    "lag_1",
    "lag_7",
    "rolling_mean_7",
    "day_of_week",
    "month"
]

X_train = train_df[features]
X_test = test_df[features]

y_train = train_df["quantity"]
y_test = test_df["quantity"]

preprocessor = ColumnTransformer(
    transformers=[
        (
            "product",
            OneHotEncoder(handle_unknown="ignore"),
            ["productId"]
        ),
        (
            "numbers",
            "passthrough",
            [
                "lag_1",
                "lag_7",
                "rolling_mean_7",
                "day_of_week",
                "month"
            ]
        )
    ]
)

model = Pipeline([
    ("preprocessor", preprocessor),
    ("regressor", LinearRegression())
])

model.fit(X_train, y_train)

predictions = model.predict(X_test)
predictions = predictions.clip(min=0)

mae = mean_absolute_error(y_test, predictions)

baseline_predictions = test_df["lag_1"].clip(lower=0)

baseline_mae = mean_absolute_error(
    y_test,
    baseline_predictions
)

print("Total products:", df["productId"].nunique())
print("Total daily records:", len(df))
print("Training rows:", len(train_df))
print("Testing rows:", len(test_df))
print("Test starts from:", split_date)
print(f"Model MAE: {mae:.2f}")
print(f"Baseline MAE: {baseline_mae:.2f}")

joblib.dump(model, MODEL_PATH)

print("Model saved:", MODEL_PATH)
