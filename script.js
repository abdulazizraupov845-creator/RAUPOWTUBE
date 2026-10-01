"use strict";

/* =========================================================
   RAUPOWTube
   YouTube Data API v3
========================================================= */

const CONFIG = {
    API_KEY: "AIzaSyARolPwNatxkHNnNZIAg_eH08dKJeX_2n4",

    API_URL:
        "https://www.googleapis.com/youtube/v3",

    MAX_RESULTS: 24,

    REGION: "UZ",

    LANGUAGE: "uz"
};


/* =========================================================
   STATE
========================================================= */

const STORAGE_KEY =
    "RAUPOW_TUBE_FINAL_V1";

const defaultState = {
    theme: "dark",

    liked: [],

    disliked: [],

    saved: [],

    history: [],

    subscriptions: [],

    queue: [],

    comments: {},

    searchHistory: [],

    lastSearch: ""
};

let state = {
    ...defaultState
};

let videos = [];

let recommendedVideos = [];

let currentVideo = null;

let currentSearch = "";

let sidebarOpen = false;


/* =========================================================
   DOM
========================================================= */

const $ = selector =>
    document.querySelector(selector);

const $$ = selector =>
    [...document.querySelectorAll(selector)];


/* =========================================================
   STORAGE
========================================================= */

function loadState() {

    try {

        const saved =
            localStorage.getItem(
                STORAGE_KEY
            );

        if (saved) {

            const parsed =
                JSON.parse(saved);

            state = {
                ...defaultState,
                ...parsed
            };
        }

    } catch (error) {

        console.error(
            "STATE LOAD ERROR:",
            error
        );

        state = {
            ...defaultState
        };
    }
}

function saveState() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(state)
        );

    } catch (error) {

        console.error(
            "STATE SAVE ERROR:",
            error
        );
    }
}


/* =========================================================
   HTML SAFETY
========================================================= */

function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   API
========================================================= */

async function youtubeRequest(
    endpoint,
    params = {}
) {

    if (
        !CONFIG.API_KEY ||
        CONFIG.API_KEY ===
            "YOUR_NEW_YOUTUBE_API_KEY"
    ) {

        throw new Error(
            "YouTube API key kiritilmagan."
        );
    }

    const url =
        new URL(
            `${CONFIG.API_URL}/${endpoint}`
        );

    Object.entries({
        ...params,
        key: CONFIG.API_KEY
    }).forEach(
        ([key, value]) => {

            if (
                value !== undefined &&
                value !== null &&
                value !== ""
            ) {

                url.searchParams.set(
                    key,
                    value
                );
            }
        }
    );

    const response =
        await fetch(
            url.toString()
        );

    const data =
        await response.json();

    if (!response.ok) {

        const message =
            data?.error?.message ||
            `HTTP ${response.status}`;

        throw new Error(
            message
        );
    }

    return data;
}


/* =========================================================
   FORMAT
========================================================= */

function formatViews(value) {

    const number =
        Number(value || 0);

    if (number >= 1000000000) {

        return (
            number / 1000000000
        ).toFixed(1) + " mlrd";
    }

    if (number >= 1000000) {

        return (
            number / 1000000
        ).toFixed(1) + " mln";
    }

    if (number >= 1000) {

        return (
            number / 1000
        ).toFixed(1) + " ming";
    }

    return String(number);
}

