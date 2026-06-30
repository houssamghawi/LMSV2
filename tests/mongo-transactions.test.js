import { describe, it, expect } from "vitest";

import { isTransactionNotSupportedError } from "@/service/mongo";

describe("mongo transaction helpers", () => {
    it("detects standalone MongoDB transaction errors", () => {
        expect(
            isTransactionNotSupportedError({
                code: 20,
                codeName: "IllegalOperation",
                message: "Transaction numbers are only allowed on a replica set member or mongos"
            })
        ).toBe(true);
    });

    it("does not treat unrelated errors as transaction unsupported", () => {
        expect(isTransactionNotSupportedError({ code: 11000, message: "duplicate key" })).toBe(false);
    });
});
