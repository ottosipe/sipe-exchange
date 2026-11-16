# Preview testing

Preview builds deploy from pull request branches and connect to the current production PostgreSQL database via Vercel's Preview environment variables.

**Caution:** Any write made in Preview (including registering users, placing trades, or updating positions) affects the live production market and participants. Prefer read-only smoke tests.

The next production release should occur only after review and merge into `main`.
