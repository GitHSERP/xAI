(function () {
  const state = {
    activeCategory: "全部影片",
    searchText: "",
    activeVideoUrl: "",
    pendingRestoreTime: 0
  };
  const STORAGE_KEY = "xai-video-teaching:last-video-url";
  const TIME_STORAGE_KEY = "xai-video-teaching:playback-times";
  let feedbackResetTimer = null;

  const categoryTabs = document.getElementById("categoryTabs");
  const videoGrid = document.getElementById("videoGrid");
  const emptyState = document.getElementById("emptyState");
  const resultSummary = document.getElementById("resultSummary");
  const searchInput = document.getElementById("searchInput");
  const videoPlayer = document.getElementById("videoPlayer");
  const idleOverlay = document.getElementById("idleOverlay");
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
    const initialVideo = getInitialVideo();
    setActiveVideo(initialVideo);
  }

  renderVideos();
  syncPlayerOverlay();

  searchInput.addEventListener("input", function (event) {
    state.searchText = event.target.value.trim().toLowerCase();
    renderVideos();
  });

  videoPlayer.addEventListener("play", function () {
    showVideoFeedback("play");
    syncPlayerOverlay();
  });

  videoPlayer.addEventListener("pause", function () {
    persistPlaybackTime(state.activeVideoUrl, videoPlayer.currentTime);
    if (videoPlayer.ended) {
      syncPlayerOverlay();
      return;
    }
    showVideoFeedback("pause");
    syncPlayerOverlay();
  });

  videoPlayer.addEventListener("timeupdate", function () {
    persistPlaybackTime(state.activeVideoUrl, videoPlayer.currentTime);
  });

  videoPlayer.addEventListener("loadedmetadata", function () {
    restorePlaybackTime();
    syncPlayerOverlay();
  });

  videoPlayer.addEventListener("ended", function () {
    persistPlaybackTime(state.activeVideoUrl, 0);
    syncPlayerOverlay();
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
    persistLastVideo(video.url);
    currentCategory.textContent = video.category;
    currentOrder.textContent = Number.isFinite(Number(video.order)) ? "排序 " + Number(video.order) : "";
    currentTitle.textContent = video.title;
    currentDescription.textContent = video.description;

    if (!isSameVideo) {
      videoPlayer.src = video.url;
      videoPlayer.setAttribute("aria-label", video.title);
      resetVideoFeedback();
      state.pendingRestoreTime = getPersistedPlaybackTime(video.url);
    }

    if (shouldAutoplay) {
      const playResult = videoPlayer.play();
      if (playResult && typeof playResult.catch === "function") {
        playResult.catch(function () {
          syncPlayerOverlay();
          return undefined;
        });
      }
    } else {
      syncPlayerOverlay();
    }
  }

  function syncActiveCardState() {
    videoGrid.querySelectorAll(".video-card").forEach(function (card) {
      const isActive = card.dataset.videoUrl === state.activeVideoUrl;
      card.classList.toggle("is-active", isActive);
      card.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function getInitialVideo() {
    const savedUrl = getPersistedLastVideo();
    if (savedUrl) {
      const matchedVideo = videos.find(function (video) {
        return video.url === savedUrl;
      });

      if (matchedVideo) {
        return matchedVideo;
      }
    }

    return videos.slice().sort(compareVideos)[0];
  }

  function getPersistedLastVideo() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function persistLastVideo(url) {
    try {
      window.localStorage.setItem(STORAGE_KEY, url);
    } catch (error) {
      return;
    }
  }

  function getPersistedPlaybackTime(url) {
    if (!url) {
      return 0;
    }

    try {
      const rawValue = window.localStorage.getItem(TIME_STORAGE_KEY);
      const timeMap = rawValue ? JSON.parse(rawValue) : {};
      const savedTime = Number(timeMap[url]);
      return Number.isFinite(savedTime) && savedTime > 0 ? savedTime : 0;
    } catch (error) {
      return 0;
    }
  }

  function persistPlaybackTime(url, time) {
    if (!url || !Number.isFinite(time)) {
      return;
    }

    try {
      const rawValue = window.localStorage.getItem(TIME_STORAGE_KEY);
      const timeMap = rawValue ? JSON.parse(rawValue) : {};
      timeMap[url] = Math.max(0, Math.floor(time));
      window.localStorage.setItem(TIME_STORAGE_KEY, JSON.stringify(timeMap));
    } catch (error) {
      return;
    }
  }

  function restorePlaybackTime() {
    const restoreTime = state.pendingRestoreTime;
    if (!Number.isFinite(restoreTime) || restoreTime <= 0) {
      return;
    }

    const safeTime = Math.max(0, Math.min(restoreTime, Math.max(0, videoPlayer.duration - 1)));
    if (safeTime > 0) {
      videoPlayer.currentTime = safeTime;
    }
    state.pendingRestoreTime = 0;
  }

  function showVideoFeedback(type) {
    if (feedbackResetTimer) {
      window.clearTimeout(feedbackResetTimer);
    }

    videoFeedback.classList.remove("is-play", "is-pause", "is-visible", "is-idle");
    void videoFeedback.offsetWidth;
    videoFeedback.classList.add(type === "pause" ? "is-pause" : "is-play", "is-visible");

    feedbackResetTimer = window.setTimeout(function () {
      videoFeedback.classList.remove("is-play", "is-pause", "is-visible");
      syncPlayerOverlay();
    }, 420);
  }

  function resetVideoFeedback() {
    if (feedbackResetTimer) {
      window.clearTimeout(feedbackResetTimer);
      feedbackResetTimer = null;
    }
    videoFeedback.classList.remove("is-play", "is-pause", "is-visible");
  }

  function syncPlayerOverlay() {
    const isStopped = !videoPlayer.src || videoPlayer.paused || videoPlayer.ended;
    idleOverlay.classList.toggle("is-visible", isStopped);
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
