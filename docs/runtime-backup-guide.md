# Runtime Backup Guide

Keep `schema.sql` for structure and `data.sql` for base demo records.
Store newly generated runtime data in `sql/runtime-backup.sql`.

Backup current MySQL data:

```powershell
powershell -ExecutionPolicy Bypass -File .\sql\backup-runtime.ps1
```

Restore current snapshot:

```powershell
powershell -ExecutionPolicy Bypass -File .\sql\restore-runtime.ps1
```

Defaults used by the scripts:

- MySQL host: `127.0.0.1`
- MySQL port: `3306`
- Database: `sunshine_travel`
- Username: `root`
- Password: `123456`

Each backup run updates `sql/runtime-backup.sql` and also archives a timestamped copy in `sql/backups/`.
