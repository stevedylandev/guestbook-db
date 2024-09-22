import { Hono } from "hono";
import { PGlite } from "@electric-sql/pglite";
import * as Joi from "joi";
import { pinata } from "./pinata";
import { Cron } from "croner";

const app = new Hono();

let db: PGlite | null;

interface Message {
	note: string;
	author: string;
	user_id: string;
}

const messageSchema = Joi.object({
	note: Joi.string().required().max(1000),
	author: Joi.string().required().max(100),
	user_id: Joi.string().required().max(50),
});

app.get("/", (c) => {
	return c.text("Welcome!");
});

app.get("/messages", async (c) => {
	if (db) {
		const ret = await db.query(`
    SELECT * from messages;
  `);
		return c.json(ret.rows);
	}
	return c.text("Restore database first");
});

app.post("/messages", async (c) => {
	const body = (await c.req.json()) as Message;

	const { error, value } = messageSchema.validate(body);
	if (error) {
		return c.json({ error: error.details[0].message }, 400);
	}

	try {
		if (db) {
			const res = await db.query(
				"INSERT INTO messages (note, author, user_id) VALUES ($1, $2, $3)",
				[body.note, body.author, body.user_id],
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
		console.error("Error restoring database:", error);
		return c.json({ error: "Failed to restore database" }, 500);
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

app.get("/wipe", async (c) => {
	if (db) {
		await db.exec(`
    DELETE FROM messages
  `);
		return c.text("done");
	}
});

export default app;
