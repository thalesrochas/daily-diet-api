import { execSync } from "node:child_process";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";

describe("Users routes", () => {
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

  it("should be able to create a user", async () => {
    const { body, statusCode } = await request(app.server).post("/users").send({
      name: "Bilbo Baggins",
      email: "bilbo@shire.the",
    });

    console.log(body);

    expect(statusCode).toBe(201);
  });

  it("should fail if the user already exists", async () => {
    const newUser = {
      name: "Bilbo Baggins",
      email: "bilbo@shire.the",
    };

    await request(app.server).post("/users").send(newUser);

    const { statusCode } = await request(app.server)
      .post("/users")
      .send(newUser);

    expect(statusCode).toBe(409);
  });
});
