/**
 * Converts a placeholder string (e.g. "##First Name##") into a valid
 * JavaScript / form-field variable name (e.g. "FirstName").
 * @internal
 */
export function toValidVarName(placeholder: string): string {
    let varName = placeholder
        .replace(/^#+|#+$/g, "")    // Remove leading/trailing #
        .replace(/[^a-zA-Z0-9_]/g, "_") // Replace invalid chars with _
        .replace(/_+/g, "_")            // Collapse multiple underscores
        .replace(/^_|_$/g, "");         // Remove leading/trailing _

    if (/^[0-9]/.test(varName)) {
        varName = "_" + varName;
    }

    return varName || "param";
}
