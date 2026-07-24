import { describe, expect, it } from "vitest";
import { extractProfile } from "../src/content/extractProfile";
import { PROFILE_HTML, PROFILE_HTML_FALLBACK } from "./fixtures/profile";

function docFrom(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("extractProfile", () => {
  it("extracts and cleans core fields from a full profile", () => {
    const doc = docFrom(PROFILE_HTML);
    const { profile, missingFields } = extractProfile(doc, "https://www.linkedin.com/in/jane-doe/?x=1");

    expect(profile.fullName).toBe("Jane Doe"); // zero-width stripped
    expect(profile.headline).toBe("Senior Software Engineer at Acme");
    expect(profile.location).toBe("Berlin, Germany");
    expect(profile.profileImageUrl).toBe("https://media.licdn.com/dms/image/jane.jpg");
    expect(profile.summary).toBe("Passionate engineer.\n\nLoves TypeScript.");
    // canonical is normalized (query stripped)
    expect(profile.linkedinUrl).toBe("https://www.linkedin.com/in/jane-doe");
    expect(missingFields).not.toContain("fullName");
  });

  it("falls back to bare h1 and preserves unicode names", () => {
    const doc = docFrom(PROFILE_HTML_FALLBACK);
    const { profile, missingFields } = extractProfile(doc, "https://www.linkedin.com/in/omar");
    expect(profile.fullName).toBe("Omar محمد");
    expect(profile.linkedinUrl).toBe("https://www.linkedin.com/in/omar");
    // headline/location/summary/image absent → reported as missing
    expect(missingFields).toContain("headline");
    expect(missingFields).toContain("profileImageUrl");
  });

  it("falls back to og:title when CSS selectors miss", () => {
    const doc = docFrom(`<!doctype html><html><head>
      <meta property="og:title" content="Hassan Amer - Python Developer | LinkedIn" />
      <meta property="og:image" content="https://media.licdn.com/dms/image/hassan.jpg" />
      <meta property="og:url" content="https://www.linkedin.com/in/ha55an-dev" />
      <title>Hassan Amer | LinkedIn</title>
    </head><body><main><div>no heading here</div></main></body></html>`);
    const { profile } = extractProfile(doc, "https://www.linkedin.com/in/ha55an-dev/");
    expect(profile.fullName).toBe("Hassan Amer");
    expect(profile.headline).toContain("Python Developer");
    expect(profile.profileImageUrl).toContain("hassan.jpg");
    expect(profile.linkedinUrl).toBe("https://www.linkedin.com/in/ha55an-dev");
  });

  it("extracts from structural top-card without LinkedIn class names", () => {
    const doc = docFrom(`<!doctype html><html><body><main>
      <section>
        <h1><span aria-hidden="true">Hassan Amer</span></h1>
        <div>Python Developer &amp; Web Scraper | Django | React</div>
        <span>Wah Cantonment, Punjab, Pakistan</span>
        <span>500+ connections</span>
        <img src="https://media.licdn.com/dms/image/x.jpg" width="200" alt="Hassan Amer" />
      </section>
    </main></body></html>`);
    const { profile } = extractProfile(doc, "https://www.linkedin.com/in/ha55an-dev");
    expect(profile.fullName).toBe("Hassan Amer");
    expect(profile.headline).toMatch(/Python Developer/);
    expect(profile.location).toMatch(/Wah Cantonment/);
    expect(profile.profileImageUrl).toContain("media.licdn.com");
  });

  it("rejects cover/banner images and prefers profile-displayphoto", () => {
    const doc = docFrom(`<!doctype html><html><head>
      <meta property="og:image" content="https://media.licdn.com/dms/image/profile-displaybackgroundimage-shrink_800/cover.jpg" />
    </head><body>
      <header id="global-nav"><img class="global-nav__me-photo" src="https://media.licdn.com/dms/image/profile-displayphoto-shrink_100_100/ME.jpg" alt="My Photo" /></header>
      <main>
      <section class="artdeco-card">
        <h1>Hassan Amer</h1>
        <img class="pv-top-card-profile-picture__image--show"
             src="https://media.licdn.com/dms/image/profile-displayphoto-shrink_200_200/photo.jpg" alt="Hassan Amer" width="200" />
      </section>
    </main></body></html>`);
    const { profile } = extractProfile(doc, "https://www.linkedin.com/in/ha55an-dev");
    expect(profile.profileImageUrl).toContain("photo.jpg");
    expect(profile.profileImageUrl).not.toContain("ME.jpg");
    expect(profile.profileImageUrl).not.toContain("background");
  });

  it("prefers geographic location over university/company line", () => {
    const doc = docFrom(`<!doctype html><html><body><main>
      <section class="artdeco-card">
        <h1>Zobia Zafar</h1>
        <div class="text-body-medium break-words">AI/ML Developer</div>
        <span>University of Engineering and Technology, Lahore</span>
        <span class="text-body-small inline t-black--light break-words">Lahore, Punjab, Pakistan</span>
      </section>
    </main></body></html>`);
    const { profile } = extractProfile(doc, "https://www.linkedin.com/in/zobia");
    expect(profile.location).toBe("Lahore, Punjab, Pakistan");
    expect(profile.location).not.toMatch(/University/i);
  });

  it("never uses the logged-in user's nav avatar", () => {
    const doc = docFrom(`<!doctype html><html><body>
      <nav class="global-nav">
        <img class="global-nav__me-photo EntityPhoto-circle-1"
             src="https://media.licdn.com/dms/image/profile-displayphoto-shrink_100_100/viewer.jpg" alt="System Admin" />
      </nav>
      <main>
        <section class="artdeco-card">
          <h1>Zobia Zafar</h1>
          <img class="pv-top-card-profile-picture__image"
               src="https://media.licdn.com/dms/image/profile-displayphoto-shrink_200_200/zobia.jpg"
               alt="Zobia Zafar" width="200" />
        </section>
      </main>
    </body></html>`);
    const { profile } = extractProfile(doc, "https://www.linkedin.com/in/zobia-zafar");
    expect(profile.profileImageUrl).toContain("zobia.jpg");
    expect(profile.profileImageUrl).not.toContain("viewer.jpg");
  });

  it("aggressive enrich fills experience when class selectors miss", () => {
    const doc = docFrom(`<!doctype html><html><body><main>
      <section>
        <h1>Maria Shaffi</h1>
        <span aria-hidden="true">Full Stack Developer | React | Node</span>
        <span aria-hidden="true">Karachi, Sindh, Pakistan</span>
        <img src="https://media.licdn.com/dms/image/profile-displayphoto-shrink_200_200/maria.jpg" width="200" />
      </section>
      <section>
        <h2>Experience</h2>
        <ul>
          <li>
            <span aria-hidden="true">Software Engineer</span>
            <span aria-hidden="true">Tech Co · Full-time</span>
            <span aria-hidden="true">Mar 2021 - Present</span>
          </li>
        </ul>
      </section>
      <section>
        <h2>Education</h2>
        <ul>
          <li>
            <span aria-hidden="true">NED University</span>
            <span aria-hidden="true">BS Software Engineering</span>
            <span aria-hidden="true">2016 - 2020</span>
          </li>
        </ul>
      </section>
      <section>
        <h2>Skills</h2>
        <span aria-hidden="true">React</span>
        <span aria-hidden="true">Node.js</span>
      </section>
      <section>
        <h2>About</h2>
        <div class="inline-show-more-text"><span aria-hidden="true">I build web apps.</span></div>
      </section>
    </main></body></html>`);
    const { profile } = extractProfile(doc, "https://www.linkedin.com/in/maria-shaffi");
    expect(profile.fullName).toBe("Maria Shaffi");
    expect(profile.headline).toMatch(/Full Stack/i);
    expect(profile.location).toMatch(/Karachi/i);
    expect(profile.profileImageUrl).toContain("maria.jpg");
    expect(profile.experiences[0]?.title).toMatch(/Software Engineer/i);
    expect(profile.educations[0]?.school).toMatch(/NED/i);
    expect(profile.skills).toEqual(expect.arrayContaining(["React", "Node.js"]));
    expect(profile.summary).toMatch(/web apps/i);
  });

  it("extracts certifications and languages when present and marks missing sections", () => {
    const doc = docFrom(`<!doctype html><html><body><main>
      <section><h1>Alex Kim</h1><div>Engineer</div></section>
      <section>
        <h2>Licenses & certifications</h2>
        <ul>
          <li>
            <span aria-hidden="true">AWS Certified Solutions Architect</span>
            <span aria-hidden="true">Amazon Web Services</span>
            <span aria-hidden="true">Issued Jan 2023</span>
          </li>
        </ul>
      </section>
      <section>
        <h2>Languages</h2>
        <ul>
          <li>
            <span aria-hidden="true">English</span>
            <span aria-hidden="true">Native or bilingual proficiency</span>
          </li>
        </ul>
      </section>
    </main></body></html>`);
    const { profile } = extractProfile(doc, "https://www.linkedin.com/in/alex-kim");
    expect(profile.certifications[0]?.name).toMatch(/AWS/i);
    expect(profile.languages[0]?.language).toMatch(/English/i);
    expect(profile.experiences).toEqual([]);
    expect(profile.educations).toEqual([]);
    expect(profile.sectionStatuses?.experience).toBe("not_available");
    expect(profile.sectionStatuses?.certifications).toBe("detected");
    expect(profile.sectionStatuses?.languages).toBe("detected");
  });

  it("returns empty arrays when detailed sections are absent", () => {
    const doc = docFrom(`<!doctype html><html><body><main>
      <section><h1>No Sections</h1><div>Headline only</div></section>
    </main></body></html>`);
    const { profile } = extractProfile(doc, "https://www.linkedin.com/in/no-sections");
    expect(profile.experiences).toEqual([]);
    expect(profile.educations).toEqual([]);
    expect(profile.skills).toEqual([]);
    expect(profile.certifications).toEqual([]);
    expect(profile.languages).toEqual([]);
  });
});
