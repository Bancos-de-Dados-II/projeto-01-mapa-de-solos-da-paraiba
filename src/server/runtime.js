import { Pool } from "pg";

import { createApp } from "./app.js";
import { createLocalRepository } from "./local-repository.js";
import { createMunicipalityRepository } from "./repository.js";

let sharedPool = null;

export function createConfiguredApp() {
  const pool = getPool();
  const repository = pool
    ? createMunicipalityRepository(pool)
    : createLocalRepository();

  return createApp({
    repository,
    corsOrigin: process.env.CORS_ORIGIN ?? "*"
  });
}

function getPool() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!sharedPool) {
    sharedPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_MAX ?? 3),
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
    });
  }

  return sharedPool;
}
