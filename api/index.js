import "dotenv/config";

import { createConfiguredApp } from "../src/server/runtime.js";

const app = createConfiguredApp();

export default app;
