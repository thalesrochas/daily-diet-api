import { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import z from "zod";
import { knex } from "../database";

export async function userRoutes(app: FastifyInstance) {
  app.post("/", async (req, res) => {
    const createUserBodySchema = z.object({
      name: z.string().trim(),
      email: z.email(),
    });

    let { sessionId } = req.cookies;

    if (!sessionId) {
      sessionId = randomUUID();
      res.cookie("sessionId", sessionId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }

    const { name, email } = createUserBodySchema.parse(req.body);

    const user = await knex("users").where({ email }).first();

    if (user) {
      return res.status(409).send({ error: "User already exists" });
    }

    await knex("users").insert({
      id: randomUUID(),
      session_id: sessionId,
      name,
      email,
    });

    return res.status(201).send();
  });
}
