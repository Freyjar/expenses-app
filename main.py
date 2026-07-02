from fastapi import FastAPI, Request, Response, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel
import psycopg2
import psycopg2.extras
import os
import secrets
from dotenv import load_dotenv
from datetime import date
import bcrypt
from fastapi.middleware.cors import CORSMiddleware
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8081", "https://expenses.freyjar.site"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        port=os.getenv("DB_PORT")
    )

def get_current_user(request: Request):
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT u.id, u.username, u.is_admin 
        FROM sessions s JOIN users u ON s.user_id = u.id
        WHERE s.token = %s
    """, (token,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    return user

def require_admin(user=Depends(get_current_user)):
    if not user["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin only")
    return user

# --- Auth ---

class LoginInput(BaseModel):
    username: str
    password: str

@app.post("/api/login")
async def login(input: LoginInput, response: Response):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM users WHERE username = %s", (input.username,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user or not bcrypt.checkpw(input.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = secrets.token_hex(32)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("INSERT INTO sessions (token, user_id) VALUES (%s, %s)", (token, user["id"]))
    conn.commit()
    cur.close()
    conn.close()

    response.set_cookie("session", token, httponly=True, samesite="lax", max_age=60*60*24*30)
    return {"ok": True}

@app.post("/api/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session")
    if token:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM sessions WHERE token = %s", (token,))
        conn.commit()
        cur.close()
        conn.close()
    response.delete_cookie("session")
    return {"ok": True}

@app.get("/api/me")
async def me(user=Depends(get_current_user)):
    return {"user_id": user["id"], "username": user["username"], "is_admin": user["is_admin"]}

# --- Admin ---

class CreateUserInput(BaseModel):
    username: str
    password: str
    is_admin: bool = False

@app.get("/api/admin/users")
async def list_users(user=Depends(require_admin)):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id, username, is_admin, created_at FROM users ORDER BY created_at ASC")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return list(rows)

@app.post("/api/admin/users")
async def create_user(input: CreateUserInput, user=Depends(require_admin)):
    hashed = bcrypt.hashpw(input.password.encode(), bcrypt.gensalt()).decode()
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users (username, password_hash, is_admin) VALUES (%s, %s, %s) RETURNING id",
            (input.username, hashed, input.is_admin)
        )
        new_id = cur.fetchone()[0]
        conn.commit()
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=400, detail="Username already exists")
    finally:
        cur.close()
        conn.close()
    return {"id": new_id, "username": input.username}

@app.delete("/api/admin/users/{user_id}")
async def delete_user(user_id: int, user=Depends(require_admin)):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM sessions WHERE user_id = %s", (user_id,))
    cur.execute("DELETE FROM expenses WHERE user_id = %s", (user_id,))
    cur.execute("DELETE FROM debts WHERE user_id = %s", (user_id,))
    cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
    conn.commit()
    cur.close()
    conn.close()
    return {"deleted": user_id}

# --- Expenses ---

class ExpenseInput(BaseModel):
    amount: float
    merchant: str
    category: str
    note: str | None = None
    date: str

class NoteUpdate(BaseModel):
    note: str

class DebtInput(BaseModel):
    person: str
    amount: float
    note: str | None = None
    date: str
    type: str = 'lent'

class DebtUpdate(BaseModel):
    amount: float

@app.post("/api/expenses")
async def add_expense(input: ExpenseInput, user=Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO expenses (amount, merchant, category, note, date, status, user_id)
        VALUES (%s, %s, %s, %s, %s, 'done', %s)
        RETURNING id
    """, (input.amount, input.merchant, input.category, input.note or "", input.date, user["id"]))
    expense_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return {"id": expense_id, "amount": input.amount, "merchant": input.merchant,
            "category": input.category, "note": input.note, "date": input.date}