function formatDate(date) {

    if (!date) {
        return "";
    }

    const value =
        new Date(date);

    if (
        Number.isNaN(
            value.getTime()
        )
    ) {
        return "";
    }

    return value.toLocaleDateString(
        "uz-UZ",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}

function parseDuration(
    duration
) {

    if (!duration) {
        return "";
    }

    const match =
        duration.match(
            /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
        );

    if (!match) {
        return "";
    }

    const hours =
        Number(match[1] || 0);

    const minutes =
        Number(match[2] || 0);

    const seconds =
        Number(match[3] || 0);

    if (hours) {

        return [
            hours,
            String(minutes)
                .padStart(2, "0"),
            String(seconds)
                .padStart(2, "0")
        ].join(":");
    }

    return [
        minutes,
        String(seconds)
            .padStart(2, "0")
    ].join(":");
}


/* =========================================================
   NORMALIZE
========================================================= */

function normalizeVideos(
    items
) {

    return items
        .map(item => {

            const snippet =
                item.snippet || {};

            const stats =
                item.statistics || {};

            const details =
                item.contentDetails || {};

            const id =
                typeof item.id === "string"
                    ? item.id
                    : item.id?.videoId;

            if (!id) {
                return null;
            }

            return {

                id,

                title:
                    snippet.title ||
                    "Nomsiz video",

                description:
                    snippet.description ||
                    "",

                channel:
                    snippet.channelTitle ||
                    "Unknown channel",

                channelId:
                    snippet.channelId ||
                    "",

                thumbnail:
                    snippet.thumbnails?.high?.url ||
                    snippet.thumbnails?.medium?.url ||
                    snippet.thumbnails?.default?.url ||
                    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,

                publishedAt:
                    snippet.publishedAt ||
                    "",

                views:
                    Number(
                        stats.viewCount || 0
                    ),

                likes:
                    Number(
                        stats.likeCount || 0
                    ),

                duration:
                    parseDuration(
                        details.duration
                    )
            };
        })
        .filter(Boolean);
}


/* =========================================================
   CONTENT
========================================================= */

function getContent() {

    return $("#content");
}

function showLoading(
    message =
        "Videolar yuklanmoqda..."
) {

    const content =
        getContent();

    if (!content) {
        return;
    }

    content.innerHTML = `
        <div class="loading-screen">

            <div class="spinner"></div>

            <h2>
                RAUPOWTube
            </h2>

            <p>
                ${escapeHtml(message)}
            </p>

        </div>
    `;
}

function showError(
    message
) {

    const content =
        getContent();

    if (!content) {
        return;
    }

    content.innerHTML = `
        <div class="error-screen">

            <i
                class="fa-solid fa-triangle-exclamation"
                style="font-size:45px"
            ></i>

            <h2>
                Videolarni yuklab bo'lmadi
            </h2>

            <p>
                ${escapeHtml(message)}
            </p>

            <button
                id="retryButton"
                class="subscribe-btn"
                type="button"
            >
                Qayta urinish
            </button>

        </div>
    `;

    $("#retryButton")
        ?.addEventListener(
            "click",
            () => renderHome()
        );
}


/* =========================================================
   VIDEO CARD
========================================================= */

function videoCard(
    video
) {

    return `
        <article
            class="video-card"
            data-video-id="${escapeHtml(video.id)}"
        >

            <div class="video-thumbnail">

                <img
                    src="${escapeHtml(video.thumbnail)}"
                    alt="${escapeHtml(video.title)}"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                >

                ${
                    video.duration
                        ? `
                            <span class="video-duration">
                                ${escapeHtml(video.duration)}
                            </span>
                        `
                        : ""
                }

            </div>

            <div class="video-info">

                <div class="video-channel-avatar">
                    ${escapeHtml(
                        (
                            video.channel ||
                            "R"
                        )
                            .charAt(0)
                            .toUpperCase()
                    )}
                </div>

                <div class="video-text">

                    <div class="video-title">
                        ${escapeHtml(
                            video.title
                        )}
                    </div>

                    <div class="video-channel">
                        ${escapeHtml(
                            video.channel
                        )}
                    </div>

                    <div class="video-meta">

                        ${formatViews(
                            video.views
                        )}
                        ko'rish •
                        ${escapeHtml(
                            formatDate(
                                video.publishedAt
                            )
                        )}

                    </div>

                </div>

            </div>

        </article>
    `;
}


/* =========================================================
   VIDEO GRID
========================================================= */

function renderVideoGrid(
    list
) {

    const content =
        getContent();

    if (!content) {
        return;
    }

    content.innerHTML = `
        <div class="video-grid">
            ${list
                .map(videoCard)
                .join("")}
        </div>
    `;

    bindVideoCards();
}


/* =========================================================
   BIND CARDS
========================================================= */

function bindVideoCards() {

    $$(".video-card")
        .forEach(card => {

            card.addEventListener(
                "click",
                () => {

                    const id =
                        card.dataset.videoId;

                    const video =
                        findVideoById(id);

                    if (video) {
                        openPlayer(video);
                    }
                }
            );
        });
}


/* =========================================================
   HOME
========================================================= */

async function renderHome() {

    showLoading(
        "Eng yangi videolar yuklanmoqda..."
    );

    try {

        /*
         * order=date:
         * eng yangi videolar birinchi
         */

        const data =
            await youtubeRequest(
                "search",
                {
                    part: "snippet",

                    q:
                        "new videos",

                    type: "video",

                    order: "date",

                    maxResults:
                        CONFIG.MAX_RESULTS,

                    regionCode:
                        CONFIG.REGION,

                    relevanceLanguage:
                        CONFIG.LANGUAGE,

                    videoEmbeddable:
                        "true",

                    videoSyndicated:
                        "true",

                    safeSearch:
                        "none"
                }
            );

        const ids =
            (data.items || [])
                .map(
                    item =>
                        item.id?.videoId
                )
                .filter(Boolean);

        if (!ids.length) {

            throw new Error(
                "Yangi videolar topilmadi."
            );
        }

        const details =
            await youtubeRequest(
                "videos",
                {
                    part:
                        "snippet,contentDetails,statistics",

                    id:
                        ids.join(",")
                }
            );

        videos =
            normalizeVideos(
                details.items || []
            );

        /*
         * Frontendda ham yana
         * yangi -> eski
         */

        videos.sort(
            (a, b) =>
                new Date(
                    b.publishedAt || 0
                ) -
                new Date(
                    a.publishedAt || 0
                )
        );

        renderHomeHeader();

        renderVideoGrid(
            videos
        );

    } catch (error) {

        console.error(
            "HOME ERROR:",
            error
        );

        showError(
            error.message
        );
    }
}

function renderHomeHeader() {

    const content =
        getContent();

    if (!content) {
        return;
    }

    content.innerHTML = `
        <section class="page-header">

            <h1>
                Eng yangi videolar
            </h1>

            <p>
                YouTube'dagi eng yangi
                videolar
            </p>

        </section>

        <div id="homeGrid"></div>
    `;

    const grid =
        $("#homeGrid");

    grid.innerHTML = `
        <div class="video-grid">
            ${videos
                .map(videoCard)
                .join("")}
        </div>
    `;

    bindVideoCards();
}


/* =========================================================
   SEARCH
========================================================= */

async function performSearch(
    query
) {

    const cleanQuery =
        String(query || "")
            .trim();

    if (!cleanQuery) {

        await renderHome();

        return;
    }

    currentSearch =
        cleanQuery;

    state.lastSearch =
        cleanQuery;

    state.searchHistory =
        state.searchHistory.filter(
            item =>
                item.toLowerCase() !==
                cleanQuery.toLowerCase()
        );

    state.searchHistory.unshift(
        cleanQuery
    );

    state.searchHistory =
        state.searchHistory.slice(
            0,
            20
        );

    saveState();

    showLoading(
        `"${cleanQuery}" bo'yicha eng yangi videolar yuklanmoqda...`
    );

    try {

        const searchData =
            await youtubeRequest(
                "search",
                {
                    part: "snippet",

                    q:
                        cleanQuery,

                    type: "video",

                    /*
                     * ENG MUHIM:
                     * yangi video birinchi
                     */

                    order: "date",

                    maxResults:
                        CONFIG.MAX_RESULTS,

                    regionCode:
                        CONFIG.REGION,

                    relevanceLanguage:
                        CONFIG.LANGUAGE,

                    videoEmbeddable:
                        "true",

                    videoSyndicated:
                        "true",

                    safeSearch:
                        "none"
                }
            );

        const ids =
            (searchData.items || [])
                .map(
                    item =>
                        item.id?.videoId
                )
                .filter(Boolean);

        if (!ids.length) {

            videos = [];

            renderSearchResults(
                cleanQuery
            );

            return;
        }

        const details =
            await youtubeRequest(
                "videos",
                {
                    part:
                        "snippet,contentDetails,statistics",

                    id:
                        ids.join(",")
                }
            );

        videos =
            normalizeVideos(
                details.items || []
            );

        videos.sort(
            (a, b) =>
                new Date(
                    b.publishedAt || 0
                ) -
                new Date(
                    a.publishedAt || 0
                )
        );

        renderSearchResults(
            cleanQuery
        );

    } catch (error) {

        console.error(
            "SEARCH ERROR:",
            error
        );

        showError(
            error.message
        );
    }
}

function renderSearchResults(
    query
) {

    const content =
        getContent();

    if (!content) {
        return;
    }

    content.innerHTML = `
        <section class="page-header">

            <h1>
                Qidiruv:
                "${escapeHtml(query)}"
            </h1>

            <p>
                ${videos.length}
                ta video topildi
            </p>

        </section>

        <div id="searchGrid"></div>
    `;

    const grid =
        $("#searchGrid");

    if (!videos.length) {

        grid.innerHTML = `
            <div class="empty-screen">

                <i
                    class="fa-solid fa-magnifying-glass"
                    style="font-size:50px"
                ></i>

                <h2>
                    Video topilmadi
                </h2>

                <p>
                    Boshqa qidiruv so'zini kiriting.
                </p>

            </div>
        `;

        return;
    }

    grid.innerHTML = `
        <div class="video-grid">
            ${videos
                .map(videoCard)
                .join("")}
        </div>
    `;

    bindVideoCards();
}


/* =========================================================
   CATEGORY SEARCH
========================================================= */

async function searchCategory(
    category
) {

    if (
        !category ||
        category === "all"
    ) {

        await renderHome();

        return;
    }

    await performSearch(
        category
    );
}


/* =========================================================
   FIND VIDEO
========================================================= */

function findVideoById(
    id
) {

    return (
        videos.find(
            video =>
                video.id === id
        ) ||
        state.history.find(
            video =>
                video.id === id
        ) ||
        state.queue.find(
            video =>
                video.id === id
        ) ||
        recommendedVideos.find(
            video =>
                video.id === id
        )
    );
}


/* =========================================================
   PLAYER
========================================================= */

function createYouTubeEmbedURL(
    videoId
) {

    const origin =
        location.origin;

    const params =
        new URLSearchParams({
            autoplay: "1",
            rel: "0",
            playsinline: "1",
            modestbranding: "1",
            enablejsapi: "1",
            origin
        });

    return (
        `https://www.youtube.com/embed/` +
        `${encodeURIComponent(videoId)}?` +
        params.toString()
    );
}

function openPlayer(
    video,
    updateHistory = true
) {

    if (!video) {
        return;
    }

    currentVideo =
        video;

    const modal =
        $("#playerModal");

    const iframe =
        $("#youtubePlayer");

    if (!modal || !iframe) {
        return;
    }

    $("#playerTitle").textContent =
        video.title;

    $("#playerChannel").textContent =
        video.channel;

    $("#playerViews").textContent =
        `${formatViews(
            video.views
        )} ko'rish`;

    $("#playerDate").textContent =
        formatDate(
            video.publishedAt
        );

    $("#playerDescription").textContent =
        video.description ||
        "Video tavsifi mavjud emas.";

    $("#playerDescription")
        .classList.remove(
            "expanded"
        );

    $("#descriptionToggle")
        .textContent =
        "Ko'proq";

    renderPlayerButtons(
        video
    );

    renderComments(
        video
    );

    renderRecommended(
        video
    );

    iframe.src =
        createYouTubeEmbedURL(
            video.id
        );

    modal.classList.add(
        "active"
    );

    document.body.style.overflow =
        "hidden";

    if (updateHistory) {
        addToHistory(video);
    }
}

function closePlayer(
    changeHistory = true
) {

    const modal =
        $("#playerModal");

    const iframe =
        $("#youtubePlayer");

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "active"
    );

    document.body.style.overflow =
        "";

    if (iframe) {
        iframe.src =
            "about:blank";
    }

    currentVideo =
        null;

    if (
        changeHistory &&
        location.search
    ) {

        history.pushState(
            {},
            "",
            location.pathname
        );
    }
}


