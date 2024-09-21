import { Hono } from "hono";
import { PGlite } from "@electric-sql/pglite";

const app = new Hono();
const db = new PGlite();

app.get("/", async (c) => {
	const ret = await db.query(`
  SELECT * from todo;
`);

	return c.json(ret.rows);
});

app.get("/create", async (c) => {
	await db.exec(`
      CREATE TABLE IF NOT EXISTS todo (
        id SERIAL PRIMARY KEY,
        task TEXT,
        done BOOLEAN DEFAULT false
      );
      INSERT INTO todo (task, done) VALUES ('Install PGlite from NPM', true);
      INSERT INTO todo (task, done) VALUES ('Load PGlite', true);
      INSERT INTO todo (task, done) VALUES ('Create a table', true);
      INSERT INTO todo (task, done) VALUES ('Insert some data', true);
      INSERT INTO todo (task) VALUES ('Update a task');
    `);
	return c.text("done");
});

app.get("/update", async (c) => {
	await db.exec(`
    INSERT INTO todo (task, done) VALUES ('New task from Hono', false);
  `);
	return c.text("done");
});

export default app;
