import { describe, expect, it } from "vitest";
import { buildApifyInput, normalizeApifyOutput } from "@/lib/apify";

describe("buildApifyInput matches published actor schemas", () => {
  it("uses compass/crawler-google-places field names for google-maps", () => {
    const input = buildApifyInput({
      sourceType: "google-maps",
      niche: "dentist",
      country: "United States",
      city: "Miami",
      maxLeads: 2,
    });

    // Regression: Apify silently IGNORES unknown fields, so a run starts and
    // then fails with "INVALID INPUT" instead of erroring at submit time.
    expect(input).not.toHaveProperty("searchStrings");
    expect(input).not.toHaveProperty("maxLocations");

    expect(input.searchStringsArray).toEqual(["dentist"]);
    expect(input.locationQuery).toBe("Miami, United States");
    expect(input.maxCrawledPlacesPerSearch).toBe(2);
    expect(input.scrapeContacts).toBe(true);
    expect(input.skipClosedPlaces).toBe(true);
  });

  it("clamps google-maps limit to the API schema bounds", () => {
    const high = buildApifyInput({ sourceType: "google-maps", niche: "cafe", country: "US", maxLeads: 99999 });
    const low = buildApifyInput({ sourceType: "google-maps", niche: "cafe", country: "US", maxLeads: -3 });
    expect(high.maxCrawledPlacesPerSearch).toBe(1000);
    expect(low.maxCrawledPlacesPerSearch).toBe(1);
  });

  it("uses website-content-crawler field names for website-list", () => {
    const input = buildApifyInput({
      sourceType: "website-list",
      niche: "anything",
      country: "US",
      urls: "https://example.com\n\nhttps://two.com ",
      maxLeads: 5,
    });

    // Regression: maxDepth/maxPages are unknown fields and get dropped.
    expect(input).not.toHaveProperty("maxDepth");
    expect(input).not.toHaveProperty("maxPages");

    expect(input.startUrls).toEqual([{ url: "https://example.com" }, { url: "https://two.com" }]);
    expect(input.maxCrawlDepth).toBe(1);
    expect(input.maxCrawlPages).toBe(5);
    expect(input.crawlerType).toBe("playwright:adaptive");
  });

  it("crawls one level deeper for directory sources", () => {
    const input = buildApifyInput({
      sourceType: "directory",
      niche: "x",
      country: "US",
      urls: "https://dir.com",
      maxLeads: 10,
    });
    expect(input.maxCrawlDepth).toBe(2);
    expect(input.startUrls).toEqual([{ url: "https://dir.com" }]);
  });
});

describe("normalizeApifyOutput", () => {
  it("maps compass place fields (title/category/countryCode) to leads", () => {
    const leads = normalizeApifyOutput(
      [
        {
          title: "Midtown Dental Miami",
          website: "http://www.midtowndentalmiami.com/",
          phone: "(305) 598-6070",
          city: "Miami",
          state: "Florida",
          countryCode: "US",
          categoryName: "Dentist",
          totalScore: 4.5,
          reviewsCount: 174,
          url: "https://www.google.com/maps/search/?q=Midtown",
        },
      ],
      "google-maps"
    );

    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      company: "Midtown Dental Miami",
      website: "http://www.midtowndentalmiami.com/",
      phone: "(305) 598-6070",
      city: "Miami",
      state: "Florida",
      country: "US",
      niche: "Dentist",
      source: "google-maps",
      status: "new",
      email: null,
      email_status: "invalid",
    });
    expect(leads[0].tags).toEqual(expect.arrayContaining(["rating:4.5", "reviews:174"]));
    expect(leads[0].designation).toBeNull();
  });

  it("expands leadsEnrichment person rows into individual leads with emails", () => {
    const leads = normalizeApifyOutput(
      [
        {
          title: "Ultra Smile Miami",
          website: "http://ultrasmilemiami.com/",
          leadsEnrichment: [
            {
              firstName: "Jane",
              lastName: "Doe",
              jobTitle: "Owner",
              email: "jane@ultrasmilemiami.com",
              companyName: "Ultra Smile Miami",
            },
            { firstName: "John", lastName: "Roe", jobTitle: "Hygienist", email: null },
          ],
        },
      ],
      "google-maps"
    );

    expect(leads).toHaveLength(2);
    expect(leads[0]).toMatchObject({
      person_name: "Jane Doe",
      designation: "Owner",
      email: "jane@ultrasmilemiami.com",
      company: "Ultra Smile Miami",
      email_status: "unverified",
    });
    expect(leads[1].person_name).toBe("John Roe");
    expect(leads[1].email).toBeNull();
    expect(leads[1].email_status).toBe("invalid");
  });

  it("pulls impressum contacts when present", () => {
    const leads = normalizeApifyOutput(
      [
        {
          title: "Muster GmbH",
          impressum: {
            emails: [{ value: "info@muster.de" }],
            people: [{ name: "Max Mustermann", role: "Geschäftsführer" }],
          },
        },
      ],
      "google-maps"
    );

    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      person_name: "Max Mustermann",
      designation: "Geschäftsführer",
      email: "info@muster.de",
      email_status: "unverified",
    });
  });

  it("dedupes by email then website and normalizes emails", () => {
    const leads = normalizeApifyOutput(
      [
        { title: "A", email: "Info@Example.com", website: "https://a.com" },
        { title: "A again", email: "info@example.com" },
        { title: "B", website: "https://a.com" },
        // Company-only rows survive (valid phone/address lead) but identical
        // ones collapse into one regardless of partial field differences.
        { title: "Solo Co" },
        { title: "Solo Co", address: "1 Main St, Miami, FL 33125" },
        { title: "Solo Co" },
      ],
      "google-maps"
    );

    expect(leads).toHaveLength(2);
    expect(leads[0].email).toBe("info@example.com");
    expect(leads.map((l) => l.company)).toEqual(["A", "Solo Co"]);
  });

  it("never stores the Google Maps listing URL as the website", () => {
    const leads = normalizeApifyOutput(
      [
        {
          title: "No Site Co",
          address: "1420 Northwest North River Drive STE 170, Miami, FL 33125",
          url: "https://www.google.com/maps/search/?api=1&query=No%20Site%20Co",
        },
        {
          title: "Has Site Co",
          website: "https://hassite.example",
          url: "https://www.google.com/maps/search/?api=1&query=Has%20Site%20Co",
        },
      ],
      "google-maps"
    );

    expect(leads[0].website).toBeNull();
    // City/state recovered from the address tail when the actor omits them.
    expect(leads[0].city).toBe("Miami");
    expect(leads[0].state).toBe("FL");
    expect(leads[1].website).toBe("https://hassite.example");
  });

  it("maps website-crawler page metadata to company names", () => {
    const leads = normalizeApifyOutput(
      [{ url: "https://example.com/about", metadata: { title: "About — Example Co" } }],
      "website-list"
    );

    expect(leads).toHaveLength(1);
    expect(leads[0].company).toBe("About — Example Co");
    expect(leads[0].website).toBe("https://example.com/about");
  });
});
