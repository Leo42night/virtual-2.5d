const loginBtn = document.getElementById("googleLoginBtn");
const loginPopupBtn = document.getElementById("loginPopupBtn");
const loginMessage = document.getElementById("loginMessage");
const rateForm = document.getElementById("rateForm");
const loginIcon = document.getElementById("loginIcon");
const userMenu = document.getElementById("userMenu");
const userNameEl = document.getElementById("userName");
const userEmailEl = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

(() => {
  const STORAGE_KEY = "isLoggedIn";
  let isLoggedIn = localStorage.getItem(STORAGE_KEY) === "true";
  let me = null;

  // ✅ pastikan BASE_URL ada, pakai origin halaman sekarang
  const BASE_URL = window.location.origin;

  function setLoggedIn(value) {
    isLoggedIn = !!value;
    localStorage.setItem(STORAGE_KEY, isLoggedIn ? "true" : "false");
    // optional: update UI minimal
    // console.log("[AUTH] setLoggedIn:", isLoggedIn);
  }

  function openCenteredPopup(url, name = "oauth", w = 520, h = 640) {
    const dualScreenLeft = window.screenLeft ?? window.screenX;
    const dualScreenTop = window.screenTop ?? window.screenY;
    const width = window.innerWidth || document.documentElement.clientWidth || screen.width;
    const height = window.innerHeight || document.documentElement.clientHeight || screen.height;
    const left = dualScreenLeft + (width - w) / 2;
    const top = dualScreenTop + (height - h) / 2;

    return window.open(url, name, `scrollbars=yes,width=${w},height=${h},top=${top},left=${left}`);
  }

  async function startGoogleLogin() {
    const res = await fetch(`/auth/popup`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to get OAuth URL");

    const { authUrl } = await res.json();

    const popup = openCenteredPopup(authUrl);
    if (!popup) throw new Error("Popup blocked by browser");

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("OAuth timeout"));
      }, 120000);

      const poll = setInterval(() => {
        if (popup.closed) {
          cleanup();
          reject(new Error("Popup closed by user"));
        }
      }, 400);

      function onMessage(event) {
        if (event.origin !== BASE_URL) return;
        if (event.source !== popup) return;

        let data = event.data;
        if (typeof data === "string") {
          try { data = JSON.parse(data); } catch { return; }
        }
        if (!data || data.type !== "oauth_result" || typeof data.ok !== "boolean") return;

        cleanup(); // cleanup dulu sebelum async
        if (data.ok && data.token) {
          // ← async IIFE karena onMessage tidak bisa async
          (async () => {
            try {
              await fetch("/auth/setcookie", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: data.token }) // ← data.token, bukan e.data.token
              });
            } catch (err) {
              console.error("[setcookie] failed:", err);
            }
            resolve(data); // ← resolve setelah fetch selesai
          })();
        } else {
          resolve(data); // ok: false, langsung resolve
        }
      }

      function cleanup() {
        clearTimeout(timeout);
        clearInterval(poll);
        window.removeEventListener("message", onMessage);
      }

      window.addEventListener("message", onMessage);
    });
  }

  function applyMeToUI(meObj) {
    loginIcon.src = meObj.picture || "/img/potrait-placeholder.png";
    userNameEl.textContent = meObj.name || "-";
    userEmailEl.textContent = meObj.email || "-";
  }

  async function getMeAndSyncState() {
    try {
      const meRes = await fetch(`/api/me`, { credentials: "include" });

      const text = await meRes.text(); // ambil raw dulu sebelum parse
      // console.log("[ME] status:", meRes.status);
      // console.log("[ME] raw:", text);

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        // console.error("[ME] JSON parse failed:", parseErr.message);
        // console.error("[ME] response bukan JSON, kemungkinan HTML/PHP error");
        me = null;
        setLoggedIn(false);
        return false;
      }

      // console.log("[ME] parsed:", data);

      if (!meRes.ok || data?.error) {
        // console.warn("[ME] unauth atau error:", data?.error, data?.message);
        me = null;
        setLoggedIn(false);
        return false;
      }

      me = data;
      setLoggedIn(true);
      applyMeToUI(me);
      return true;

    } catch (networkErr) {
      console.error("[ME] network error:", networkErr.message);
      me = null;
      setLoggedIn(false);
      return false;
    }
  }

  function rateLoginState() {
    if (isLoggedIn) {
      loginMessage?.classList.add("hidden");
      rateForm?.classList.remove("hidden");
    } else {
      loginMessage?.classList.remove("hidden");
      rateForm?.classList.add("hidden");
    }
  }

  async function setuplogin(btn) {
    // kalau sudah login, cuma toggle menu
    if (isLoggedIn) {
      userMenu?.classList.toggle("show");
      return true;
    }

    btn.disabled = true;

    try {
      const result = await startGoogleLogin();

      if (!result.ok) {
        console.error("OAuth failed:", result);
        alert(result.message || ("Login gagal: " + (result.error || "unknown")));
        setLoggedIn(false);
        return false;
      }

      // ✅ setelah popup sukses, VALIDASI ke backend via /api/me
      const ok = await getMeAndSyncState();
      if (!ok) {
        alert("Login gagal: session tidak terbentuk. Coba ulang.");
        return false;
      }

      // ✅ setelah /me sukses, state pasti true
      rateLoginState();
      return true;
    } catch (e) {
      console.error(e);
      alert(e.message || "Terjadi error saat login");
      setLoggedIn(false);
      return false;
    } finally {
      btn.disabled = false;
    }
  }

  // klik tombol utama
  loginBtn?.addEventListener("click", async () => {
    await setuplogin(loginBtn);
  });

  loginPopupBtn?.addEventListener("click", async () => {
    const ok = await setuplogin(loginPopupBtn);
    if (!ok) return;
    window.POPUP.updateMyRateShow();
    rateLoginState();
  });

  // logout
  logoutBtn?.addEventListener("click", () => {
    fetch("/auth/logout", { credentials: "include" })
      .then(() => {
        setLoggedIn(false);
        me = null;
        for (let i = 0; i < 5; i++) localStorage.removeItem(`rating_${i}`);
        loginIcon.src = "/img/g-logo.png";
        userMenu?.classList.remove("show");
        rateLoginState();
      })
      .catch(err => console.error(err));
  });

  // klik di luar menu -> close
  document.addEventListener("click", (e) => {
    if (!loginBtn?.contains(e.target) && !userMenu?.contains(e.target)) {
      userMenu?.classList.remove("show");
    }
  });

  // ✅ boot: cek sesi beneran dari backend (lebih valid daripada localStorage)
  (async () => {
    await getMeAndSyncState();
    rateLoginState();
  })();

  // ✅ expose yang selalu up-to-date
  window.AUTH = {
    get isLoggedIn() { return isLoggedIn; },
    get me() { return me; },
    refreshMe: getMeAndSyncState,
    setLoggedIn, // opsional
  };
})();
