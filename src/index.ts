import { Hono } from "hono";
import { PGlite } from "@electric-sql/pglite";

const app = new Hono();
const db = new PGlite("./db");

app.get("/", async (c) => {
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

	const ret = await db.query(`
  SELECT * from todo WHERE id = 1;
`);
	console.log(ret.rows);

	return c.json(ret.rows);
});

export default app;
