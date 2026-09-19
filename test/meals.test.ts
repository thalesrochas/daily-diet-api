import { execSync } from "node:child_process";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";

const newMeal = {
  name: "Breakfast",
  description: "Eggs and toast",
  date: "2026-09-18T08:00:00.000Z",
  isOnDiet: true,
};

async function createUser(email = "bilbo@shire.the") {
  const response = await request(app.server).post("/users").send({
    name: "Bilbo Baggins",
    email,
  });

  return response.get("Set-Cookie") ?? [];
}

async function createMeal(cookies: string[], meal = {}) {
  await request(app.server)
    .post("/meals")
    .set("Cookie", cookies)
    .send({ ...newMeal, ...meal });
}

async function listMeals(cookies: string[]) {
  const { body } = await request(app.server)
    .get("/meals")
    .set("Cookie", cookies);

  return body.meals;
}

describe("Meals routes", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    execSync("npm run knex migrate:rollback --all");
    execSync("npm run knex migrate:latest");
  });

  describe("Create meals", () => {
    it("should be able to create a meal", async () => {
      const cookies = await createUser();

      const { statusCode } = await request(app.server)
        .post("/meals")
        .set("Cookie", cookies)
        .send(newMeal);

      expect(statusCode).toBe(201);
    });

    it("should not be able to create a meal without a session/user", async () => {
      const { statusCode } = await request(app.server)
        .post("/meals")
        .send(newMeal);

      expect(statusCode).toBe(401);
    });
  });

  describe("List meals", () => {
    it("should be able to list the user meals", async () => {
      const cookies = await createUser();
      await createMeal(cookies);

      const { body, statusCode } = await request(app.server)
        .get("/meals")
        .set("Cookie", cookies);

      expect(statusCode).toBe(200);
      expect(body.meals).toHaveLength(1);
      expect(body.meals[0]).toEqual(
        expect.objectContaining({ name: "Breakfast" }),
      );
    });

    it("should not list meals from other users", async () => {
      const cookies = await createUser();
      const otherCookies = await createUser("frodo@shire.the");
      await createMeal(cookies);

      const meals = await listMeals(otherCookies);

      expect(meals).toHaveLength(0);
    });

    it("should not be able to list meals without a session", async () => {
      const { statusCode } = await request(app.server).get("/meals");

      expect(statusCode).toBe(401);
    });
  });

  describe("Get meal", () => {
    it("should be able to get a single meal", async () => {
      const cookies = await createUser();
      await createMeal(cookies);
      const [{ id }] = await listMeals(cookies);

      const { body, statusCode } = await request(app.server)
        .get(`/meals/${id}`)
        .set("Cookie", cookies);

      expect(statusCode).toBe(200);
      expect(body.meal).toEqual(
        expect.objectContaining({ id, name: "Breakfast" }),
      );
    });

    it("should not be able to get a meal from another user", async () => {
      const cookies = await createUser();
      const otherCookies = await createUser("frodo@shire.the");
      await createMeal(cookies);
      const [{ id }] = await listMeals(cookies);

      const { statusCode } = await request(app.server)
        .get(`/meals/${id}`)
        .set("Cookie", otherCookies);

      expect(statusCode).toBe(404);
    });
  });

  describe("Update meal", () => {
    it("should be able to update a meal", async () => {
      const cookies = await createUser();
      await createMeal(cookies);
      const [{ id }] = await listMeals(cookies);

      const { statusCode } = await request(app.server)
        .put(`/meals/${id}`)
        .set("Cookie", cookies)
        .send({ name: "Second Breakfast", isOnDiet: false });

      const { body } = await request(app.server)
        .get(`/meals/${id}`)
        .set("Cookie", cookies);

      expect(statusCode).toBe(204);
      expect(body.meal).toEqual(
        expect.objectContaining({ name: "Second Breakfast", is_on_diet: 0 }),
      );
    });

    it("should not be able to update a meal from another user", async () => {
      const cookies = await createUser();
      const otherCookies = await createUser("frodo@shire.the");
      await createMeal(cookies);
      const [{ id }] = await listMeals(cookies);

      const { statusCode } = await request(app.server)
        .put(`/meals/${id}`)
        .set("Cookie", otherCookies)
        .send({ name: "Stolen Meal" });

      expect(statusCode).toBe(404);
    });
  });

  describe("Delete meal", () => {
    it("should be able to delete a meal", async () => {
      const cookies = await createUser();
      await createMeal(cookies);
      const [{ id }] = await listMeals(cookies);

      const { statusCode } = await request(app.server)
        .delete(`/meals/${id}`)
        .set("Cookie", cookies);

      expect(statusCode).toBe(204);
      expect(await listMeals(cookies)).toHaveLength(0);
    });

    it("should not be able to delete a meal from another user", async () => {
      const cookies = await createUser();
      const otherCookies = await createUser("frodo@shire.the");
      await createMeal(cookies);
      const [{ id }] = await listMeals(cookies);

      const { statusCode } = await request(app.server)
        .delete(`/meals/${id}`)
        .set("Cookie", otherCookies);

      expect(statusCode).toBe(404);
      expect(await listMeals(cookies)).toHaveLength(1);
    });
  });

  describe("Get user metrics", () => {
    it("should be able to get the user metrics", async () => {
      const cookies = await createUser();
      await createMeal(cookies, { date: "2026-09-18T08:00:00.000Z" });
      await createMeal(cookies, { date: "2026-09-18T12:00:00.000Z" });
      await createMeal(cookies, {
        date: "2026-09-18T15:00:00.000Z",
        isOnDiet: false,
      });
      await createMeal(cookies, { date: "2026-09-18T20:00:00.000Z" });

      const { body, statusCode } = await request(app.server)
        .get("/meals/metrics")
        .set("Cookie", cookies);

      expect(statusCode).toBe(200);
      expect(body).toEqual({
        totalMeals: 4,
        totalMealsOnDiet: 3,
        totalMealsOffDiet: 1,
        bestOnDietCombo: 2,
      });
    });

    it("should not be able to get metrics without a session", async () => {
      const { statusCode } = await request(app.server).get("/meals/metrics");

      expect(statusCode).toBe(401);
    });
  });
});
