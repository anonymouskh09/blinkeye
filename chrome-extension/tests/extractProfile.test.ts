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

  it("extracts nested company roles with company name when fields are glued", () => {
    // Real LinkedIn sometimes concatenates title+dates without separators in textContent
    const doc = docFrom(`<!doctype html><html><body><main>
      <section><h1>Qualitex Profile</h1></section>
      <section>
        <h2>Experience</h2>
        <ul class="pvs-list">
          <li class="pvs-list__paged-list-item">
            <div data-view-name="profile-component-entity">
              <a href="https://www.linkedin.com/company/qualitex/">
                <span aria-hidden="true">Qualitex Trading Co. Ltd</span>
              </a>
              <span aria-hidden="true">Full-time</span>
              <span aria-hidden="true">2 yrs 11 mos</span>
              <ul class="pvs-list">
                <li class="pvs-list__paged-list-item">
                  <div>Software EngineerJul 2022 - Mar 2024 · 1 yr 9 mosTokyo, Japan Information Technology, JavaScript and +15 skills</div>
                </li>
                <li class="pvs-list__paged-list-item">
                  <div>Software EngineerMay 2021 - Jun 2022 · 1 yr 2 mosGujranwala, Punjab, Pakistan</div>
                </li>
              </ul>
            </div>
          </li>
        </ul>
      </section>
    </main></body></html>`);
    const { profile } = extractProfile(doc, "https://www.linkedin.com/in/qualitex-test");
    expect(profile.experiences.length).toBe(2);
    expect(profile.experiences.every((e) => /Qualitex/i.test(e.company))).toBe(true);
    expect(profile.experiences[0]?.title).toMatch(/^Software Engineer$/i);
    expect(profile.experiences[1]?.title).toMatch(/^Software Engineer$/i);
    expect(profile.experiences[0]?.title).not.toMatch(/Jul 2022/i);
  });

  it("extracts nested multi-role company experiences", () => {
    const doc = docFrom(`<!doctype html><html><body><main>
      <section><h1>Nested Exp</h1></section>
      <section>
        <h2>Experience</h2>
        <ul>
          <li class="pvs-list__paged-list-item">
            <a href="https://www.linkedin.com/company/acme/"><span aria-hidden="true">Acme Corp</span></a>
            <ul class="pvs-list">
              <li class="pvs-list__paged-list-item">
                <span aria-hidden="true">Senior Engineer</span>
                <span aria-hidden="true">Full-time</span>
                <span aria-hidden="true">Jan 2022 - Present</span>
                <span aria-hidden="true">Berlin, Germany</span>
              </li>
              <li class="pvs-list__paged-list-item">
                <span aria-hidden="true">Engineer</span>
                <span aria-hidden="true">Full-time</span>
                <span aria-hidden="true">Mar 2020 - Dec 2021</span>
              </li>
            </ul>
          </li>
          <li class="pvs-list__paged-list-item">
            <span aria-hidden="true">Intern</span>
            <span aria-hidden="true">Startup Inc · Internship</span>
            <span aria-hidden="true">Jun 2019 - Aug 2019</span>
          </li>
        </ul>
      </section>
      <section>
        <h2>Education</h2>
        <ul>
          <li class="pvs-list__paged-list-item">
            <span aria-hidden="true">MIT</span>
            <span aria-hidden="true">BS, Computer Science</span>
            <span aria-hidden="true">2015 - 2019</span>
          </li>
        </ul>
      </section>
      <section>
        <h2>Skills</h2>
        <a data-field="skill_card_skill_topic"><span aria-hidden="true">TypeScript</span></a>
        <a data-field="skill_card_skill_topic"><span aria-hidden="true">Python</span></a>
      </section>
    </main></body></html>`);
    const { profile } = extractProfile(doc, "https://www.linkedin.com/in/nested-exp");
    expect(profile.experiences.length).toBeGreaterThanOrEqual(3);
    expect(profile.experiences.some((e) => /Senior Engineer/i.test(e.title) && /Acme/i.test(e.company))).toBe(true);
    expect(profile.experiences.some((e) => e.title === "Engineer" && /Acme/i.test(e.company))).toBe(true);
    expect(profile.experiences.some((e) => /Intern/i.test(e.title))).toBe(true);
    expect(profile.educations[0]?.school).toMatch(/MIT/i);
    expect(profile.skills).toEqual(expect.arrayContaining(["TypeScript", "Python"]));
    expect(profile.sectionStatuses?.experience).toBe("detected");
    expect(profile.sectionStatuses?.education).toBe("detected");
    expect(profile.sectionStatuses?.skills).toBe("detected");
  });

  it("extracts standalone jobs AND nested company roles together (6 records)", () => {
    // Mirrors LinkedIn: 4 standalone top-level jobs + 1 company group with 2 nested roles
    const doc = docFrom(`<!doctype html><html><body><main>
      <section><h1>Test Profile</h1></section>
      <section>
        <h2>Experience</h2>
        <ul class="pvs-list">
          <li class="pvs-list__paged-list-item">
            <div data-view-name="profile-component-entity">
              <span aria-hidden="true">Head of Danish Chips Competence Centre</span>
              <a href="https://www.linkedin.com/company/danish-chips/"><span aria-hidden="true">Danish Chips Competence Centre</span></a>
              <span aria-hidden="true">Dec 2024 - Present</span>
              <span aria-hidden="true">Copenhagen region, Denmark</span>
              <!-- incidental nested entity must NOT force company-group mode -->
              <div data-view-name="profile-component-entity"><span aria-hidden="true">Media</span></div>
            </div>
          </li>
          <li class="pvs-list__paged-list-item">
            <span aria-hidden="true">Business Development Consultant</span>
            <span aria-hidden="true">Self-employed</span>
            <span aria-hidden="true">Aug 2024 - Present</span>
          </li>
          <li class="pvs-list__paged-list-item">
            <span aria-hidden="true">Chief Technology Officer</span>
            <a href="https://www.linkedin.com/company/sparrow-quantum/"><span aria-hidden="true">Sparrow Quantum ApS</span></a>
            <span aria-hidden="true">Mar 2022 - Aug 2024</span>
            <span aria-hidden="true">Copenhagen Metropolitan Area</span>
          </li>
          <li class="pvs-list__paged-list-item">
            <span aria-hidden="true">Entrepreneur-in-Residence</span>
            <a href="https://www.linkedin.com/company/dtu/"><span aria-hidden="true">DTU - Technical University of Denmark</span></a>
            <span aria-hidden="true">Jun 2021 - Apr 2022</span>
            <span aria-hidden="true">Capital Region of Denmark, Denmark</span>
          </li>
          <li class="pvs-list__paged-list-item">
            <a href="https://www.linkedin.com/company/lithium-balance/"><span aria-hidden="true">Lithium Balance A/S</span></a>
            <span aria-hidden="true">5 yrs 1 mo</span>
            <ul class="pvs-list">
              <li class="pvs-list__paged-list-item">
                <span aria-hidden="true">Director, System Engineering &amp; Innovation, R&amp;D</span>
                <span aria-hidden="true">Jun 2021 - Mar 2022</span>
                <span aria-hidden="true">Capital Region of Denmark, Denmark</span>
              </li>
              <li class="pvs-list__paged-list-item">
                <span aria-hidden="true">R&amp;D Director</span>
                <span aria-hidden="true">Mar 2016 - May 2021</span>
                <span aria-hidden="true">Copenhagen, Capital Region of Denmark, Denmark</span>
                <span aria-hidden="true">Led R&amp;D organization and product innovation roadmap.</span>
              </li>
            </ul>
          </li>
        </ul>
      </section>
    </main></body></html>`);

    const { profile } = extractProfile(doc, "https://www.linkedin.com/in/test-exp");
    expect(profile.experiences).toHaveLength(6);

    const summary = profile.experiences.map((e) => ({
      title: e.title,
      company: e.company,
      start: e.start_date,
      end: e.end_date ?? null,
      current: !!e.is_current,
    }));

    expect(summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Head of Danish Chips Competence Centre",
          company: "Danish Chips Competence Centre",
          start: "Dec 2024",
          end: null,
          current: true,
        }),
        expect.objectContaining({
          title: "Business Development Consultant",
          company: "Self-employed",
          start: "Aug 2024",
          end: null,
          current: true,
        }),
        expect.objectContaining({
          title: "Chief Technology Officer",
          company: "Sparrow Quantum ApS",
          start: "Mar 2022",
          end: "Aug 2024",
        }),
        expect.objectContaining({
          title: "Entrepreneur-in-Residence",
          company: "DTU - Technical University of Denmark",
          start: "Jun 2021",
          end: "Apr 2022",
        }),
        expect.objectContaining({
          title: "Director, System Engineering & Innovation, R&D",
          company: "Lithium Balance A/S",
          start: "Jun 2021",
          end: "Mar 2022",
        }),
        expect.objectContaining({
          title: "R&D Director",
          company: "Lithium Balance A/S",
          start: "Mar 2016",
          end: "May 2021",
        }),
      ]),
    );

    // Nested-only regression: must not be the only records
    expect(profile.experiences.filter((e) => e.company === "Lithium Balance A/S")).toHaveLength(2);
    expect(profile.experiences.filter((e) => e.company !== "Lithium Balance A/S")).toHaveLength(4);
  });

  it("succeeds when education and skills sections are missing", () => {
    const doc = docFrom(`<!doctype html><html><body><main>
      <section><h1>Only Exp</h1><div>Developer</div></section>
      <section>
        <h2>Experience</h2>
        <ul>
          <li>
            <span aria-hidden="true">Developer</span>
            <span aria-hidden="true">Solo Co · Full-time</span>
            <span aria-hidden="true">2023 - Present</span>
          </li>
        </ul>
      </section>
    </main></body></html>`);
    const { profile } = extractProfile(doc, "https://www.linkedin.com/in/only-exp");
    expect(profile.experiences.length).toBe(1);
    expect(profile.educations).toEqual([]);
    expect(profile.skills).toEqual([]);
  });
});
