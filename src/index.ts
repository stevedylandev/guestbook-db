import { Hono } from "hono";
import { cors } from "hono/cors";
import { PGlite } from "@electric-sql/pglite";
import { pinata } from "./pinata";
import { Cron } from "croner";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";

const app = new Hono();
app.use("/*", cors());
app.use("*", clerkMiddleware());

let db: PGlite | null;

interface Message {
	note: string;
	author: string;
	user_id: string;
	user_name: string;
}

app.get("/", (c) => {
	return c.text("Welcome!");
});

app.get("/messages", async (c) => {
	if (db) {
		const ret = await db.query(`
		SELECT * FROM messages ORDER BY id DESC LIMIT 50;
  `);
		return c.json(ret.rows);
	}
	return c.text("Restore database first");
});

app.post("/messages", async (c) => {
	const body = (await c.req.json()) as Message;

	const auth = getAuth(c);
	const clerkClient = c.get("clerk");

	if (!auth?.userId) {
		return c.json(
			{
				message: "You are not logged in.",
			},
			401,
		);
	}

	if (!body.note || typeof body.note !== "string") {
		return c.json({ error: "Invalid note" }, 400);
	}

	const user = await clerkClient.users.getUser(auth?.userId);

	try {
		if (db && auth) {
			const res = await db.query(
				"INSERT INTO messages (note, author, user_id, pfp_url, username) VALUES ($1, $2, $3, $4, $5)",
				[body.note, user.firstName, auth?.userId, user.imageUrl, user.username],
			);

			return c.json(res.rows);
		}
	} catch (error) {
		console.error("Error creating message:", error);
		return c.json({ error: "Failed to create message" }, 500);
	}
});

app.put("/messages/:id", async (c) => {
	const id = c.req.param("id");
	const body = await c.req.json();

	const auth = getAuth(c);

	if (!auth?.userId) {
		return c.json(
			{
				message: "You are not logged in.",
			},
			401,
		);
	}

	if (!body.note || typeof body.note !== "string") {
		return c.json({ error: "Invalid note" }, 400);
	}

	try {
		if (db) {
			const res = await db.query(
				"UPDATE messages SET note = $1 WHERE id = $2 RETURNING *",
				[body.note, id],
			);

			if (res.rows.length === 0) {
				return c.json({ error: "Message not found" }, 404);
			}
			return c.json(res.rows);
		}
	} catch (error) {
		console.error("Error updating message:", error);
		return c.json({ error: "Failed to update message" }, 500);
	}
});

app.delete("/messages/:id", async (c) => {
	const id = c.req.param("id");
	const auth = getAuth(c);
	const admin = c.req.header("Authorization");

	if (!auth?.userId && admin !== process.env.ADMIN_KEY) {
		return c.json(
			{
				message: "You are not logged in.",
			},
			401,
		);
	}

	try {
		if (db) {
			const res = await db.query("DELETE FROM messages WHERE id = $1", [id]);
			if (res.affectedRows === 0) {
				return c.json({ error: "Message not found" }, 404);
			}
			return c.text("Ok");
		}
	} catch (error) {
		console.error("Error deleting message:", error);
		return c.json({ error: "Failed to delete message" }, 500);
	}
});

app.post("/restore", async (c) => {
	try {
		const files = await pinata.files
			.list()
			.group(process.env.GROUP_ID!)
			.order("DESC");
		const dbFile = await pinata.gateways.get(files.files[0].cid);
		const file = dbFile.data as Blob;
		db = new PGlite({ loadDataDir: file });
		return c.text("Ok");
	} catch (error) {
		db = new PGlite("./guestbook");
		await db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        note TEXT,
        author TEXT,
        user_id TEXT,
        pfp_url TEXT,
        username TEXT
      );
    `);
		return c.text("New DB created");
	}
});

app.post("/backup", async (c) => {
	try {
		if (db) {
			const dbFile = (await db.dumpDataDir("auto")) as File;
			const upload = await pinata.upload
				.file(dbFile)
				.group(process.env.GROUP_ID!);
			console.log(upload);
			return c.json(upload);
		}
	} catch (error) {
		console.error("Error backing up database:", error);
		return c.json({ error: "Failed to backup database" }, 500);
	}
});

const job = Cron("0 0 * * *", async () => {
	if (db) {
		const dbFile = (await db.dumpDataDir("auto")) as File;
		const upload = await pinata.upload
			.file(dbFile)
			.group(process.env.GROUP_ID!);
		console.log(upload);
	}
});

app.delete("/wipe", async (c) => {
	const auth = getAuth(c);

	if (!auth?.userId) {
		return c.json(
			{
				message: "You are not logged in.",
			},
			401,
		);
	}

	if (db) {
		await db.exec(`
    DELETE FROM messages
  `);
		return c.text("done");
	}
});

export default app;
