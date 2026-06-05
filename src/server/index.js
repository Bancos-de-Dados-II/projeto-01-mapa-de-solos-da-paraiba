import "dotenv/config";

import { Pool } from "pg";

import { createApp } from "./app.js";
import { createLocalRepository } from "./local-repository.js";
import { createMunicipalityRepository } from "./repository.js";

const port = Number(process.env.PORT ?? 3000);

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
    })
  : null;

const repository = pool
  ? createMunicipalityRepository(pool)
  : createLocalRepository();

const app = createApp({
  repository,
  corsOrigin: process.env.CORS_ORIGIN ?? "*"
});

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
