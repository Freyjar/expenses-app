import bcrypt
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

print("=== Create Admin User ===")
username = input("Username: ")
password = input("Password: ")

hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

conn = psycopg2.connect(
    host=os.getenv("DB_HOST"),
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    port=os.getenv("DB_PORT")
)
cur = conn.cursor()
try:
    cur.execute(
        "INSERT INTO users (username, password_hash, is_admin) VALUES (%s, %s, TRUE)",
        (username, hashed)
    )
    conn.commit()
    print(f"✅ Admin user '{username}' created! Go to http://localhost:8000/login")
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    cur.close()
    conn.close()
