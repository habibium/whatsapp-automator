import { beforeEach, describe, expect, it } from "vitest";
import {
  createTemplate,
  deleteTemplate,
  findTemplate,
  listTemplates,
  updateTemplate
} from "../../../src/db/repositories/templates";
import { resetDb, seedTestUser, TEST_USER } from "../../helpers/db";

beforeEach(async () => {
  await resetDb();
  await seedTestUser();
});

describe("template repository", () => {
  it("creates, updates and deletes a template", async () => {
    const created = await createTemplate(TEST_USER.id, { name: "Greeting", body: "Hello" });
    expect(created.name).toBe("Greeting");

    const updated = await updateTemplate(created.id, TEST_USER.id, {
      name: "Greeting v2",
      body: "Hi"
    });
    expect(updated?.name).toBe("Greeting v2");

    expect(await deleteTemplate(created.id, TEST_USER.id)).toBe(true);
    expect(await findTemplate(created.id, TEST_USER.id)).toBeUndefined();
  });

  it("scopes by user", async () => {
    const created = await createTemplate(TEST_USER.id, { name: "X", body: "y" });
    expect(await findTemplate(created.id, "other")).toBeUndefined();
    expect(await deleteTemplate(created.id, "other")).toBe(false);
  });

  it("lists templates alphabetically", async () => {
    await createTemplate(TEST_USER.id, { name: "Zebra", body: "z" });
    await createTemplate(TEST_USER.id, { name: "Alpha", body: "a" });
    const names = (await listTemplates(TEST_USER.id)).map((t) => t.name);
    expect(names).toEqual(["Alpha", "Zebra"]);
  });
});