/* =========================================================
   PLAYER BUTTONS
========================================================= */

function renderPlayerButtons(
    video
) {

    if (!video) {
        return;
    }

    const like =
        $("#playerLike");

    const dislike =
        $("#playerDislike");

    const save =
        $("#playerSave");

    const subscribe =
        $("#subscribeButton");

    if (like) {

        const active =
            state.liked.includes(
                video.id
            );

        like.classList.toggle(
            "active",
            active
        );

        like.innerHTML =
            active
                ? `
                    <i class="fa-solid fa-thumbs-up"></i>
                    <span>Liked</span>
                `
                : `
                    <i class="fa-regular fa-thumbs-up"></i>
                    <span>Like</span>
                `;
    }

    if (dislike) {

        const active =
            state.disliked.includes(
                video.id
            );

        dislike.classList.toggle(
            "active",
            active
        );

        dislike.innerHTML =
            active
                ? `
                    <i class="fa-solid fa-thumbs-down"></i>
                    <span>Disliked</span>
                `
                : `
                    <i class="fa-regular fa-thumbs-down"></i>
                    <span>Dislike</span>
                `;
    }

    if (save) {

        const active =
            state.saved.includes(
                video.id
            );

        save.classList.toggle(
            "active",
            active
        );

        save.innerHTML =
            active
                ? `
                    <i class="fa-solid fa-bookmark"></i>
                    <span>Saqlangan</span>
                `
                : `
                    <i class="fa-regular fa-bookmark"></i>
                    <span>Saqlash</span>
                `;
    }

    if (subscribe) {

        const active =
            state.subscriptions.includes(
                video.channel
            );

        subscribe.textContent =
            active
                ? "Obuna bo'lingan ✓"
                : "Obuna bo'lish";
    }
}


