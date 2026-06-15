// rating.js
(() => {
  const { S } = window.GAME;
  const { ratingContainer } = window.POPUP.el;
  const projectMap = Object.fromEntries(PROJECTS.map(p => [p.id, p]));
  const projectRate = [];

  const AVATAR_MAX = 5;
  const avatarCooldown = new Map(); // url -> timestamp
  const avatarLoaded = new Set();   // url cache

  function canLoadAvatar(url) {
    const until = avatarCooldown.get(url);
    return !until || Date.now() > until;
  }

  function markAvatarFail(url, ms = 120000) {
    avatarCooldown.set(url, Date.now() + ms); // 2 menit
  }

  async function fetchRatings() {
    const res = await fetch(`${S.BASE_URL}/api/ratings`, { method: "GET" });
    const data = await res.json(); // urutan array sama dengan projects
    // console.log(data);

    for (const [projectId, ratings] of Object.entries(data)) {
      const project = projectMap[Number(projectId)]; // ambil dari projectMap by id
      const newrating = {
        5: { count: 0, users: [] },
        4: { count: 0, users: [] },
        3: { count: 0, users: [] },
        2: { count: 0, users: [] },
        1: { count: 0, users: [] }
      };
      for (const rating of ratings) {
        newrating[rating.rate].count = rating.count;
        newrating[rating.rate].users = rating.avatars;
      }

      // console.log(newrating);

      projectRate.push({
        title: project.title,
        image: project.image,
        ratings: newrating
      });
    }
    // console.log(projectRate);
  }
  // fetchRatings();

  function calculateAverage(ratings) {
    let totalScore = 0;
    let totalUser = 0;

    Object.entries(ratings).forEach(([rate, data]) => {
      totalScore += rate * data.count;
      totalUser += data.count;
    });

    if (totalUser === 0) return { avg: 0, totalUser };

    return {
      avg: (totalScore / totalUser).toFixed(1),
      totalUser
    };
  }

  function createAvatarImg(url) {
    const img = document.createElement("img");
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.crossOrigin = "anonymous";

    if (!url || !canLoadAvatar(url)) {
      img.src = "/img/potrait-placeholder.png";
      return img;
    }

    if (avatarLoaded.has(url)) {
      img.src = url;
      return img;
    }

    img.onerror = () => {
      markAvatarFail(url);
      img.src = "/img/potrait-placeholder.png";
    };

    avatarLoaded.add(url);
    img.src = url;
    return img;
  }

  function debounce(fn, ms = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function stars(avg) {
    const full = Math.floor(avg);
    return "★".repeat(full) + "☆".repeat(5 - full);
  }

  function _updateRating() {
    // console.log("updateRating", isLoggedIn, projects || []);

    // 🔥 CLEAR SEKALI
    ratingContainer.innerHTML = "";

    if (!window.AUTH.isLoggedIn) {
      ratingContainer.innerHTML = `<p style="grid-column: span 5">Silakan berikan rating terlebih dahulu</p>`;
      return;
    }
    // console.log("projects :", projects);
    projectRate.forEach(project => {
      const result = calculateAverage(project.ratings);

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
      <div class="card-img">
        <img class="project-img" src="${project.image}" loading="lazy">
      </div>
      <div class="card-body">
        <div class="card-title">${project.title}</div>

        <div class="rating-average">
          <span class="stars">${stars(result.avg)}</span> (${result.avg})
        </div>
      </div>
    `;

      const body = card.querySelector(".card-body");

      Object.entries(project.ratings)
        .sort((a, b) => b[0] - a[0])
        .forEach(([rate, data]) => {
          const row = document.createElement("div");
          row.className = "rating-row";

          row.innerHTML = `
          <div class="rating-header">
            <div class="rating-info">
              <span>${rate} ★</span>
              <span class="rating-count">(${data.count} orang)</span>
            </div>
          </div>
          <div class="avatars"></div>
        `;

          const avatarsEl = row.querySelector(".avatars");

          // 🔥 LIMIT AVATAR
          data.users.slice(0, AVATAR_MAX).forEach(u => {
            avatarsEl.appendChild(createAvatarImg(u));
          });

          if (data.users.length > AVATAR_MAX) {
            const more = document.createElement("span");
            more.className = "more";
            more.textContent = `+${data.users.length - AVATAR_MAX}`;
            avatarsEl.appendChild(more);
          }

          body.appendChild(row);
        });

      const total = document.createElement("div");
      total.className = "total";
      total.textContent = `Total Penilai: ${result.totalUser}`;
      body.appendChild(total);

      const cell = document.createElement("div");
      cell.className = "cell";
      cell.appendChild(card);
      ratingContainer.appendChild(cell);
    });

    // console.log("[RATING] rendered safely");
  }

  const updateRating = debounce(_updateRating, 300);

  window.RATING = {
    fetchRatings,
    updateRating
  };
})();