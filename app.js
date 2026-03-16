(function () {
  const state = {
    activeCategory: "全部影片",
    searchText: "",
    activeVideoUrl: ""
  };
  const STORAGE_KEY = "xai-video-teaching:last-video-url";
  const REQUESTED_VIDEO_KEY = getRequestedVideoKey();
  let feedbackResetTimer = null;


  const categoryTabs = document.getElementById("categoryTabs");
  const videoGrid = document.getElementById("videoGrid");
  const emptyState = document.getElementById("emptyState");
  const resultSummary = document.getElementById("resultSummary");
  const searchInput = document.getElementById("searchInput");
  const videoPlayer = document.getElementById("videoPlayer");
  const playerPanel = document.querySelector(".player-panel");
  const idleOverlay = document.getElementById("idleOverlay");
  const videoFeedback = document.getElementById("videoFeedback");
  const currentCategory = document.getElementById("currentCategory");
  const currentOrder = document.getElementById("currentOrder");
  const currentTitle = document.getElementById("currentTitle");
  const currentDescription = document.getElementById("currentDescription");
  const copyVideoLinkButton = document.getElementById("copyVideoLink");
  const copyVideoLinkStatus = document.getElementById("copyVideoLinkStatus");

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

  copyVideoLinkButton.addEventListener("click", function () {
    copyCurrentVideoLink();
  });

  videoPlayer.addEventListener("play", function () {
    showVideoFeedback("play");
    syncPlayerOverlay();
  });

  videoPlayer.addEventListener("pause", function () {
    if (videoPlayer.ended) {
      syncPlayerOverlay();
      return;
    }
    showVideoFeedback("pause");
    syncPlayerOverlay();
  });

  videoPlayer.addEventListener("loadedmetadata", function () {
    syncPlayerOverlay();
  });

  videoPlayer.addEventListener("ended", function () {
    syncPlayerOverlay();
  });

  function normalizeVideo(video, index) {
    return {
      originalIndex: index,
      category: String(video.category || "未分類").trim(),
      title: String(video.title || "未命名影片").trim(),
      slug: String(video.slug || "").trim(),
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
        revealActivePlayer();
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
        revealActivePlayer();
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
    syncVideoUrl(video);
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

  function revealActivePlayer() {
    if (!playerPanel || !isMobileViewport()) {
      return;
    }

    playerPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function isMobileViewport() {
    return window.matchMedia("(max-width: 720px)").matches;
  }

  function getInitialVideo() {
    if (REQUESTED_VIDEO_KEY) {
      const requestedVideo = findVideoByKey(REQUESTED_VIDEO_KEY);
      if (requestedVideo) {
        return requestedVideo;
      }
    }

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

  function findVideoByKey(value) {
    const normalizedValue = String(value || "").trim().toLowerCase();
    if (!normalizedValue) {
      return null;
    }

    return videos.find(function (video) {
      const slug = getVideoSlug(video).toLowerCase();
      const fileKey = getVideoFileKey(video).toLowerCase();
      return (
        fileKey === normalizedValue ||
        fileKey.replace(/\.mp4$/i, "") === normalizedValue ||
        slug === normalizedValue ||
        video.url.toLowerCase() === normalizedValue ||
        video.title.toLowerCase() === normalizedValue
      );
    }) || null;
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

  function getRequestedVideoKey() {
    try {
      return new URLSearchParams(window.location.search).get("video") || "";
    } catch (error) {
      return "";
    }
  }

  function getVideoSlug(video) {
    if (video.slug) {
      return video.slug;
    }

    return getVideoFileKey(video).replace(/\.mp4$/i, "") || slugify(video.title || video.url || "");
  }

  function getVideoFileKey(video) {
    const match = String(video.url || "").match(/([^\/?#]+)$/);
    return match ? match[1] : "";
  }

  function getThumbnailUrl(url) {
    const normalizedUrl = String(url || "").trim();
    if (!normalizedUrl) {
      return "";
    }

    return normalizedUrl + (normalizedUrl.includes("#") ? "" : "#t=0.1");
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\.mp4$/i, "")
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function syncVideoUrl(video) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("video", getVideoSlug(video));
      window.history.replaceState({}, "", url.toString());
    } catch (error) {
      return;
    }
  }

  function copyCurrentVideoLink() {
    const activeVideo = videos.find(function (video) {
      return video.url === state.activeVideoUrl;
    });

    if (!activeVideo) {
      setCopyStatus("目前沒有可複製的影片");
      return;
    }

    const shareUrl = buildShareUrl(activeVideo);

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(shareUrl).then(function () {
        setCopyStatus("影片網址已複製");
      }).catch(function () {
        fallbackCopyText(shareUrl);
      });
      return;
    }

    fallbackCopyText(shareUrl);
  }

  function buildShareUrl(video) {
    const url = new URL(window.location.href);
    url.searchParams.set("video", getVideoSlug(video));
    return url.toString();
  }

  function fallbackCopyText(text) {
    const tempInput = document.createElement("input");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();

    try {
      document.execCommand("copy");
      setCopyStatus("影片網址已複製");
    } catch (error) {
      setCopyStatus("複製失敗，請手動複製網址");
    }

    document.body.removeChild(tempInput);
  }

  function setCopyStatus(message) {
    copyVideoLinkStatus.textContent = message;
    window.clearTimeout(setCopyStatus.timerId);
    setCopyStatus.timerId = window.setTimeout(function () {
      copyVideoLinkStatus.textContent = "";
    }, 2200);
  }

  function renderVideoCard(video) {
    const isActive = video.url === state.activeVideoUrl ? " is-active" : "";
    const orderText = Number.isFinite(Number(video.order)) ? "排序 " + Number(video.order) : "未設定排序";

    return (
      '<article class="video-card' + isActive + '" data-video-url="' + escapeAttribute(video.url) + '" tabindex="0" role="button" aria-label="播放 ' + escapeAttribute(video.title) + '">' +
        '<div class="video-card__preview">' +
          '<video class="video-card__thumb" src="' + escapeAttribute(getThumbnailUrl(video.url)) + '" muted preload="metadata" playsinline aria-hidden="true"></video>' +
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
