(function () {
  "use strict";
  var listMount = document.querySelector("[data-content-list]");
  var detailMount = document.querySelector("[data-content-detail]");
  var requestedKind = (listMount || detailMount)?.getAttribute(listMount ? "data-content-list" : "data-content-detail");
  var kind = requestedKind === "research" ? "research" : requestedKind === "events" || requestedKind === "event" ? "events" : "news";
  var esc = function (value) { var node = document.createElement("div"); node.textContent = String(value || ""); return node.innerHTML; };
  var date = function (page) { return new Date(page.updatedAt || page.updated_at || page.createdAt || Date.now()).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); };
  var detailUrl = function (page) {
    var source = page.sourceUrl || page.source_url || "";
    if (kind === "events" && source && !/^https?:\/\//i.test(source)) return source;
    return "/legacy/" + (kind === "research" ? "research-details.html" : kind === "events" ? "event-details.html" : "blog-details.html") + "?slug=" + encodeURIComponent(page.slug);
  };
  var apiBases = window.MWU_CONTENT_API_URL ? [String(window.MWU_CONTENT_API_URL).replace(/\/$/, "")] : ["/api", "https://admin.maddauni.online/api"];
  function apiFetch(path) {
    var index = 0;
    function attempt() {
      return fetch(apiBases[index] + path, { headers: { Accept: "application/json" } }).then(function (response) {
        if (!response.ok) throw new Error("Content API unavailable");
        return response.json();
      }).catch(function (error) {
        index += 1;
        if (index < apiBases.length) return attempt();
        throw error;
      });
    }
    return attempt();
  }

  function loadList() {
    listMount.innerHTML = '<p class="mwu-cpt-state">Loading published content…</p>';
    apiFetch("/pages?kind=" + kind + "&limit=50")
      .then(function (payload) {
        var pages = (payload.pages || payload.data || []).filter(function (page) { return page.slug !== kind && page.slug !== "blog"; });
        listMount.innerHTML = pages.length ? pages.map(function (page) {
          var image = page.heroImage || page.hero_image || "/assets/img/blog/blog_3_1.jpg";
          return '<article class="mwu-cpt-card"><a href="' + detailUrl(page) + '"><img src="' + esc(image) + '" alt=""></a><div class="mwu-cpt-card-body"><time>' + esc(date(page)) + '</time><h2><a href="' + detailUrl(page) + '">' + esc(page.title) + '</a></h2><p>' + esc(page.summary || "") + '</p><a href="' + detailUrl(page) + '">Read more →</a></div></article>';
        }).join("") : '<p class="mwu-cpt-state">No published ' + kind + ' items yet.</p>';
        document.querySelectorAll("[data-content-fallback]").forEach(function (fallback) { fallback.hidden = true; });
        if (kind === "news") listMount.parentElement.querySelectorAll(":scope > .th-blog").forEach(function (fallback) { fallback.hidden = true; });
      }).catch(function () { listMount.innerHTML = '<p class="mwu-cpt-state">Content is temporarily unavailable.</p>'; });
  }

  function loadDetail() {
    var slug = new URLSearchParams(location.search).get("slug");
    if (!slug) return;
    detailMount.innerHTML = '<p class="mwu-cpt-state">Loading…</p>';
    apiFetch("/pages/" + encodeURIComponent(slug))
      .then(function (payload) {
        var page = payload.page || payload.data?.page;
        if (!page) throw new Error();
        var body = page.bodyHtml || page.body_html || (page.sections || []).filter(function (section) { return section.visible !== false; }).map(function (section) { return '<section><h2>' + esc(section.title || "") + '</h2><div>' + (section.html || section.body || "") + '</div></section>'; }).join("") || '<p>' + esc(page.summary || "") + '</p>';
        document.title = (page.seoTitle || page.seo_title || page.title) + " | Madda Walabu University";
        detailMount.innerHTML = '<article class="mwu-cpt-detail">' + ((page.heroImage || page.hero_image) ? '<img class="mwu-cpt-hero" src="' + esc(page.heroImage || page.hero_image) + '" alt="">' : '') + '<div class="mwu-cpt-detail-meta"><span>' + esc(page.owner || (kind === "research" ? "Research Directorate" : "MWU Communications")) + '</span><time>' + esc(date(page)) + '</time></div><h1>' + esc(page.title) + '</h1><div class="mwu-cpt-detail-body">' + body + '</div></article>';
        var fallback = document.querySelector("[data-detail-fallback]");
        if (fallback) fallback.hidden = true;
      }).catch(function () { detailMount.innerHTML = '<p class="mwu-cpt-state">This published item could not be found.</p>'; });
  }

  if (listMount) loadList();
  if (detailMount) loadDetail();
}());
