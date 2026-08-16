## What I Learned

- **Debugging by isolating the failure point.** When the AI assistant returned
  "temporarily unavailable," the error was too generic to act on. I learned
  to add temporary logging at each layer (frontend fetch → backend
  controller → Gemini service) to find exactly where a request was failing,
  rather than guessing. This traced problems back to their real causes:
  a CORS mismatch, then separately a missing environment variable on the
  deployed server — two different bugs that looked identical from the
  browser's error message alone.

- **CORS is about the deployed origin, not the code.** My CORS configuration
  worked locally but failed once deployed, because the allowed origin list
  needs to match the exact live frontend URL, not localhost. This taught me
  that environment-specific configuration (via environment variables) is
  essential for anything deployed across separate frontend/backend hosts.

- **Third-party APIs change without warning.** My Gemini API calls failed
  in production because the model name I originally used had been
  deprecated by Google. This showed me that hardcoded model/API versions
  are a real maintenance point, not a "set once" detail — and that reading
  the actual error message (rather than assuming my code was wrong) saved
  significant time.

- **Environment variables are easy to get subtly wrong.** A missing
  environment variable on my hosting platform caused a failure that looked
  identical to an API problem. I learned to verify configuration values
  directly (via temporary debug logs) instead of assuming a dashboard
  setting was correctly saved.

- **Deployment platforms vary more than expected.** I originally planned to
  deploy on [Render], but adapted after hitting platform-specific
  requirements. This taught me to keep my backend code (Express, environment
  variables, CORS setup) portable and not tightly coupled to any one
  platform's assumptions.

- **Documentation and testing structure created earlier (SRS/SDS, manual
  test cases) made debugging faster later** — because I already knew what
  each function was supposed to do, isolating unexpected behavior was much
  quicker than if I'd been debugging unfamiliar code.

  ## Future Improvements

- Add a favorites/saved-cities list so users can check multiple locations
  without re-searching each time.
- Show a visible "waking up the server" message during Render's free-tier
  cold start, instead of a plain loading spinner, so the delay is clearly
  explained to first-time visitors.
- Add unit tests for the weather-processing and validation functions,
  since testing for this version was manual only.
- Support temperature unit toggling (°C / °F) based on user preference.
- Add a dark mode toggle.
- Cache recent weather lookups briefly to reduce repeated calls to
  Open-Meteo for the same city.
- Turn the app into an installable PWA using the web manifest already
  added for the Chrome install shortcut.