/* =========================================================
   DESCRIPTION
========================================================= */

function toggleDescription() {

    const description =
        $("#playerDescription");

    const button =
        $("#descriptionToggle");

    if (!description || !button) {
        return;
    }

    const expanded =
        description.classList.toggle(
            "expanded"
        );

    button.textContent =
        expanded
            ? "Kamroq"
            : "Ko'proq";
}


/* =========================================================
   COMMENTS
========================================================= */

function getCommentsForVideo(
    videoId
) {

    if (
        !Array.isArray(
            state.comments[videoId]
        )
    ) {

        state.comments[videoId] =
            [];
    }

    return state.comments[videoId];
}

function formatCommentDate(
    date
) {

    const value =
        new Date(date);

    return value.toLocaleDateString(
        "uz-UZ"
    );
}

function renderComments(
    video
) {

    const list =
        $("#commentsList");

    const count =
        $("#commentsCount");

    if (!list || !count) {
        return;
    }

    const comments =
        getCommentsForVideo(
            video.id
        );

    count.textContent =
        comments.length;

    if (!comments.length) {

        list.innerHTML = `
            <div
                class="empty-screen"
                style="min-height:160px"
            >
                <i
                    class="fa-regular fa-comment"
                    style="font-size:35px"
                ></i>

                <p>
                    Hozircha kommentariya yo'q.
                </p>
            </div>
        `;

        return;
    }

    list.innerHTML =
        comments
            .map(
                comment => `
                    <article
                        class="comment-item"
                        data-comment-id="${escapeHtml(
                            comment.id
                        )}"
                    >

                        <div class="comment-avatar">
                            R
                        </div>

                        <div class="comment-body">

                            <div>

                                <span class="comment-name">
                                    ${escapeHtml(
                                        comment.author
                                    )}
                                </span>

                                <span class="comment-date">
                                    ${escapeHtml(
                                        formatCommentDate(
                                            comment.date
                                        )
                                    )}
                                </span>

                            </div>

                            <div class="comment-text">
                                ${escapeHtml(
                                    comment.text
                                )}
                            </div>

                            <div class="comment-actions">

                                <button
                                    type="button"
                                    data-comment-action="like"
                                >
                                    <i class="fa-regular fa-thumbs-up"></i>
                                    ${comment.likes || 0}
                                </button>

                                <button
                                    type="button"
                                    data-comment-action="delete"
                                >
                                    <i class="fa-solid fa-trash"></i>
                                    O'chirish
                                </button>

                            </div>

                        </div>

                    </article>
                `
            )
            .join("");

    bindCommentEvents();
}

