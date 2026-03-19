import { toValidVarName } from "../src/utils";

describe("toValidVarName", () => {
    it("removes leading and trailing # characters", () => {
        expect(toValidVarName("##Name##")).toBe("Name");
    });

    it("converts spaces to underscores and collapses them", () => {
        expect(toValidVarName("First Name")).toBe("First_Name");
    });

    it("replaces special characters with underscores", () => {
        expect(toValidVarName("foo-bar.baz")).toBe("foo_bar_baz");
    });

    it("collapses multiple consecutive underscores", () => {
        expect(toValidVarName("foo___bar")).toBe("foo_bar");
    });

    it("prepends underscore when name starts with a digit", () => {
        expect(toValidVarName("1stPlace")).toBe("_1stPlace");
    });

    it("returns 'param' for an empty or all-special-character string", () => {
        expect(toValidVarName("")).toBe("param");
        expect(toValidVarName("###")).toBe("param");
        expect(toValidVarName("---")).toBe("param");
    });

    it("leaves a valid camelCase identifier unchanged", () => {
        expect(toValidVarName("myVariable")).toBe("myVariable");
        expect(toValidVarName("CamelCase")).toBe("CamelCase");
    });

    it("strips leading and trailing underscores (generated during sanitisation)", () => {
        // Leading underscores from sanitisation are removed; digit-prefix rule re-adds one.
        expect(toValidVarName("_hello_")).toBe("hello");
    });
});
