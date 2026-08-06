import { describe, it, expect } from "vitest";
import mongoose from "mongoose";

describe("vitest + mongodb-memory-server harness", () => {
  it("connects mongoose to the in-memory mongo", () => {
    expect(mongoose.connection.readyState).toBe(1);
  });

  it("can write and read a document", async () => {
    const Foo = mongoose.models.TestFoo
      ? mongoose.models.TestFoo
      : mongoose.model(
          "TestFoo",
          new mongoose.Schema({ name: String, n: Number })
        );
    await Foo.create({ name: "alpha", n: 1 });
    const docs = await Foo.find({}).lean();
    expect(docs).toHaveLength(1);
    expect(docs[0].name).toBe("alpha");
  });

  it("clears collections between tests (verify isolation)", async () => {
    const Foo = mongoose.models.TestFoo;
    const docs = await Foo.find({}).lean();
    expect(docs).toHaveLength(0);
  });
});
