const { spawnSync } = require("node:child_process");

process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rental_book";

const prismaCli = require.resolve("prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaCli, "generate"], {
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
