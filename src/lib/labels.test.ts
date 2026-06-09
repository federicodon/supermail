import { describe, it, expect } from "vitest";
import { email } from "./testEmail";
import {
  applyLabel,
  removeLabel,
  toggleLabel,
  emailsWithLabel,
  labelCount,
  labelTree,
  labelName,
  addLabel,
  deleteLabel,
  findLabelByName,
  isValidLabelName,
  recolorLabel,
  removeLabelFromEmails,
  renameLabel,
  renameLabelInEmails,
  slugifyLabelId,
  DEFAULT_LABELS,
} from "./labels";

describe("labels", () => {
  it("apply is idempotent; remove and toggle work", () => {
    const e0 = email({ labels: [] });
    const e1 = applyLabel(e0, "Clients");
    expect(e1.labels).toEqual(["Clients"]);
    expect(applyLabel(e1, "Clients").labels).toEqual(["Clients"]); // no dup
    expect(removeLabel(e1, "Clients").labels).toEqual([]);
    expect(toggleLabel(e1, "Clients").labels).toEqual([]);
    expect(toggleLabel(e0, "Clients").labels).toEqual(["Clients"]);
  });

  it("emailsWithLabel + labelCount ignore archived in count", () => {
    const emails = [
      email({ id: "a", labels: ["Finance"] }),
      email({ id: "b", labels: ["Finance"], archived: true }),
      email({ id: "c", labels: [] }),
    ];
    expect(emailsWithLabel(emails, "Finance").map((e) => e.id)).toEqual(["a", "b"]);
    expect(labelCount(emails, "Finance")).toBe(1);
  });

  it("labelTree nests by '/' and labelName resolves ids", () => {
    const tree = labelTree(DEFAULT_LABELS);
    const clients = tree.find((n) => n.segment === "Clients")!;
    expect(clients.children.map((c) => c.segment)).toContain("Acme");
    expect(clients.children[0].fullName).toBe("Clients/Acme");
    expect(labelName("l-team", DEFAULT_LABELS)).toBe("Team");
    expect(labelName("unknown", DEFAULT_LABELS)).toBe("unknown");
  });

  it("slugifies ids and validates names", () => {
    expect(slugifyLabelId("Clients/Acme")).toBe("l-clients-acme");
    expect(slugifyLabelId("  Q3   Budget! ")).toBe("l-q3-budget");
    expect(slugifyLabelId("   ")).toBe("l-label");
    expect(isValidLabelName("x")).toBe(true);
    expect(isValidLabelName("   ")).toBe(false);
  });

  it("adds labels de-duped by name with unique ids", () => {
    const base: typeof DEFAULT_LABELS = [];
    const r1 = addLabel(base, "  Vendors ", "#111");
    expect(r1.label).toMatchObject({ id: "l-vendors", name: "Vendors", color: "#111" });
    expect(r1.labels).toHaveLength(1);
    // Same name (case-insensitive) → no insert, returns existing.
    const r2 = addLabel(r1.labels, "vendors");
    expect(r2.labels).toBe(r1.labels);
    expect(r2.label.id).toBe("l-vendors");
    // Different name that slugs to the same base → unique id.
    const r3 = addLabel(r1.labels, "Vendors!");
    expect(r3.label.id).toBe("l-vendors-2");
    expect(r3.labels).toHaveLength(2);
    expect(findLabelByName(r3.labels, "VENDORS!")?.id).toBe("l-vendors-2");
  });

  it("renames / recolors / deletes; system labels are protected", () => {
    const labels = [
      { id: "l-a", name: "Alpha", color: "#1" },
      { id: "SENT", name: "Sent", system: true },
    ];
    expect(renameLabel(labels, "l-a", "Beta").find((l) => l.id === "l-a")?.name).toBe("Beta");
    expect(renameLabel(labels, "l-a", "  ").find((l) => l.id === "l-a")?.name).toBe("Alpha"); // blank ignored
    expect(renameLabel(labels, "SENT", "Nope").find((l) => l.id === "SENT")?.name).toBe("Sent");
    expect(recolorLabel(labels, "l-a", "#999").find((l) => l.id === "l-a")?.color).toBe("#999");
    expect(deleteLabel(labels, "l-a").map((l) => l.id)).toEqual(["SENT"]);
    expect(deleteLabel(labels, "SENT").map((l) => l.id)).toEqual(["l-a", "SENT"]); // system kept
  });

  it("propagates rename / delete across the mailbox (emails store names)", () => {
    const emails = [
      email({ id: "a", labels: ["Alpha", "Team"] }),
      email({ id: "b", labels: ["Team"] }),
    ];
    const renamed = renameLabelInEmails(emails, "Alpha", "Beta");
    expect(renamed[0].labels).toEqual(["Beta", "Team"]);
    expect(renameLabelInEmails(emails, "Alpha", "Alpha")).toBe(emails); // no-op same name
    const stripped = removeLabelFromEmails(emails, "Team");
    expect(stripped[0].labels).toEqual(["Alpha"]);
    expect(stripped[1].labels).toEqual([]);
  });
});
