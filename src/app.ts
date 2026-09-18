import cookie from "@fastify/cookie";
import fastify from "fastify";
import { userRoutes } from "./routes/users";

export const app = fastify();

app.register(cookie);

app.addHook("preHandler", async req => {
  console.log(`[${req.method}] ${req.url}`);
});

app.register(userRoutes, { prefix: "users" });
