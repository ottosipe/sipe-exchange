# Sipe Exchange

A play-money prediction market for Baby Sipe's arrival date and sex.

Live site: https://sipe.exchange

## Structure

- `index.html`: browser app (HTML/CSS/JavaScript)
- `style.css`: application styles
- `app-part*.js`: browser logic, split from the original inline script at top-level JavaScript statement boundaries
- `pricing.js`: LMSR market-maker pricing
- `api/`: Node.js serverless routes on Vercel
- `how-it-works/index.html`: explanation of market contracts

## Running and deploying

Requires Node.js 20+ and a PostgreSQL database. Install dependencies with `npm install`. Configure `POSTGRES_URL` or `DATABASE_URL` through Vercel environment settings. Never commit credentials.

The `vercel.json` configuration copies the static HTML, styles, and JavaScript into `public/` during builds, while keeping `api/` as serverless functions.

The current production deployment is managed separately until this Git repository is connected to the existing Vercel project.

## Contract types

- ON OR BEFORE: includes the selected date and all earlier dates
- EXACT: selected date only
- ON OR AFTER: includes the selected date and all later dates

Winning shares pay one Sipe Point (§) each.

This public repository contains application source, but not production database rows, player records, live trades, session tokens, or environment variables.
