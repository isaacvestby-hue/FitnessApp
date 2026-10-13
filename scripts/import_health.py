#!/usr/bin/env python3
"""Turn an Apple Health export.xml into a SQL file for the Supabase SQL editor.

Usage:
    python3 scripts/import_health.py path/to/export.xml you@example.com out.sql

The output contains personal health data. Never commit it; .gitignore blocks
import_*.sql for that reason. Run the SQL in Supabase (SQL Editor) after
signing up in the app, so the email matches an existing account. Re-running
is safe: existing rows are updated, not duplicated.
"""
import collections
import sys
import xml.etree.ElementTree as ET

ASLEEP = {
    "HKCategoryValueSleepAnalysisAsleep",
    "HKCategoryValueSleepAnalysisAsleepUnspecified",
    "HKCategoryValueSleepAnalysisAsleepCore",
    "HKCategoryValueSleepAnalysisAsleepDeep",
    "HKCategoryValueSleepAnalysisAsleepREM",
}


def iso(health_date):
    # "2025-07-24 00:14:16 -0600" -> "2025-07-24T00:14:16-06:00"
    d, t, z = health_date.split(" ")
    return f"{d}T{t}{z[:3]}:{z[3:]}"


def hours_between(start, end):
    from datetime import datetime
    fmt = "%Y-%m-%d %H:%M:%S %z"
    return (datetime.strptime(end, fmt) - datetime.strptime(start, fmt)).total_seconds() / 3600


def to_kcal(value, unit):
    return value / 4.184 if unit == "kJ" else value


def to_km(value, unit):
    return {"km": value, "mi": value * 1.609344, "m": value / 1000, "yd": value * 0.0009144}.get(unit, value)


RENAMES = {"TraditionalStrengthTraining": "Strength Training", "FunctionalStrengthTraining": "Functional Strength"}


def activity_name(hk_type):
    name = hk_type.removeprefix("HKWorkoutActivityType")
    if name in RENAMES:
        return RENAMES[name]
    return "".join(" " + c if c.isupper() and i else c for i, c in enumerate(name)).strip()


def parse(path):
    workouts = []
    # per (day, source) sums, so iPhone + Watch double counting can be dropped
    steps = collections.defaultdict(float)
    kcal = collections.defaultdict(float)
    sleep = collections.defaultdict(float)
    resting, hrv = collections.defaultdict(list), collections.defaultdict(list)
    vo2 = {}

    for _, el in ET.iterparse(path, events=("end",)):
        tag = el.tag
        if tag == "Record":
            a = el.attrib
            t, day, src = a.get("type"), a.get("startDate", "")[:10], a.get("sourceName")
            try:
                v = float(a.get("value", "nan"))
            except ValueError:
                v = None
            if t == "HKQuantityTypeIdentifierStepCount":
                steps[(day, src)] += v
            elif t == "HKQuantityTypeIdentifierActiveEnergyBurned":
                kcal[(day, src)] += to_kcal(v, a.get("unit"))
            elif t == "HKQuantityTypeIdentifierRestingHeartRate":
                resting[day].append(v)
            elif t == "HKQuantityTypeIdentifierHeartRateVariabilitySDNN":
                hrv[day].append(v)
            elif t == "HKQuantityTypeIdentifierVO2Max":
                vo2[day] = v
            elif t == "HKCategoryTypeIdentifierSleepAnalysis" and a.get("value") in ASLEEP:
                wake_day = a["endDate"][:10]
                sleep[(wake_day, src)] += hours_between(a["startDate"], a["endDate"])
            el.clear()
        elif tag == "Workout":
            a = el.attrib
            w = {
                "activity": activity_name(a["workoutActivityType"]),
                "started_at": iso(a["startDate"]),
                "ended_at": iso(a["endDate"]),
                "duration_min": float(a["duration"]) * (60 if a.get("durationUnit") == "hr" else 1),
                "active_kcal": None, "distance_km": None, "avg_hr": None, "max_hr": None,
            }
            for s in el.iter("WorkoutStatistics"):
                st, unit = s.get("type", ""), s.get("unit")
                if st.endswith("ActiveEnergyBurned") and s.get("sum"):
                    w["active_kcal"] = to_kcal(float(s.get("sum")), unit)
                elif st.endswith("HeartRate"):
                    w["avg_hr"] = float(s.get("average")) if s.get("average") else None
                    w["max_hr"] = float(s.get("maximum")) if s.get("maximum") else None
                elif "Distance" in st and s.get("sum"):
                    w["distance_km"] = to_km(float(s.get("sum")), unit)
            workouts.append(w)
            el.clear()
        elif tag in ("ActivitySummary", "Correlation"):
            el.clear()

    def best_per_day(per_source):
        out = {}
        for (day, _), v in per_source.items():
            out[day] = max(out.get(day, 0), v)
        return out

    steps_d, kcal_d, sleep_d = best_per_day(steps), best_per_day(kcal), best_per_day(sleep)
    days = sorted(set(steps_d) | set(kcal_d) | set(sleep_d) | set(resting) | set(hrv) | set(vo2))
    mean = lambda xs: sum(xs) / len(xs) if xs else None
    daily = [{
        "day": d,
        "steps": round(steps_d[d]) if d in steps_d else None,
        "active_kcal": kcal_d.get(d),
        "resting_hr": mean(resting.get(d, [])),
        "hrv_ms": mean(hrv.get(d, [])),
        "vo2max": vo2.get(d),
        "sleep_hours": sleep_d.get(d),
    } for d in days]
    return workouts, daily


def lit(v):
    if v is None:
        return "null"
    if isinstance(v, float):
        return f"{v:.3f}"
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def write_sql(workouts, daily, email, out):
    wcols = ["activity", "started_at", "ended_at", "duration_min", "active_kcal", "distance_km", "avg_hr", "max_hr"]
    dcols = ["day", "steps", "active_kcal", "resting_hr", "hrv_ms", "vo2max", "sleep_hours"]
    with open(out, "w") as f:
        f.write("-- Apple Health import. Contains personal data: do not commit or share.\n")
        f.write(f"do $$\ndeclare uid uuid := (select id from auth.users where email = {lit(email)});\nbegin\n")
        f.write("if uid is null then raise exception 'No account with that email. Sign up in the app first.'; end if;\n")
        f.write(f"insert into public.workouts (user_id, {', '.join(wcols)}, source) values\n")
        f.write(",\n".join(f"(uid, {', '.join(lit(w[c]) for c in wcols)}, 'apple_health')" for w in workouts))
        f.write("\non conflict (user_id, started_at, activity) do update set "
                + ", ".join(f"{c} = excluded.{c}" for c in wcols[2:]) + ";\n")
        f.write(f"insert into public.daily_metrics (user_id, {', '.join(dcols)}) values\n")
        f.write(",\n".join(f"(uid, {', '.join(lit(r[c]) for c in dcols)})" for r in daily))
        f.write("\non conflict (user_id, day) do update set "
                + ", ".join(f"{c} = excluded.{c}" for c in dcols[1:]) + ";\n")
        f.write("end $$;\n")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    workouts, daily = parse(sys.argv[1])
    write_sql(workouts, daily, sys.argv[2], sys.argv[3])
    print(f"{len(workouts)} workouts, {len(daily)} days -> {sys.argv[3]}")
