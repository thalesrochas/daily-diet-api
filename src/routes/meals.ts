import { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import z from "zod";
import { knex } from "../database";
import { checkSessionIdExists } from "../middleware/check-session-id-exists";

export async function mealRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [checkSessionIdExists] }, async (req, res) => {
    const meals = await knex("meals")
      .where({ user_id: req.user.id })
      .orderBy("date", "desc");

    return res.send({ meals });
  });

  app.post("/", { preHandler: [checkSessionIdExists] }, async (req, res) => {
    const createMealBodySchema = z.object({
      name: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      isOnDiet: z.boolean(),
    });

    const { name, date, description, isOnDiet } = createMealBodySchema.parse(
      req.body,
    );

    await knex("meals").insert({
      id: randomUUID(),
      date: date.getTime(),
      description,
      is_on_diet: isOnDiet,
      name,
      user_id: req.user.id,
    });

    return res.status(201).send();
  });

  app.get("/:id", { preHandler: [checkSessionIdExists] }, async (req, res) => {
    const idSchema = z.object({ id: z.uuid() });
    const { id } = idSchema.parse(req.params);

    const meal = await knex("meals")
      .where({ id, user_id: req.user.id })
      .first();

    if (!meal) {
      return res.status(404).send({ error: "Meal not found" });
    }

    return res.send({ meal });
  });

  app.put("/:id", { preHandler: [checkSessionIdExists] }, async (req, res) => {
    const idSchema = z.object({ id: z.uuid() });
    const { id } = idSchema.parse(req.params);

    const updateMealBodySchema = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      date: z.coerce.date().optional(),
      isOnDiet: z.boolean().optional(),
    });

    const { name, date, description, isOnDiet } = updateMealBodySchema.parse(
      req.body,
    );

    const meal = await knex("meals")
      .where({ id, user_id: req.user.id })
      .first();

    if (!meal) {
      return res.status(404).send({ error: "Meal not found" });
    }

    await knex("meals")
      .where({ id, user_id: req.user.id })
      .update({
        ...(name && { name }),
        ...(description && { description }),
        ...(date && { date: date.getTime() }),
        ...(isOnDiet !== undefined && { is_on_diet: isOnDiet }),
      });

    return res.status(204).send();
  });

  app.delete(
    "/:id",
    { preHandler: [checkSessionIdExists] },
    async (req, res) => {
      const idSchema = z.object({ id: z.uuid() });
      const { id } = idSchema.parse(req.params);

      const meal = await knex("meals")
        .where({ id, user_id: req.user.id })
        .first();

      if (!meal) {
        return res.status(404).send({ error: "Meal not found" });
      }

      await knex("meals").where({ id, user_id: req.user.id }).delete();

      return res.status(204).send();
    },
  );

  app.get(
    "/metrics",
    { preHandler: [checkSessionIdExists] },
    async (req, res) => {
      const totalMealsOnDiet =
        Number(
          (
            await knex("meals")
              .where({
                user_id: req.user.id,
                is_on_diet: true,
              })
              .count("id", { as: "total" })
              .first()
          )?.total,
        ) || 0;

      const totalMealsOffDiet =
        Number(
          (
            await knex("meals")
              .where({
                user_id: req.user.id,
                is_on_diet: false,
              })
              .count("id", { as: "total" })
              .first()
          )?.total,
        ) || 0;

      const meals = await knex("meals")
        .where({ user_id: req.user.id })
        .orderBy("date", "desc");

      const { best: bestOnDietCombo } = meals.reduce(
        (combo, meal) => {
          if (meal.is_on_diet) {
            combo.current += 1;
          } else {
            combo.current = 0;
          }

          if (combo.current > combo.best) {
            combo.best = combo.current;
          }

          return combo;
        },
        { best: 0, current: 0 },
      );

      return res.send({
        totalMeals: meals.length,
        totalMealsOnDiet,
        totalMealsOffDiet,
        bestOnDietCombo,
      });
    },
  );
}
