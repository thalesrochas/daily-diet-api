import cookie from "@fastify/cookie";
import fastify from "fastify";
import { mealRoutes, userRoutes } from "./routes";

export const app = fastify();

app.register(cookie);

app.addHook("preHandler", async req => {
  console.log(`[${req.method}] ${req.url}`);
});

app.register(mealRoutes, { prefix: "meals" });
app.register(userRoutes, { prefix: "users" });