@app.get("/api/expenses")
async def get_expenses(
    limit: int = 100,
    category: str | None = None,
    search: str | None = None,
    range: str = "month",
    date_from: str | None = None,
    date_to: str | None = None,
    user=Depends(get_current_user)
):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if date_from and date_to:
        date_filter = "date BETWEEN %s AND %s"
        date_params = [date_from, date_to]
    elif range == "week":
        date_filter = "DATE_TRUNC('week', date) = DATE_TRUNC('week', CURRENT_DATE)"
        date_params = []
    elif range == "year":
        date_filter = "DATE_TRUNC('year', date) = DATE_TRUNC('year', CURRENT_DATE)"
        date_params = []
    elif range == "all":
        date_filter = "1=1"
        date_params = []
    else:
        date_filter = "DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)"
        date_params = []

    query = f"SELECT * FROM expenses WHERE status='done' AND user_id = %s AND {date_filter}"
    params = [user["id"]] + date_params

    if category:
        query += " AND category = %s"
        params.append(category)
    if search:
        query += " AND (LOWER(merchant) LIKE %s OR LOWER(note) LIKE %s)"
        params.append(f"%{search.lower()}%")
        params.append(f"%{search.lower()}%")

    query += " ORDER BY date DESC, created_at DESC LIMIT %s"
    params.append(limit)

    cur.execute(query, params)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return list(rows)

