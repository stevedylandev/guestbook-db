import { Hono } from "hono";
import { PGlite } from "@electric-sql/pglite";

const app = new Hono();
const db = new PGlite();

app.get("/", (c) => {
	return c.text("Welcome!");
});

app.get("/list", async (c) => {
	const ret = await db.query(`
    SELECT * from messages;
  `);
	return c.json(ret.rows);
});

app.get("/create", async (c) => {
	await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      note TEXT,
      author TEXT
    )
    `);
	return c.text("done");
});

app.get("/update", async (c) => {
	await db.exec(`
    INSERT INTO messages (note, author) VALUES ('hello there!', 'steve');
  `);
	return c.text("done");
});

export default app;