function bindCommentEvents() {

    $$(".comment-item")
        .forEach(item => {

            const id =
                item.dataset.commentId;

            item.querySelector(
                '[data-comment-action="like"]'
            )?.addEventListener(
                "click",
                () =>
                    toggleCommentLike(
                        id
                    )
            );

            item.querySelector(
                '[data-comment-action="delete"]'
            )?.addEventListener(
                "click",
                () =>
                    deleteComment(
                        id
                    )
            );
        });
}

function addComment(
    text
) {

    if (!currentVideo) {
        return;
    }

    const clean =
        String(text || "")
            .trim();

    if (!clean) {
        showToast(
            "Kommentariya yozing."
        );

        return;
    }

    const comments =
        getCommentsForVideo(
            currentVideo.id
        );

    comments.unshift({
        id:
            `${Date.now()}_${Math.random()
                .toString(36)
                .slice(2)}`,

        author:
            "RAUPOW",

        text:
            clean,

        date:
            new Date().toISOString(),

        likes:
            0
    });

    saveState();

    const input =
        $("#commentInput");

    if (input) {
        input.value = "";
    }

    updateCommentCounter();

    renderComments(
        currentVideo
    );

    showToast(
        "Kommentariya qo'shildi."
    );
}

function toggleCommentLike(
    id
) {

    if (!currentVideo) {
        return;
    }

    const comments =
        getCommentsForVideo(
            currentVideo.id
        );

    const comment =
        comments.find(
            item =>
                item.id === id
        );

    if (!comment) {
        return;
    }

    comment.likes =
        Number(
            comment.likes || 0
        ) + 1;

    saveState();

    renderComments(
        currentVideo
    );
}

function deleteComment(
    id
) {

    if (!currentVideo) {
        return;
    }

    state.comments[
        currentVideo.id
    ] =
        getCommentsForVideo(
            currentVideo.id
        ).filter(
            comment =>
                comment.id !== id
        );

    saveState();

    renderComments(
        currentVideo
    );
}

function updateCommentCounter() {

    const input =
        $("#commentInput");

    const counter =
        $("#commentCounter");

    if (!input || !counter) {
        return;
    }

    counter.textContent =
        `${input.value.length} / 500`;
}

