os.makedirs("model", exist_ok=True)
conn = sqlite3.connect(
    "../kirana-app/server/data/freshmart.sqlite"
)