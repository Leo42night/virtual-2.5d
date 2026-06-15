// popup utils: UI + cache + data fetch (FINAL: toggle video)
(() => {
  const STORAGE_KEY = "GAME_POPUP_DATA";
  const STORAGE_TIME_KEY = "GAME_POPUP_DATA_TIME";
  const CACHE_TTL = 1000 * 60 * 60 * 6;
  const { S } = window.GAME;
  let changedProjectCom = false;
  let currentActiveTab = null;
  // let alreadyLoadedComVids = [];

  /* =========================
   * Cache helpers
   * ========================= */
  function loadPopupDataFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const time = Number(localStorage.getItem(STORAGE_TIME_KEY));
      if (!raw || !time) return null;
      if (Date.now() - time > CACHE_TTL) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function savePopupDataToStorage(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(STORAGE_TIME_KEY, Date.now().toString());
    } catch { }
  }

  /* =========================
   * UI refs (ambil sekali)
   * ========================= */
  const el = {
    // Popup For Presentation (Top, Com), Day, Rating
    popup: document.getElementById("tilePopup"),
    closeBtn: document.getElementById("popupCloseBtn"),
    overlay: document.getElementById("overlay"),

    top: document.getElementById("mode-top"),
    img: document.getElementById("popupImg"),
    title: document.getElementById("popupTitle"),
    desc: document.getElementById("popupDesc"),

    // Presentation Com
    com: document.getElementById("mode-com"),
    comLoading: document.getElementById("comLoading"),
    vid1: document.getElementById("vid-pitch-deck"),
    vid2: document.getElementById("vid-demo"),
    docReport: document.getElementById("doc-report"),
    webLink: document.getElementById("webLink"),
    repoLink: document.getElementById("githubLink"),

    // Presentation Day
    presentation: document.getElementById("mode-presentation"),
    vid0: document.getElementById("vid-presentation-day"),
    loading: document.getElementById("vidLoading"),

    // Rating
    rating: document.getElementById("mode-rating"),
    ratingContainer: document.getElementById("rating-container"),

    loader: document.getElementById("loadingOverlay"),
  };

  /* =========================
   * Video toggle (Pitch/Demo)
   * ========================= */
  const toggleWrap = document.querySelector(".video-toggle");
  const btnPitch = toggleWrap?.querySelector('[data-tab="pitch"]');
  const btnDemo = toggleWrap?.querySelector('[data-tab="demo"]');
  const btnDoc = toggleWrap?.querySelector('[data-tab="doc"]');

  function showComLoading(show, from = "") {
    el.comLoading?.classList.toggle("hidden", !show);
  }

  function attachVideoLoadListenersOnce() {
    // presentation day
    if (el.vid0 && !el.vid0.__hasLoadListener) {
      el.vid0.addEventListener("load", () => el.loading.classList.toggle("hidden", true));
      el.vid0.__hasLoadListener = true;
    }
    // Com
    if (el.vid1 && !el.vid1.__hasLoadListener) {
      el.vid1.addEventListener("load", () => showComLoading(false, "vid1"));
      el.vid1.__hasLoadListener = true;
    }
    if (el.vid2 && !el.vid2.__hasLoadListener) {
      el.vid2.addEventListener("load", () => showComLoading(false, "vid2"));
      el.vid2.__hasLoadListener = true;
    }
  }
  attachVideoLoadListenersOnce();


  function setSrcOnce(iframe, url) {
    if (!iframe) return false;
    const next = (url || "").trim();
    // console.log("setSrcOnce", iframe.dataset.src, url);
    if (iframe.dataset.src === next) return false;
    // console.log("setSrcOnce berubah");
    iframe.dataset.src = next;
    iframe.src = next;
    return true;
  }


  // Stop video iframe: paling reliable adalah reload iframe ke url yang sama
  function stopIframe(iframe, from = "") {
    if (!iframe) return;
    const src = iframe.dataset.src || iframe.src;
    if (!src) return;
    // console.log(`stopIframe ${from}: `, src);
    // 1) blank-kan dulu
    iframe.src = "about:blank";

    // 2) balikin lagi next tick (biar dianggap reload)
    setTimeout(() => {
      iframe.src = src;
    }, 50);
  }

  // get rating
  async function updateMyRateShow() {
    const projectId = S.selectedProjectId;        // snapshot
    const key = `rating_${projectId}`;

    if (!projectId || !window.AUTH.me?.id) {
      return;
    }

    const cached = localStorage.getItem(key);
    // console.log(`check localstorage rating_${projectId}: `, cached);
    if (cached != null) {
      window.RATE.paint(Number(cached), "active");
      return;
    }

    const res = await window.RATE.getRating();
    // console.log("/api/get-rate:", res);
    if (!res.ok) return;

    // ⚠️ kalau user sudah pindah project, jangan timpa UI
    if (S.selectedProjectId !== projectId) return;

    const rate = res.data?.rate ?? null;
    if (rate != null) localStorage.setItem(key, String(rate));
    window.RATE.paint(rate, "active");
  }

  // tab: "pitch" | "demo" | "doc"
  function setActiveTab(tab) {
    currentActiveTab = tab;
    // console.log("setActiveTab", tab);
    const pitchActive = tab === "pitch";
    const demoActive = tab === "demo";
    const docActive = tab === "doc";

    btnPitch?.classList.toggle("is-active", pitchActive);
    btnDemo?.classList.toggle("is-active", demoActive);
    btnDoc?.classList.toggle("is-active", docActive);

    el.vid1?.classList.toggle("is-active", pitchActive);
    el.vid2?.classList.toggle("is-active", demoActive);
    el.docReport?.classList.toggle("is-active", docActive);

    if (!docActive) {
      // console.log("setActiveTab: changedProjectCom && !docActive");
      showComLoading(true);
    }

    if (pitchActive) {
      stopIframe(el.vid2, "pitchaActive on, stop vid2");
    } else if (demoActive) {
      stopIframe(el.vid1, "demoActive on, stop vid1");
    } else if (docActive) {
      stopIframe(el.vid1, "docActive on, stop vid1");
      stopIframe(el.vid2, "docActive on, stop vid2");
    }
  }

  // init toggle click (sekali)
  btnPitch?.addEventListener("click", () => setActiveTab("pitch"));
  btnDemo?.addEventListener("click", () => setActiveTab("demo"));
  btnDoc?.addEventListener("click", () => setActiveTab("doc"));

  function hidePopupCom() {
    // stop semua saat popup disembunyikan
    stopIframe(el.vid1);
    stopIframe(el.vid2);

    // hide container
    el.com?.classList.add("hidden");
  }

  /* =========================
   * Close / handlers
   * ========================= */
  function closePopup() {
    // console.log("closePopup");
    // hide modes
    window.GAME_HELPER.resumeGame();
    el.presentation?.classList.add("hidden");
    el.rating?.classList.add("hidden");
    el.top?.classList.add("hidden");
    hidePopupCom();
    if (el.vid0) stopIframe(el.vid0); // presentation day

    // hide popup
    el.popup?.classList.add("hidden");
  }

  function initPopupHandlers() {
    el.closeBtn?.addEventListener("click", closePopup);
    el.popup?.addEventListener("click", (e) => {
      if (e.target === el.popup) closePopup();
    });
  }

  /* =========================
   * Show functions
   * ========================= */
  function showPopupProject(baseUrl, data) {
    el.img.src = baseUrl + "/" + (data?.image ?? "");
    el.title.textContent = data?.title ?? "Info";
    el.desc.textContent = data?.description ?? "-";
    el.top?.classList.remove("hidden");
    el.popup?.classList.remove("hidden");
  }

  function showPopupCom(data = {}) {
    S.selectedProjectId = data?.id; // dipakai rate.js

    // console.log("showPopupCom", data);
    el.com?.classList.remove("hidden");
    el.popup?.classList.remove("hidden");

    if (!S.selectedProjectId) {
      console.warn("showPopupCom: missing project id", data);
      window.RATE?.paint?.(null, "inactive");
      return;
    }
    // console.log("showPopupCom", data);

    // gunakan vid1 untuk cek perubahan tab com (src berubah), intial loading
    changedProjectCom = setSrcOnce(el.vid1, data?.link_vid_pitch || "");
    setSrcOnce(el.vid2, data?.link_vid_demo || "");
    setSrcOnce(el.docReport, data?.link_doc || "");
    // console.log(`showPopupCom ${S.selectedProjectId} changedProjectCom ${changedProjectCom}`);

    // alreadyLoadedComVids = [];
    if (changedProjectCom) {
      el.webLink.href = data?.link_web || "#";
      el.repoLink.href = data?.link_repo || "#";
      updateMyRateShow();

      if (currentActiveTab !== "doc") showComLoading(true, "change1 2 3");

      // fallback: kalau iframe load ga terpanggil (kadang embed), matiin loader paksa
      setTimeout(() => showComLoading(false, "safety"), 7000);
    } else if (data?.tab === currentActiveTab) {
      // cek if open the tab again (tidak perlu run jika project yg sama & tab yg sama)
      return;
    }
    setActiveTab(currentActiveTab || "pitch");
  }


  function showOverlayQuiz() {
    el.overlay?.classList.add("show");
    initQuiz();
  }

  function showPresentation() {
    el.presentation?.classList.remove("hidden");
    el.popup?.classList.remove("hidden");

    let changed = setSrcOnce(el.vid0, "https://www.youtube.com/embed/TuHMaFgQXsQ");
    if (changed) {
      // console.log("showPresentation change src");
      el.loading.classList.toggle("hidden", false);
    }
  }

  function showRatingPopup() {
    el.rating?.classList.remove("hidden");
    el.popup?.classList.remove("hidden");
  }

  function showLoader(show) {
    if (!el.loader) return;
    el.loader.classList.toggle("hidden", !show);
  }

  /* =========================
   * Public API
   * ========================= */
  window.POPUP = {
    el,

    // handlers
    initPopupHandlers,
    closePopup,

    // show
    showPopupProject,
    showPopupCom,
    showOverlayQuiz,
    showPresentation,
    showRatingPopup,
    showLoader,

    // data/cache
    loadPopupDataFromStorage,

    // (opsional) expose untuk debugging
    updateMyRateShow,
    // _video: { setActiveTab, stopIframe, setSrcOnce },
  };
})();
