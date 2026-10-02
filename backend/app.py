from __future__ import annotations

import os
import sqlite3
from datetime import date
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
DATABASE = Path(os.environ.get("CARNET_ESSENCE_DB", ROOT / "carnet_essence.db"))
DATABASE.parent.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="La petite jauge")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


class SettingsInput(BaseModel):
    consumption: Annotated[float, Field(gt=0, le=30)]
    fuel_price: Annotated[float, Field(gt=0, le=20)]


class TripInput(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=40)]
    distance_km: Annotated[float, Field(gt=0, le=1000)]


class OneOffTripInput(BaseModel):
    day: date
    title: Annotated[str, Field(min_length=1, max_length=40)]
    distance_km: Annotated[float, Field(gt=0, le=1000)]


class DayTripsInput(BaseModel):
    trip_ids: list[int]


class ApplyTripInput(BaseModel):
    days: Annotated[list[date], Field(min_length=1, max_length=62)]
    trip_id: Annotated[int, Field(gt=0)]


class RecurrenceInput(BaseModel):
    trip_id: Annotated[int, Field(gt=0)]
    weekdays: Annotated[list[int], Field(max_length=7)]


class ApplyWeekInput(BaseModel):
    week_start: date


class RefuelInput(BaseModel):
    date: date
    amount: Annotated[float, Field(gt=0, le=1000)]
    price_per_liter: Annotated[float, Field(gt=0, le=20)]


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database() -> None:
    with connect() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                consumption REAL NOT NULL,
                fuel_price REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS trips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                distance_km REAL NOT NULL,
                color TEXT NOT NULL,
                is_default INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS day_trips (
                day TEXT NOT NULL,
                trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
                PRIMARY KEY (day, trip_id)
            );
            CREATE TABLE IF NOT EXISTS one_off_trips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                day TEXT NOT NULL,
                title TEXT NOT NULL,
                distance_km REAL NOT NULL,
                color TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS refuels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                day TEXT NOT NULL,
                amount REAL NOT NULL,
                price_per_liter REAL
            );
            CREATE TABLE IF NOT EXISTS recurring_trips (
                trip_id INTEGER PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
                weekday_mask INTEGER NOT NULL DEFAULT 0 CHECK (weekday_mask >= 0 AND weekday_mask <= 127)
            );
            """
        )
        refuel_columns = {row["name"] for row in db.execute("PRAGMA table_info(refuels)")}
        if "price_per_liter" not in refuel_columns:
            db.execute("ALTER TABLE refuels ADD COLUMN price_per_liter REAL")
        db.execute(
            "INSERT OR IGNORE INTO settings (id, consumption, fuel_price) VALUES (1, 3.1, 2.4)"
        )
        if db.execute("SELECT COUNT(*) FROM trips").fetchone()[0] == 0:
            db.executemany(
                "INSERT INTO trips (title, distance_km, color, is_default) VALUES (?, ?, ?, 1)",
                [
                    ("Lycée", 24, "#e78565"),
                    ("Basic Fit", 6, "#76a997"),
                    ("Mamie", 16, "#8c8fc1"),
                ],
            )


initialize_database()


def parse_day(day: str) -> str:
    try:
        return date.fromisoformat(day).isoformat()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Date invalide") from exc


@app.get("/api/state")
def get_state() -> dict:
    with connect() as db:
        settings = dict(db.execute("SELECT consumption, fuel_price FROM settings WHERE id = 1").fetchone())
        trips = [dict(row) for row in db.execute("SELECT id, title, distance_km, color, is_default FROM trips ORDER BY id")]
        day_trips = [
            dict(row)
            for row in db.execute(
                "SELECT day, trip_id FROM day_trips ORDER BY day, trip_id"
            )
        ]
        refuels = [
            dict(row)
            for row in db.execute("SELECT id, day, amount, price_per_liter FROM refuels ORDER BY day DESC, id DESC")
        ]
        recurring_trips = [
            {"trip_id": row["trip_id"], "weekdays": [day for day in range(7) if row["weekday_mask"] & (1 << day)]}
            for row in db.execute("SELECT trip_id, weekday_mask FROM recurring_trips")
        ]
        one_off_trips = [
            dict(row)
            for row in db.execute("SELECT id, day, title, distance_km, color FROM one_off_trips ORDER BY day, id")
        ]
    return {"settings": settings, "trips": trips, "day_trips": day_trips, "refuels": refuels, "recurring_trips": recurring_trips, "one_off_trips": one_off_trips}


@app.put("/api/settings")
def update_settings(data: SettingsInput) -> dict:
    with connect() as db:
        db.execute(
            "UPDATE settings SET consumption = ?, fuel_price = ? WHERE id = 1",
            (data.consumption, data.fuel_price),
        )
    return {"consumption": data.consumption, "fuel_price": data.fuel_price}


@app.post("/api/trips")
def create_trip(data: TripInput) -> dict:
    title = data.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Le titre est obligatoire")
    palette = ["#d6a04d", "#6d9fb0", "#ca7890", "#82965e", "#9a81ae"]
    with connect() as db:
        color_index = db.execute("SELECT COUNT(*) FROM trips").fetchone()[0] % len(palette)
        cursor = db.execute(
            "INSERT INTO trips (title, distance_km, color) VALUES (?, ?, ?)",
            (title, data.distance_km, palette[color_index]),
        )
        trip_id = cursor.lastrowid
    return {"id": trip_id, "title": title, "distance_km": data.distance_km, "color": palette[color_index], "is_default": 0}


@app.delete("/api/trips/{trip_id}")
def delete_trip(trip_id: int) -> dict:
    with connect() as db:
        trip = db.execute("SELECT is_default FROM trips WHERE id = ?", (trip_id,)).fetchone()
        if trip is None:
            raise HTTPException(status_code=404, detail="Trajet introuvable")
        if trip["is_default"]:
            raise HTTPException(status_code=400, detail="Les trajets prédéfinis ne peuvent pas être supprimés")
        db.execute("DELETE FROM trips WHERE id = ?", (trip_id,))
    return {"ok": True}


@app.put("/api/days/{day}/trips")
def set_day_trips(day: str, data: DayTripsInput) -> dict:
    day = parse_day(day)
    trip_ids = list(dict.fromkeys(data.trip_ids))
    with connect() as db:
        if trip_ids:
            placeholders = ",".join("?" for _ in trip_ids)
            count = db.execute(
                f"SELECT COUNT(*) FROM trips WHERE id IN ({placeholders})", trip_ids
            ).fetchone()[0]
            if count != len(trip_ids):
                raise HTTPException(status_code=404, detail="Un trajet sélectionné n'existe plus")
        db.execute("DELETE FROM day_trips WHERE day = ?", (day,))
        db.executemany(
            "INSERT INTO day_trips (day, trip_id) VALUES (?, ?)",
            [(day, trip_id) for trip_id in trip_ids],
        )
    return {"day": day, "trip_ids": trip_ids}


@app.put("/api/days/trips")
def apply_trip_to_days(data: ApplyTripInput) -> dict:
    days = list(dict.fromkeys(day.isoformat() for day in data.days))
    with connect() as db:
        trip = db.execute("SELECT id FROM trips WHERE id = ?", (data.trip_id,)).fetchone()
        if trip is None:
            raise HTTPException(status_code=404, detail="Trajet introuvable")
        db.executemany(
            "INSERT OR IGNORE INTO day_trips (day, trip_id) VALUES (?, ?)",
            [(day, data.trip_id) for day in days],
        )
    return {"days": days, "trip_id": data.trip_id}


@app.post("/api/one-off-trips")
def create_one_off_trip(data: OneOffTripInput) -> dict:
    title = data.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Le titre est obligatoire")
    palette = ["#d6a04d", "#6d9fb0", "#ca7890", "#82965e", "#9a81ae"]
    with connect() as db:
        color_index = db.execute("SELECT COUNT(*) FROM one_off_trips").fetchone()[0] % len(palette)
        cursor = db.execute(
            "INSERT INTO one_off_trips (day, title, distance_km, color) VALUES (?, ?, ?, ?)",
            (data.day.isoformat(), title, data.distance_km, palette[color_index]),
        )
        trip_id = cursor.lastrowid
    return {"id": trip_id, "day": data.day.isoformat(), "title": title, "distance_km": data.distance_km, "color": palette[color_index]}


@app.delete("/api/one-off-trips/{trip_id}")
def delete_one_off_trip(trip_id: int) -> dict:
    with connect() as db:
        cursor = db.execute("DELETE FROM one_off_trips WHERE id = ?", (trip_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Trajet unique introuvable")
    return {"ok": True}


@app.put("/api/recurrences")
def save_recurrence(data: RecurrenceInput) -> dict:
    weekdays = list(dict.fromkeys(data.weekdays))
    if any(day < 0 or day > 6 for day in weekdays):
        raise HTTPException(status_code=422, detail="Les jours doivent être compris entre 0 et 6")
    weekday_mask = sum(1 << day for day in weekdays)
    with connect() as db:
        if db.execute("SELECT id FROM trips WHERE id = ?", (data.trip_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Trajet introuvable")
        if weekday_mask:
            db.execute(
                "INSERT INTO recurring_trips (trip_id, weekday_mask) VALUES (?, ?) "
                "ON CONFLICT(trip_id) DO UPDATE SET weekday_mask = excluded.weekday_mask",
                (data.trip_id, weekday_mask),
            )
        else:
            db.execute("DELETE FROM recurring_trips WHERE trip_id = ?", (data.trip_id,))
    return {"trip_id": data.trip_id, "weekdays": weekdays}


@app.post("/api/recurrences/apply-week")
def apply_recurrences_to_week(data: ApplyWeekInput) -> dict:
    if data.week_start.weekday() != 0:
        raise HTTPException(status_code=422, detail="La semaine doit commencer un lundi")
    with connect() as db:
        rules = db.execute("SELECT trip_id, weekday_mask FROM recurring_trips WHERE weekday_mask != 0").fetchall()
        entries = [
            ((data.week_start.fromordinal(data.week_start.toordinal() + weekday)).isoformat(), rule["trip_id"])
            for rule in rules
            for weekday in range(7)
            if rule["weekday_mask"] & (1 << weekday)
        ]
        before = db.total_changes
        db.executemany("INSERT OR IGNORE INTO day_trips (day, trip_id) VALUES (?, ?)", entries)
        inserted = db.total_changes - before
    return {"week_start": data.week_start.isoformat(), "days_updated": inserted}


@app.post("/api/refuels")
def create_refuel(data: RefuelInput) -> dict:
    with connect() as db:
        cursor = db.execute(
            "INSERT INTO refuels (day, amount, price_per_liter) VALUES (?, ?, ?)",
            (data.date.isoformat(), data.amount, data.price_per_liter),
        )
        refuel_id = cursor.lastrowid
    return {
        "id": refuel_id,
        "day": data.date.isoformat(),
        "amount": data.amount,
        "price_per_liter": data.price_per_liter,
    }


@app.delete("/api/refuels/{refuel_id}")
def delete_refuel(refuel_id: int) -> dict:
    with connect() as db:
        cursor = db.execute("DELETE FROM refuels WHERE id = ?", (refuel_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Plein introuvable")
    return {"ok": True}


FRONTEND_DIST = ROOT / "dist"
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