function cancelComment() {

    const input =
        $("#commentInput");

    if (input) {
        input.value = "";
    }

    updateCommentCounter();
}


/* =========================================================
   RECOMMENDED
========================================================= */

function getLocalRecommendedVideos(
    video
) {

    return videos
        .filter(
            item =>
                item.id !== video.id
        )
        .slice(0, 10);
}

function recommendedCard(
    video
) {

    return `
        <article
            class="recommended-card"
            data-recommended-video="${escapeHtml(
                video.id
            )}"
        >

            <div class="recommended-thumb">

                <img
                    src="${escapeHtml(
                        video.thumbnail
                    )}"
                    alt="${escapeHtml(
                        video.title
                    )}"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                >

                ${
                    video.duration
                        ? `
                            <span class="recommended-duration">
                                ${escapeHtml(
                                    video.duration
                                )}
                            </span>
                        `
                        : ""
                }

            </div>

            <div class="recommended-info">

                <div class="recommended-title">
                    ${escapeHtml(
                        video.title
                    )}
                </div>

                <div class="recommended-channel">
                    ${escapeHtml(
                        video.channel
                    )}
                </div>

                <div class="recommended-meta">
                    ${formatViews(
                        video.views
                    )}
                    ko'rish •
                    ${escapeHtml(
                        formatDate(
                            video.publishedAt
                        )
                    )}
                </div>

            </div>

        </article>
    `;
}

function renderRecommendedList(
    list
) {

    const container =
        $("#recommendedVideos");

    if (!container) {
        return;
    }

    if (!list.length) {

        container.innerHTML = `
            <div class="recommended-loading">
                Boshqa video topilmadi.
            </div>
        `;

        return;
    }

    container.innerHTML =
        list
            .map(
                recommendedCard
            )
            .join("");

    $$(
        "[data-recommended-video]"
    )
        .forEach(card => {

            card.addEventListener(
                "click",
                () => {

                    const id =
                        card.dataset
                            .recommendedVideo;

                    const video =
                        findVideoById(
                            id
                        );

                    if (video) {
                        openPlayer(
                            video
                        );
                    }
                }
            );
        });
}

async function loadRecommendedFromAPI(
    video
) {

    try {

        const searchData =
            await youtubeRequest(
                "search",
                {
                    part: "snippet",

                    q:
                        video.channel ||
                        video.title,

                    type: "video",

                    order: "date",

                    maxResults: 12,

                    regionCode:
                        CONFIG.REGION,

                    relevanceLanguage:
                        CONFIG.LANGUAGE,

                    videoEmbeddable:
                        "true",

                    videoSyndicated:
                        "true"
                }
            );

        const ids =
            (searchData.items || [])
                .map(
                    item =>
                        item.id?.videoId
                )
                .filter(
                    id =>
                        id &&
                        id !== video.id
                );

        if (!ids.length) {
            return [];
        }

        const details =
            await youtubeRequest(
                "videos",
                {
                    part:
                        "snippet,contentDetails,statistics",

                    id:
                        ids.join(",")
                }
            );

        const result =
            normalizeVideos(
                details.items || []
            );

        result.sort(
            (a, b) =>
                new Date(
                    b.publishedAt || 0
                ) -
                new Date(
                    a.publishedAt || 0
                )
        );

        return result;

    } catch (error) {

        console.warn(
            "RECOMMENDED ERROR:",
            error
        );

        return [];
    }
}

