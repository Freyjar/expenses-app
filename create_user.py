import bcrypt
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

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
cur.execute("INSERT INTO users (username, password_hash) VALUES (%s, %s)", (username, hashed))
conn.commit()
cur.close()
conn.close()
print(f"User '{username}' created!")
