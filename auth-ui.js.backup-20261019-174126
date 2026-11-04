(() => {
  const config = window.NAVAI_SUPABASE_CONFIG;
  const lib = window.supabase;

  if (!config || !config.url || !config.key || !lib) {
    console.error("NavAI Auth: Supabase configuration or library missing.");
    return;
  }

  const client = lib.createClient(config.url, config.key);
  window.NAVAI_SUPABASE_CLIENT = client;
  let mode = "signin";
  let currentSession = null;

  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = "/auth-ui.css";
  document.head.appendChild(style);

  const trigger = document.createElement("button");
  trigger.id = "navai-auth-trigger";
  trigger.type = "button";
  trigger.textContent = "Sign in";
  trigger.setAttribute("aria-label", "Sign in or manage account");
  trigger.classList.add("navai-sidebar-auth-trigger");
  const sidebarBottom = document.querySelector(".sidebar-bottom");
  if (sidebarBottom) sidebarBottom.insertBefore(trigger, sidebarBottom.firstChild);
  else document.body.appendChild(trigger);

  const overlay = document.createElement("div");
  overlay.id = "navai-auth-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="navai-auth-card" role="dialog" aria-modal="true"
      aria-labelledby="navai-auth-title">
      <button type="button" class="navai-auth-close" aria-label="Close">×</button>
      <div class="navai-auth-brand">NavAI</div>
      <h2 id="navai-auth-title">Welcome back</h2>
      <p class="navai-auth-subtitle">Sign in to your NavAI account</p>
      <div id="navai-auth-message" role="status" aria-live="polite"></div>

      <form id="navai-auth-form">
        <label for="navai-auth-email">Email address</label>
        <input id="navai-auth-email" type="email" autocomplete="email"
          placeholder="you@example.com" required maxlength="254">

        <label for="navai-auth-password">Password</label>
        <input id="navai-auth-password" type="password"
          autocomplete="current-password" placeholder="At least 8 characters"
          required minlength="8" maxlength="128">

        <button id="navai-auth-submit" class="navai-auth-primary" type="submit">
          Sign in
        </button>
      </form>
      <button type="button" id="navai-auth-google" class="navai-auth-google">Continue with Google</button>

      <div id="navai-auth-account" hidden>
        <p class="navai-auth-subtitle">Signed in as</p>
        <p id="navai-auth-email-display" class="navai-auth-email-display"></p>
        <button id="navai-auth-logout" class="navai-auth-primary" type="button">
          Sign out
        </button>
      </div>

      <p id="navai-auth-switch-row" class="navai-auth-switch-row">
        <span id="navai-auth-switch-label">New to NavAI?</span>
        <button id="navai-auth-switch" type="button">Create account</button>
      </p>
      <p class="navai-auth-privacy">
        Use your own email and password. Never share your password with anyone.
      </p>
    </section>`;
  document.body.appendChild(overlay);

  const $ = (id) => document.getElementById(id);
  const form = $("navai-auth-form");
  const message = $("navai-auth-message");
  const title = $("navai-auth-title");
  const subtitle = overlay.querySelector(".navai-auth-subtitle");
  const password = $("navai-auth-password");

  function say(text, isError = false) {
    message.textContent = text || "";
    message.classList.toggle("navai-auth-error", isError);
  }

  function openModal() {
    overlay.hidden = false;
    document.body.classList.add("navai-auth-open");
    say("");
    if (!currentSession) $("navai-auth-email").focus();
  }

  function closeModal() {
    overlay.hidden = true;
    document.body.classList.remove("navai-auth-open");
  }

  function renderSession(session) {
    currentSession = session;
    trigger.textContent = session ? "Account" : "Sign in";
    form.hidden = !!session;
    $("navai-auth-account").hidden = !session;
    $("navai-auth-google").hidden = !!session;
    $("navai-auth-switch-row").hidden = !!session;

    if (session) {
      title.textContent = "Your account";
      subtitle.textContent = "You're signed in to NavAI";
      $("navai-auth-email-display").textContent =
        session.user.email || "Signed-in user";
    } else {
      title.textContent = mode === "signin" ? "Welcome back" : "Create your account";
      subtitle.textContent = mode === "signin"
        ? "Sign in to your NavAI account"
        : "Create an account with your email";
      $("navai-auth-submit").textContent =
        mode === "signin" ? "Sign in" : "Create account";
      password.autocomplete = mode === "signin" ? "current-password" : "new-password";
      $("navai-auth-switch-label").textContent =
        mode === "signin" ? "New to NavAI?" : "Already have an account?";
      $("navai-auth-switch").textContent =
        mode === "signin" ? "Create account" : "Sign in";
    }
  }


  $("navai-auth-google").addEventListener("click", async () => {
    const button = $("navai-auth-google");
    button.disabled = true;
    button.textContent = "Connecting to Google...";
    say("");
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin }
      });
      if (error) throw error;
    } catch (error) {
      say(error.message || "Google sign-in failed.", true);
      button.disabled = false;
      button.textContent = "Continue with Google";
    }
  });
  trigger.addEventListener("click", openModal);
  overlay.querySelector(".navai-auth-close").addEventListener("click", closeModal);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) closeModal();
  });

  $("navai-auth-switch").addEventListener("click", () => {
    mode = mode === "signin" ? "signup" : "signin";
    say("");
    renderSession(currentSession);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("navai-auth-email").value.trim();
    const pass = password.value;
    const submit = $("navai-auth-submit");

    if (pass.length < 8) {
      say("Password must be at least 8 characters.", true);
      return;
    }

    submit.disabled = true;
    submit.textContent = "Please wait...";
    say("");

    try {
      if (mode === "signup") {
        const { data, error } = await client.auth.signUp({
          email,
          password: pass
        });
        if (error) throw error;

        if (data.session) {
          say("Account created successfully.");
        } else {
          say("Account request received. Check your email for a verification link.");
        }
      } else {
        const { error } = await client.auth.signInWithPassword({
          email,
          password: pass
        });
        if (error) throw error;
        say("Signed in successfully.");
      }
    } catch (error) {
      say(error.message || "Authentication failed. Please try again.", true);
    } finally {
      submit.disabled = false;
      renderSession(currentSession);
    }
  });

  $("navai-auth-logout").addEventListener("click", async () => {
    const button = $("navai-auth-logout");
    button.disabled = true;
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      say("You have signed out.");
    } catch (error) {
      say(error.message || "Could not sign out.", true);
    } finally {
      button.disabled = false;
    }
  });

  client.auth.onAuthStateChange((_event, session) => {
    renderSession(session);
  });

  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("NavAI session check failed:", error.message);
      return;
    }
    renderSession(data.session);
  });
})();

