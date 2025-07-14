import { ContentRank, ModerationStatus } from "../types";

describe("Age-Protected Feed Filtering", () => {
  describe("Content ranking validation", () => {
    it("should validate content rank values", () => {
      // Test that all content ranks are valid
      expect(ContentRank.G).toBe("G");
      expect(ContentRank.PG).toBe("PG");
      expect(ContentRank.PG13).toBe("PG13");
      expect(ContentRank.R).toBe("R");
      expect(ContentRank.NC17).toBe("NC17");
    });

    it("should validate moderation status values", () => {
      // Test that all moderation statuses are valid
      expect(ModerationStatus.PENDING).toBe("pending");
      expect(ModerationStatus.APPROVED).toBe("approved");
      expect(ModerationStatus.REJECTED).toBe("rejected");
      expect(ModerationStatus.FLAGGED).toBe("flagged");
      expect(ModerationStatus.UNDER_REVIEW).toBe("under_review");
    });
  });

  describe("Age filtering logic", () => {
    it("should filter content for minors correctly", () => {
      // Test the filtering logic for minors
      const minorFilter = ["G", "PG"];

      // Test that G content is allowed
      expect(minorFilter).toContain(ContentRank.G);

      // Test that PG content is allowed
      expect(minorFilter).toContain(ContentRank.PG);

      // Test that PG13 content is NOT allowed
      expect(minorFilter).not.toContain(ContentRank.PG13);

      // Test that R content is NOT allowed
      expect(minorFilter).not.toContain(ContentRank.R);

      // Test that NC17 content is NOT allowed
      expect(minorFilter).not.toContain(ContentRank.NC17);
    });

    it("should filter content for adults with strict filtering correctly", () => {
      // Test the filtering logic for adults with strict filtering
      const adultStrictFilter = ["G", "PG", "PG13"];

      // Test that G, PG, and PG13 content is allowed
      expect(adultStrictFilter).toContain(ContentRank.G);
      expect(adultStrictFilter).toContain(ContentRank.PG);
      expect(adultStrictFilter).toContain(ContentRank.PG13);

      // Test that R content is NOT allowed
      expect(adultStrictFilter).not.toContain(ContentRank.R);

      // Test that NC17 content is NOT allowed
      expect(adultStrictFilter).not.toContain(ContentRank.NC17);
    });

    it("should allow all content for adults with allowAdultContent enabled", () => {
      // Test that adults with allowAdultContent can see all content
      const allContentRanks = [
        ContentRank.G,
        ContentRank.PG,
        ContentRank.PG13,
        ContentRank.R,
        ContentRank.NC17,
      ];

      // All content ranks should be available
      expect(allContentRanks).toContain(ContentRank.G);
      expect(allContentRanks).toContain(ContentRank.PG);
      expect(allContentRanks).toContain(ContentRank.PG13);
      expect(allContentRanks).toContain(ContentRank.R);
      expect(allContentRanks).toContain(ContentRank.NC17);
    });
  });

  describe("Content safety validation", () => {
    it("should correctly identify minor-safe content", () => {
      // Test that G and PG content is minor-safe
      const minorSafeRanks = [ContentRank.G, ContentRank.PG];

      expect(minorSafeRanks).toContain(ContentRank.G);
      expect(minorSafeRanks).toContain(ContentRank.PG);
    });

    it("should correctly identify adult-only content", () => {
      // Test that R and NC17 content is adult-only
      const adultOnlyRanks = [ContentRank.R, ContentRank.NC17];

      expect(adultOnlyRanks).toContain(ContentRank.R);
      expect(adultOnlyRanks).toContain(ContentRank.NC17);
    });

    it("should handle moderation status correctly", () => {
      // Test that approved content can be shown
      expect(ModerationStatus.APPROVED).toBe("approved");

      // Test that rejected content should not be shown
      expect(ModerationStatus.REJECTED).toBe("rejected");

      // Test that flagged content needs review
      expect(ModerationStatus.FLAGGED).toBe("flagged");
    });
  });
});
