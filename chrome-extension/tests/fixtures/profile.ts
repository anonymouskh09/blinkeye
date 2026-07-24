// Minimal LinkedIn-like profile markup exercising the primary selectors.
export const PROFILE_HTML = `<!doctype html>
<html>
  <head>
    <link rel="canonical" href="https://www.linkedin.com/in/jane-doe/?trk=public" />
    <meta property="og:url" content="https://www.linkedin.com/in/jane-doe" />
  </head>
  <body>
    <main>
      <section class="artdeco-card">
        <div class="ph5">
          <h1 class="text-heading-xlarge">Jane Doe\u200B</h1>
          <div class="text-body-medium break-words">Senior Software Engineer at Acme</div>
          <div class="pv-text-details__left-panel">
            <span class="text-body-small inline t-black--light break-words">Berlin, Germany</span>
          </div>
          <img
            class="pv-top-card-profile-picture__image--show"
            src="https://media.licdn.com/dms/image/jane.jpg"
            alt="Jane Doe"
            width="200"
          />
        </div>
      </section>
      <section data-section="summary">
        <div id="about"></div>
        <div class="inline-show-more-text">
          <span aria-hidden="true">Passionate engineer.\n\n\nLoves TypeScript.</span>
        </div>
      </section>
    </main>
  </body>
</html>`;

// A profile where the primary name selector is missing, to exercise fallbacks.
export const PROFILE_HTML_FALLBACK = `<!doctype html>
<html>
  <head></head>
  <body>
    <main>
      <h1>Omar \u0645\u062D\u0645\u062F</h1>
    </main>
  </body>
</html>`;
