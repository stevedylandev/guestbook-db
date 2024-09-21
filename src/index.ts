import { Hono } from "hono";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const messages = pgTable("messages", {
	id: serial("id").primaryKey(),
	note: text("note").notNull(),
	author: text("author").notNull(),
});

const app = new Hono();
const client = new PGlite();
const db = drizzle(client);

app.get("/", async (c) => {
	const data = await db.select().from(messages);
	console.log(data);
	return c.json(data);
});

app.get("/create", async (c) => {
	await client.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      note TEXT,
      author TEXT
    )
    `);
	return c.text("done");
});

app.get("/update", async (c) => {
	await db.insert(messages).values({
		note: "Hello there",
		author: "Steve",
	});
	return c.text("done");
});

export default app;