@app.get("/api/summary")
async def get_summary(
    range: str = "month",
    date_from: str | None = None,
    date_to: str | None = None,
    user=Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Build date filter
    if date_from and date_to:
        date_filter = "date BETWEEN %s AND %s"
        date_params = [date_from, date_to]
    elif range == "week":
        date_filter = "DATE_TRUNC('week', date) = DATE_TRUNC('week', CURRENT_DATE)"
        date_params = []
    elif range == "year":
        date_filter = "DATE_TRUNC('year', date) = DATE_TRUNC('year', CURRENT_DATE)"
        date_params = []
    else:  # month (default)
        date_filter = "DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)"
        date_params = []

    cur.execute(f"""
        SELECT category, SUM(amount) as total
        FROM expenses
        WHERE {date_filter} AND status = 'done' AND user_id = %s
        GROUP BY category ORDER BY total DESC
    """, date_params + [user["id"]])
    by_category = cur.fetchall()

    cur.execute(f"""
        SELECT
            (SELECT COALESCE(SUM(amount), 0) FROM expenses
             WHERE {date_filter} AND status = 'done' AND user_id = %s)
            +
            (SELECT COALESCE(SUM(original_amount), 0) FROM debts
             WHERE {date_filter} AND type = 'owe' AND user_id = %s)
        AS total
    """, date_params + [user["id"]] + date_params + [user["id"]])
    monthly_total = cur.fetchone()
    cur.close()
    conn.close()
    return {"by_category": list(by_category), "monthly_total": monthly_total["total"] or 0}

@app.get("/api/stats")
async def get_stats(
    range: str = "month",
    date_from: str | None = None,
    date_to: str | None = None,
    user=Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if date_from and date_to:
        date_filter = "date BETWEEN %s AND %s"
        date_params = [date_from, date_to]
    elif range == "week":
        date_filter = "DATE_TRUNC('week', date) = DATE_TRUNC('week', CURRENT_DATE)"
        date_params = []
    elif range == "year":
        date_filter = "DATE_TRUNC('year', date) = DATE_TRUNC('year', CURRENT_DATE)"
        date_params = []
    else:
        date_filter = "DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)"
        date_params = []

    cur.execute(f"""
        SELECT DATE(date) as day, SUM(amount) as total
        FROM expenses
        WHERE {date_filter} AND status = 'done' AND user_id = %s
        GROUP BY DATE(date) ORDER BY day ASC
    """, date_params + [user["id"]])
    daily = cur.fetchall()

    cur.execute(f"""
        SELECT AVG(weekly_total) as weekly_avg FROM (
            SELECT DATE_TRUNC('week', date) as week, SUM(amount) as weekly_total
            FROM expenses
            WHERE {date_filter} AND status = 'done' AND user_id = %s
            GROUP BY week
        ) w
    """, date_params + [user["id"]])
    weekly_avg = cur.fetchone()

    cur.execute("""
        SELECT
            (SELECT COALESCE(SUM(amount), 0) FROM expenses
             WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
             AND status = 'done' AND user_id = %s)
            +
            (SELECT COALESCE(SUM(original_amount), 0) FROM debts
             WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
             AND type = 'owe' AND user_id = %s)
        AS total
    """, (user["id"], user["id"]))
    last_month = cur.fetchone()

    cur.execute(f"""
        SELECT
            (SELECT COALESCE(SUM(amount), 0) FROM expenses
             WHERE {date_filter} AND status = 'done' AND user_id = %s)
            +
            (SELECT COALESCE(SUM(original_amount), 0) FROM debts
             WHERE {date_filter} AND type = 'owe' AND user_id = %s)
        AS total
    """, date_params + [user["id"]] + date_params + [user["id"]])
    this_month = cur.fetchone()

    cur.close()
    conn.close()
    return {
        "daily": list(daily),
        "weekly_avg": float(weekly_avg["weekly_avg"] or 0),
        "last_month": float(last_month["total"] or 0),
        "this_month": float(this_month["total"] or 0)
    }

@app.patch("/api/expenses/{expense_id}/note")
async def update_note(expense_id: int, body: NoteUpdate, user=Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE expenses SET note = %s WHERE id = %s AND user_id = %s",
                (body.note, expense_id, user["id"]))
    conn.commit()
    cur.close()
    conn.close()
    return {"updated": expense_id}

@app.delete("/api/expenses/{expense_id}")
async def delete_expense(expense_id: int, user=Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM expenses WHERE id = %s AND user_id = %s", (expense_id, user["id"]))
    conn.commit()
    cur.close()
    conn.close()
    return {"deleted": expense_id}

@app.post("/api/debts")
async def add_debt(input: DebtInput, user=Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO debts (person, amount, original_amount, note, date, type, user_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
    """, (input.person, input.amount, input.amount, input.note or "", input.date, input.type, user["id"]))
    debt_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return {"id": debt_id, "person": input.person, "amount": input.amount}

@app.get("/api/debts")
async def get_debts(user=Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM debts WHERE user_id = %s ORDER BY status ASC, date DESC", (user["id"],))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return list(rows)

@app.patch("/api/debts/{debt_id}")
async def update_debt(debt_id: int, body: DebtUpdate, user=Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    status = 'paid' if body.amount <= 0 else 'unpaid'
    if status == 'paid':
        cur.execute("UPDATE debts SET amount=%s, status=%s, paid_at=NOW() WHERE id=%s AND user_id=%s",
                    (0, status, debt_id, user["id"]))
    else:
        cur.execute("UPDATE debts SET amount=%s, status=%s, paid_at=NULL WHERE id=%s AND user_id=%s",
                    (max(0, body.amount), status, debt_id, user["id"]))
    conn.commit()
    cur.close()
    conn.close()
    return {"updated": debt_id, "status": status}

@app.delete("/api/debts/{debt_id}")
async def delete_debt(debt_id: int, user=Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM debts WHERE id = %s AND user_id = %s", (debt_id, user["id"]))
    conn.commit()
    cur.close()
    conn.close()
    return {"deleted": debt_id}

# --- Pages ---
@app.get("/")
async def index(request: Request):
    token = request.cookies.get("session")
    if not token:
        return RedirectResponse("/login")
    return FileResponse("static/index.html")

@app.get("/dashboard")
async def dashboard(request: Request):
    token = request.cookies.get("session")
    if not token:
        return RedirectResponse("/login")
    return FileResponse("static/dashboard.html")

@app.get("/debts")
async def debts_page(request: Request):
    token = request.cookies.get("session")
    if not token:
        return RedirectResponse("/login")
    return FileResponse("static/debts.html")

@app.get("/calculator")
async def calculator_page(request: Request):
    token = request.cookies.get("session")
    if not token:
        return RedirectResponse("/login")
    return FileResponse("static/calculator.html")

@app.get("/admin")
async def admin_page(request: Request):
    token = request.cookies.get("session")
    if not token:
        return RedirectResponse("/login")
    return FileResponse("static/admin.html")

@app.get("/login")
async def login_page():
    return FileResponse("static/login.html")

app.mount("/static", StaticFiles(directory="static"), name="static")