async function renderRecommended(
    video
) {

    const container =
        $("#recommendedVideos");

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="recommended-loading">

            <div class="spinner small"></div>

            <span>
                Videolar yuklanmoqda...
            </span>

        </div>
    `;

    recommendedVideos =
        getLocalRecommendedVideos(
            video
        );

    renderRecommendedList(
        recommendedVideos
    );

    const apiVideos =
        await loadRecommendedFromAPI(
            video
        );

    if (
        !currentVideo ||
        currentVideo.id !== video.id
    ) {
        return;
    }

    const merged = [
        ...apiVideos,
        ...recommendedVideos
    ];

    const unique = [];
    const seen = new Set();

    for (
        const item of merged
    ) {

        if (
            !item?.id ||
            item.id === video.id ||
            seen.has(item.id)
        ) {
            continue;
        }

        seen.add(item.id);

        unique.push(item);
    }

    recommendedVideos =
        unique.slice(0, 12);

    renderRecommendedList(
        recommendedVideos
    );
}


/* =========================================================
   HISTORY
========================================================= */

function addToHistory(
    video
) {

    state.history =
        state.history.filter(
            item =>
                item.id !== video.id
        );

    state.history.unshift(
        video
    );

    state.history =
        state.history.slice(
            0,
            100
        );

    saveState();
}


/* =========================================================
   LIKE / DISLIKE / SAVE
========================================================= */

function toggleArrayItem(
    array,
    id
) {

    const index =
        array.indexOf(id);

    if (index >= 0) {

        array.splice(
            index,
            1
        );

        return false;
    }

    array.push(id);

    return true;
}

function toggleLike() {

    if (!currentVideo) {
        return;
    }

    const liked =
        toggleArrayItem(
            state.liked,
            currentVideo.id
        );

    state.disliked =
        state.disliked.filter(
            id =>
                id !== currentVideo.id
        );

    saveState();

    renderPlayerButtons(
        currentVideo
    );

    showToast(
        liked
            ? "Like 👍"
            : "Like olib tashlandi"
    );
}

function toggleDislike() {

    if (!currentVideo) {
        return;
    }

    const disliked =
        toggleArrayItem(
            state.disliked,
            currentVideo.id
        );

    state.liked =
        state.liked.filter(
            id =>
                id !== currentVideo.id
        );

    saveState();

    renderPlayerButtons(
        currentVideo
    );

    showToast(
        disliked
            ? "Dislike qo'yildi"
            : "Dislike olib tashlandi"
    );
}

function toggleSave() {

    if (!currentVideo) {
        return;
    }

    const saved =
        toggleArrayItem(
            state.saved,
            currentVideo.id
        );

    saveState();

    renderPlayerButtons(
        currentVideo
    );

    showToast(
        saved
            ? "Saqlanganlarga qo'shildi"
            : "Saqlanganlardan olib tashlandi"
    );
}


/* =========================================================
   SUBSCRIBE
========================================================= */

function toggleSubscription(
    channel
) {

    const index =
        state.subscriptions.indexOf(
            channel
        );

    if (index >= 0) {

        state.subscriptions.splice(
            index,
            1
        );

        showToast(
            "Obuna bekor qilindi"
        );

    } else {

        state.subscriptions.push(
            channel
        );

        showToast(
            "Obuna bo'lindi 🔔"
        );
    }

    saveState();

    if (currentVideo) {

        renderPlayerButtons(
            currentVideo
        );
    }
}


/* =========================================================
   SHARE
========================================================= */

async function shareCurrentVideo() {

    if (!currentVideo) {
        return;
    }

    const url =
        `https://www.youtube.com/watch?v=${encodeURIComponent(
            currentVideo.id
        )}`;

    try {

        await navigator.clipboard.writeText(
            url
        );

        showToast(
            "Havola nusxalandi"
        );

    } catch {

        showToast(
            url
        );
    }
}


/* =========================================================
   QUEUE
========================================================= */

function addToQueue(
    video
) {

    if (
        state.queue.some(
            item =>
                item.id === video.id
        )
    ) {

        showToast(
            "Video navbatda bor"
        );

        return;
    }

    state.queue.push(
        video
    );

    saveState();

    showToast(
        "Navbatga qo'shildi"
    );
}


/* =========================================================
   LOCAL PAGES
========================================================= */

function renderLocalPage(
    type
) {

    const content =
        getContent();

    if (!content) {
        return;
    }

    let list = [];

    let title = "";

    let icon =
        "fa-layer-group";

    if (
        type === "history"
    ) {

        list =
            state.history;

        title =
            "Tarix";

        icon =
            "fa-clock-rotate-left";
    }

    if (
        type === "saved"
    ) {

        list =
            state.history.filter(
                video =>
                    state.saved.includes(
                        video.id
                    )
            );

        title =
            "Saqlanganlar";

        icon =
            "fa-bookmark";
    }

    if (
        type === "liked"
    ) {

        list =
            state.history.filter(
                video =>
                    state.liked.includes(
                        video.id
                    )
            );

        title =
            "Yoqtirgan videolar";

        icon =
            "fa-thumbs-up";
    }

    if (
        type === "subscriptions"
    ) {

        list =
            state.history.filter(
                video =>
                    state.subscriptions.includes(
                        video.channel
                    )
            );

        title =
            "Obunalar";

        icon =
            "fa-bell";
    }

    if (
        type === "queue"
    ) {

        list =
            state.queue;

        title =
            "Navbat";

        icon =
            "fa-list";
    }

    content.innerHTML = `
        <section class="page-header">

            <h1>
                <i
                    class="fa-solid ${icon}"
                ></i>

                ${escapeHtml(title)}
            </h1>

        </section>

        ${
            list.length
                ? `
                    <div class="video-grid">
                        ${list
                            .map(videoCard)
                            .join("")}
                    </div>
                `
                : `
                    <div class="empty-screen">

                        <i
                            class="fa-solid ${icon}"
                            style="font-size:45px"
                        ></i>

                        <h2>
                            Hozircha hech narsa yo'q
                        </h2>

                    </div>
                `
        }
    `;

    bindVideoCards();
}


/* =========================================================
   THEME
========================================================= */

function applyTheme() {

    document.body.classList.toggle(
        "light-theme",
        state.theme === "light"
    );

    const button =
        $("#themeToggle");

    if (!button) {
        return;
    }

    button.innerHTML =
        state.theme === "light"
            ? `
                <i class="fa-solid fa-moon"></i>
            `
            : `
                <i class="fa-solid fa-sun"></i>
            `;
}

function toggleTheme() {

    state.theme =
        state.theme === "dark"
            ? "light"
            : "dark";

    saveState();

    applyTheme();
}


/* =========================================================
   SIDEBAR
========================================================= */

function toggleSidebar() {

    sidebarOpen =
        !sidebarOpen;

    document.body.classList.toggle(
        "sidebar-open",
        sidebarOpen
    );
}


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message
) {

    const toast =
        $("#raupowToast");

    if (!toast) {
        return;
    }

    toast.textContent =
        message;

    toast.classList.add(
        "show"
    );

    clearTimeout(
        showToast.timer
    );

    showToast.timer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2500
        );
}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

    $("#homeLogo")
        ?.addEventListener(
            "click",
            () =>
                renderHome()
        );

    $("#searchForm")
        ?.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                performSearch(
                    $("#searchInput")
                        ?.value || ""
                );
            }
        );

    $("#menuToggle")
        ?.addEventListener(
            "click",
            toggleSidebar
        );

    $("#themeToggle")
        ?.addEventListener(
            "click",
            toggleTheme
        );

    $("#closePlayer")
        ?.addEventListener(
            "click",
            () =>
                closePlayer()
        );

    $("#playerLike")
        ?.addEventListener(
            "click",
            toggleLike
        );

    $("#playerDislike")
        ?.addEventListener(
            "click",
            toggleDislike
        );

    $("#playerSave")
        ?.addEventListener(
            "click",
            toggleSave
        );

    $("#playerShare")
        ?.addEventListener(
            "click",
            shareCurrentVideo
        );

    $("#subscribeButton")
        ?.addEventListener(
            "click",
            () => {

                if (currentVideo) {

                    toggleSubscription(
                        currentVideo.channel
                    );
                }
            }
        );

    $("#descriptionToggle")
        ?.addEventListener(
            "click",
            toggleDescription
        );

    $("#commentForm")
        ?.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                addComment(
                    $("#commentInput")
                        ?.value || ""
                );
            }
        );

    $("#commentInput")
        ?.addEventListener(
            "input",
            updateCommentCounter
        );

    $("#cancelComment")
        ?.addEventListener(
            "click",
            cancelComment
        );


    $$(".category")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        $$(".category")
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "active"
                                    )
                            );

                        button.classList.add(
                            "active"
                        );

                        searchCategory(
                            button.dataset
                                .category
                        );
                    }
                );
            }
        );


    $$(".category-side")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        searchCategory(
                            button.dataset
                                .category
                        );

                        if (
                            sidebarOpen
                        ) {
                            toggleSidebar();
                        }
                    }
                );
            }
        );


    $$("[data-page]")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const page =
                            button.dataset.page;

                        if (
                            page === "home"
                        ) {

                            renderHome();

                        } else {

                            renderLocalPage(
                                page
                            );
                        }

                        $$(".sidebar-item")
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "active"
                                    )
                            );

                        button.classList.add(
                            "active"
                        );

                        if (
                            window.innerWidth <= 850 &&
                            sidebarOpen
                        ) {

                            toggleSidebar();
                        }
                    }
                );
            }
        );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closePlayer();
            }

            if (
                event.key === "/" &&
                document.activeElement !==
                    $("#searchInput")
            ) {

                event.preventDefault();

                $("#searchInput")
                    ?.focus();
            }
        }
    );
}


/* =========================================================
   INIT
========================================================= */

async function init() {

    loadState();

    applyTheme();

    setupEvents();

    await renderHome();

    console.log(
        "RAUPOWTube ishga tushdi."
    );
}

document.addEventListener(
    "DOMContentLoaded",
    init
);


/* =========================================================
   GLOBAL
========================================================= */

window.performSearch =
    performSearch;

window.openPlayer =
    openPlayer;

window.closePlayer =
    closePlayer;

window.renderHome =
    renderHome;