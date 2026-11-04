# Folder Structure

```text
project/
├── backend/                 # Express API and backend tests
├── frontend/                # React + Vite client
├── prisma/                  # Schema, migrations, and seed data
├── scripts/                 # Setup scripts
├── documentation/
│   └── markdown-files/      # Project documentation
├── package.json             # Root workspace commands
├── package-lock.json
└── .env.example
```

The backend and frontend are separate top-level folders. Prisma remains at the root because it is shared by backend database scripts and deployment workflows.
