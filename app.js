(function () {
  const state = {
    activeCategory: "全部影片",
    searchText: ""
  };

  const categoryTabs = document.getElementById("categoryTabs");
  const videoGrid = document.getElementById("videoGrid");
  const emptyState = document.getElementById("emptyState");
  const resultSummary = document.getElementById("resultSummary");
  const searchInput = document.getElementById("searchInput");

  const rawVideos = Array.isArray(window.videoData) ? window.videoData : [];
  const videos = rawVideos
    .map(normalizeVideo)
    .filter((video) => video.visible !== false);

  const categories = ["全部影片", ...new Set(videos.map((video) => video.category).filter(Boolean))];

  renderCategoryTabs(categories);
  renderVideos();

  searchInput.addEventListener("input", function (event) {
    state.searchText = event.target.value.trim().toLowerCase();
    renderVideos();
  });

  function normalizeVideo(video, index) {
    const normalized = { ...video };
    normalized.originalIndex = index;
    normalized.category = String(video.category || "未分類").trim();
    normalized.title = String(video.title || "未命名影片").trim();
    normalized.url = String(video.url || "").trim();
    normalized.description = String(video.description || "尚未提供影片介紹。").trim();
    normalized.thumbnail = String(video.thumbnail || "").trim() || buildYoutubeThumbnail(normalized.url);
    return normalized;
  }

  function renderCategoryTabs(items) {
    categoryTabs.innerHTML = items
      .map(function (category) {
        const activeClass = category === state.activeCategory ? " is-active" : "";
        return (
          '<button class="category-tab' + activeClass + '" type="button" data-category="' + escapeHtml(category) + '">' +
            escapeHtml(category) +
          "</button>"
        );
      })
      .join("");

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
    videoGrid.innerHTML = filteredVideos.map(renderVideoCard).join("");
  }

  function getFilteredVideos() {
    return videos
      .filter(function (video) {
        const matchCategory = state.activeCategory === "全部影片" || video.category === state.activeCategory;
        const keyword = state.searchText;
        const matchSearch = !keyword || [video.title, video.description, video.category]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
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

  function renderVideoCard(video) {
    const orderText = Number.isFinite(Number(video.order)) ? "排序 " + Number(video.order) : "未設定排序";
    return (
      '<article class="video-card">' +
        '<div class="video-card__thumbnail">' +
          '<img src="' + escapeAttribute(video.thumbnail) + '" alt="' + escapeAttribute(video.title + " 縮圖") + '" loading="lazy">' +
          '<span class="video-card__play">YouTube 教學</span>' +
        "</div>" +
        '<div class="video-card__body">' +
          '<div class="video-card__meta">' +
            '<span class="video-card__tag">' + escapeHtml(video.category) + "</span>" +
            '<span class="video-card__order">' + escapeHtml(orderText) + "</span>" +
          "</div>" +
          "<h3>" + escapeHtml(video.title) + "</h3>" +
          "<p>" + escapeHtml(video.description) + "</p>" +
          '<div class="video-card__actions">' +
            '<a class="video-card__button" href="' + escapeAttribute(video.url) + '" target="_blank" rel="noopener noreferrer">觀看影片</a>' +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function buildYoutubeThumbnail(url) {
    const videoId = extractYoutubeId(url);
    return videoId ? "https://img.youtube.com/vi/" + videoId + "/hqdefault.jpg" : "";
  }

  function extractYoutubeId(url) {
    if (!url) {
      return "";
    }

    const patterns = [
      /youtube\.com\/watch\?v=([^&#]+)/i,
      /youtu\.be\/([^?&#]+)/i,
      /youtube\.com\/embed\/([^?&#]+)/i,
      /youtube\.com\/shorts\/([^?&#]+)/i
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return "";
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
