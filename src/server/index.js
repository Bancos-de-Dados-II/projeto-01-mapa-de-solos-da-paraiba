import "dotenv/config";

import { createConfiguredApp } from "./runtime.js";

const port = Number(process.env.PORT ?? 3000);
const app = createConfiguredApp();

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
