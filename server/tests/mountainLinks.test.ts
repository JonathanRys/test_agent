import { describe, expect, it } from "vitest";
import {
  collectMountainCardReferences,
  linkMountainCards,
} from "../agent/mountainLinks.js";

describe("mountain card links in agent replies", () => {
  it("links canonical peaks and matches longer names before their suffixes", () => {
    const references = collectMountainCardReferences(
      JSON.stringify({
        ok: true,
        result: {
          mountains: [
            { id: 1, name: "Monadnock" },
            { id: 2, name: "Pack Monadnock" },
          ],
        },
      }),
    );

    expect(
      linkMountainCards("Monadnock and Pack Monadnock are nearby.", references),
    ).toBe(
      "[Monadnock](/mountain/1) and [Pack Monadnock](/mountain/2) are nearby.",
    );
  });

  it("preserves existing links, inline code, and unknown peak names", () => {
    const references = [{ id: 3, name: "Warner Hill" }];
    const content =
      "[Warner Hill](/mountain/3), `Warner Hill`, and Monadnock.";

    expect(linkMountainCards(content, references)).toBe(
      "[Warner Hill](/mountain/3), `Warner Hill`, and Monadnock.",
    );
  });

  it("matches names without regard to capitalization", () => {
    expect(
      linkMountainCards("I like PACK MONADNOCK.", [
        { id: 9, name: "Pack Monadnock" },
      ]),
    ).toBe("I like [PACK MONADNOCK](/mountain/9).");
  });
});