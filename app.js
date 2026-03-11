(function () {
  const state = {
    activeCategory: "全部影片",
    searchText: "",
    activeVideoUrl: ""
  };

  const categoryTabs = document.getElementById("categoryTabs");
  const videoGrid = document.getElementById("videoGrid");
  const emptyState = document.getElementById("emptyState");
  const resultSummary = document.getElementById("resultSummary");
  const searchInput = document.getElementById("searchInput");
  const videoPlayer = document.getElementById("videoPlayer");
  const videoFeedback = document.getElementById("videoFeedback");
  const currentCategory = document.getElementById("currentCategory");
  const currentOrder = document.getElementById("currentOrder");
  const currentTitle = document.getElementById("currentTitle");
  const currentDescription = document.getElementById("currentDescription");

  const rawVideos = Array.isArray(window.videoData) ? window.videoData : [];
  const videos = rawVideos
    .map(normalizeVideo)
    .filter(function (video) {
      return video.visible !== false;
    });

  const categories = Array.from(new Set(videos.map(function (video) {
    return video.category;
  }).filter(Boolean))).concat(["全部影片"]);

  renderCategoryTabs(categories);

  if (videos.length > 0) {
    setActiveVideo(videos.slice().sort(compareVideos)[0]);
  }

  renderVideos();

  searchInput.addEventListener("input", function (event) {
    state.searchText = event.target.value.trim().toLowerCase();
    renderVideos();
  });

  videoPlayer.addEventListener("play", function () {
    showVideoFeedback("play");
  });

  videoPlayer.addEventListener("pause", function () {
    if (videoPlayer.ended) {
      return;
    }
    showVideoFeedback("pause");
  });

  function normalizeVideo(video, index) {
    return {
      originalIndex: index,
      category: String(video.category || "未分類").trim(),
      title: String(video.title || "未命名影片").trim(),
      url: String(video.url || "").trim(),
      description: String(video.description || "尚未提供影片介紹。").trim(),
      order: video.order,
      visible: video.visible
    };
  }

  function renderCategoryTabs(items) {
    categoryTabs.innerHTML = items.map(function (category) {
      const activeClass = category === state.activeCategory ? " is-active" : "";
      return '<button class="category-tab' + activeClass + '" type="button" data-category="' + escapeHtml(category) + '">' + escapeHtml(category) + "</button>";
    }).join("");

    categoryTabs.querySelectorAll(".category-tab").forEach(function (button) {
      button.addEventListener("click", function () {
        state.activeCategory = button.dataset.category;
        renderCategoryTabs(categories);
        renderVideos();
      });
    });
  }

  function renderVideos() {
    const filteredVideos = getFilteredVideos();
    resultSummary.textContent = "共 " + filteredVideos.length + " 部影片";

    if (filteredVideos.length === 0) {
      videoGrid.innerHTML = "";
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;

    if (!filteredVideos.some(function (video) { return video.url === state.activeVideoUrl; })) {
      setActiveVideo(filteredVideos[0], false);
    }

    videoGrid.innerHTML = filteredVideos.map(renderVideoCard).join("");
    syncActiveCardState();

    videoGrid.querySelectorAll("[data-video-url]").forEach(function (item) {
      item.addEventListener("click", function () {
        const video = videos.find(function (item) {
          return item.url === this.dataset.videoUrl;
        }, this);

        if (!video) {
          return;
        }

        setActiveVideo(video);
        syncActiveCardState();
      });

      item.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();

        const video = videos.find(function (entry) {
          return entry.url === item.dataset.videoUrl;
        });

        if (!video) {
          return;
        }

        setActiveVideo(video);
        syncActiveCardState();
      });
    });
  }

  function getFilteredVideos() {
    return videos
      .filter(function (video) {
        const matchCategory = state.activeCategory === "全部影片" || video.category === state.activeCategory;
        const keyword = state.searchText;
        const matchSearch = !keyword || [video.title, video.description, video.category].join(" ").toLowerCase().includes(keyword);
        return matchCategory && matchSearch;
      })
      .sort(compareVideos);
  }

  function compareVideos(a, b) {
    const aHasOrder = Number.isFinite(Number(a.order));
    const bHasOrder = Number.isFinite(Number(b.order));

    if (aHasOrder && bHasOrder) {
      return Number(a.order) - Number(b.order);
    }

    if (aHasOrder) {
      return -1;
    }

    if (bHasOrder) {
      return 1;
    }

    return a.originalIndex - b.originalIndex;
  }

  function setActiveVideo(video, autoplay) {
    const shouldAutoplay = autoplay !== false;
    const isSameVideo = state.activeVideoUrl === video.url;
    state.activeVideoUrl = video.url;
    currentCategory.textContent = video.category;
    currentOrder.textContent = Number.isFinite(Number(video.order)) ? "排序 " + Number(video.order) : "";
    currentTitle.textContent = video.title;
    currentDescription.textContent = video.description;

    if (!isSameVideo) {
      videoPlayer.src = video.url;
      videoPlayer.setAttribute("aria-label", video.title);
      resetVideoFeedback();
    }

    if (shouldAutoplay) {
      const playResult = videoPlayer.play();
      if (playResult && typeof playResult.catch === "function") {
        playResult.catch(function () {
          return undefined;
        });
      }
    }
  }

  function syncActiveCardState() {
    videoGrid.querySelectorAll(".video-card").forEach(function (card) {
      const isActive = card.dataset.videoUrl === state.activeVideoUrl;
      card.classList.toggle("is-active", isActive);
      card.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function showVideoFeedback(type) {
    videoFeedback.classList.remove("is-play", "is-pause", "is-visible");
    void videoFeedback.offsetWidth;
    videoFeedback.classList.add(type === "pause" ? "is-pause" : "is-play", "is-visible");
  }

  function resetVideoFeedback() {
    videoFeedback.classList.remove("is-play", "is-pause", "is-visible");
  }

  function renderVideoCard(video) {
    const isActive = video.url === state.activeVideoUrl ? " is-active" : "";
    const orderText = Number.isFinite(Number(video.order)) ? "排序 " + Number(video.order) : "未設定排序";

    return (
      '<article class="video-card' + isActive + '" data-video-url="' + escapeAttribute(video.url) + '" tabindex="0" role="button" aria-label="播放 ' + escapeAttribute(video.title) + '">' +
        '<div class="video-card__preview">' +
          '<video class="video-card__thumb" src="' + escapeAttribute(video.url) + '" muted preload="metadata" playsinline></video>' +
          '<span class="video-card__play-icon">▶</span>' +
        "</div>" +
        '<div class="video-card__body">' +
          '<div class="video-card__meta">' +
            '<span class="video-card__tag">' + escapeHtml(video.category) + "</span>" +
            '<span class="video-card__order">' + escapeHtml(orderText) + "</span>" +
          "</div>" +
          "<h3>" + escapeHtml(video.title) + "</h3>" +
          "<p>" + escapeHtml(video.description) + "</p>" +
        "</div>" +
      "</article>"
    );
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }
})();
