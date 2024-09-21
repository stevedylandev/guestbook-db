import { Hono } from "hono";
import { PGlite } from "@electric-sql/pglite";

const app = new Hono();

const db = new PGlite("./guestbook");

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
      author TEXT,
      user_id TEXT
    )
    `);
	return c.text("done");
});

app.get("/update", async (c) => {
	await db.exec(`
    INSERT INTO messages (note, author, user_id) VALUES ('hello there!', 'steve', 'f6eabed5-f243-4bf4-8f20-fa3dc4d9c32b');
  `);
	return c.text("done");
});

app.get("/wipe", async (c) => {
	await db.exec(`
    DELETE FROM messages
  `);
	return c.text("done");
});

export default app;
