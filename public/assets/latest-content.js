(function () {
  "use strict";

  var mount = document.querySelector("[data-latest-content]");
  if (!mount) return;

  var kind = mount.getAttribute("data-latest-content") === "research" ? "research" : "news";
  var heading = kind === "research" ? "Latest Research" : "Latest News";
  var currentPath = window.location.pathname.replace(/\/$/, "");

  function text(value) {
    var node = document.createElement("textarea");
    node.textContent = String(value || "");
    return node.innerHTML;
  }

  function pageUrl(page) {
    var source = page.sourceUrl || page.source_url || "";
    if (source && !/^https?:\/\//i.test(source)) return source;
    return "/" + String(page.slug || "").replace(/^\/+|\/+$/g, "");
  }

  function render(pages) {
    var items = pages.filter(function (page) {
      return page && page.slug && pageUrl(page).replace(/\/$/, "") !== currentPath;
    }).slice(0, 5);
    if (!items.length) return;

    mount.innerHTML = '<div class="mwu-latest-head"><div><span>Recently updated</span><h2>' + heading +
      '</h2></div><div class="mwu-latest-controls"><button type="button" data-prev aria-label="Previous">&#8592;</button><button type="button" data-next aria-label="Next">&#8594;</button></div></div>' +
      '<div class="mwu-latest-track">' + items.map(function (page) {
        var image = page.heroImage || page.hero_image || "/assets/img/blog/blog_3_1.jpg";
        var date = new Date(page.updatedAt || page.updated_at || page.createdAt || Date.now());
        return '<a class="mwu-latest-card" href="' + text(pageUrl(page)) + '"><img src="' + text(image) + '" alt=""><div><time>' +
          text(date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })) + '</time><h3>' +
          text(page.title) + '</h3><span>Read more &#8594;</span></div></a>';
      }).join("") + '</div>';

    var track = mount.querySelector(".mwu-latest-track");
    mount.querySelector("[data-prev]").onclick = function () { track.scrollBy({ left: -track.clientWidth * 0.8, behavior: "smooth" }); };
    mount.querySelector("[data-next]").onclick = function () { track.scrollBy({ left: track.clientWidth * 0.8, behavior: "smooth" }); };
  }

  fetch("/api/pages?kind=" + kind + "&limit=6", { headers: { Accept: "application/json" } })
    .then(function (response) { if (!response.ok) throw new Error("feed"); return response.json(); })
    .then(function (payload) { render(payload.pages || payload.data || []); })
    .catch(function () { mount.hidden = true; });
}());
