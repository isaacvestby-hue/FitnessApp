# Fitness

A personal, all-in-one fitness tracker that installs on an iPhone home screen:
morning weigh-ins, workouts, Apple Watch history, and (coming next) lifts and food.

- **App:** React + Vite, deployed to GitHub Pages by `.github/workflows/deploy.yml`
- **Data:** Supabase. Run `supabase/schema.sql` once in the SQL editor. Every table
  uses row level security, so each account only sees its own rows.
- **Apple Health import:** `python3 scripts/import_health.py export.xml you@email out.sql`,
  then run `out.sql` in the Supabase SQL editor.

This repo is public and holds code only. Health exports and generated SQL are
git-ignored and must never be committed.
