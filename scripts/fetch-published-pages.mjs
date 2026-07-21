import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";

const SITE_ORIGIN = "https://maddauni.online";
const OUTPUT_PATH = "public/data/live-published-pages.json";

const excludedSlugs = new Set([
  "cart",
  "checkout",
  "wishlist",
  "shop",
  "shop-details",
  "typography",
  "pricing",
  "error"
]);

const pageTypeFromSlug = (slug) => {
  if (slug === "index") return "Home Section";
  if (slug.startsWith("program-") || slug.startsWith("programs-") || slug === "program") return "Academic Program";
  if (slug.startsWith("admission")) return "Admission Page";
  if (slug.startsWith("blog")) return "News Article";
  if (slug.startsWith("event")) return "Event";
  if (slug.includes("research")) return "Research Page";
  return "Campus Page";
};

const menuFromSlug = (slug) => {
  if (slug === "index") return "Home";
  if (slug.startsWith("program-") || slug.startsWith("programs-") || slug === "program") return "Programs";
  if (slug.startsWith("admission")) return "Admissions";
  if (slug.startsWith("blog")) return "Blogs";
  if (slug.startsWith("event")) return "Events";
  if (slug === "contact") return "Contact Us";
  return "About Us";
};

const cleanText = (value = "") =>
  value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const stripDangerousHtml = (html = "") =>
  String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+=(['"]).*?\1/gi, "")
    .replace(/javascript:/gi, "");

const extractAttribute = (html, pattern) => {
  const match = html.match(pattern);
  return match?.[1]?.trim() || "";
};

const titleFromSlug = (slug) =>
  slug === "index"
    ? "Home"
    : slug
        .replace(/^program-ug-/, "")
        .replace(/^program-pg-/, "")
        .replace(/^program-phd-/, "")
        .replace(/^blog-details-/, "")
        .replace(/^event-details-/, "")
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

const absolutePath = (value) => {
  if (!value) return `${SITE_ORIGIN}/assets/img/hero/hero-home.webp`;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) return value;
  return new URL(value.replace(/^\/+/, "/"), SITE_ORIGIN).toString();
};

const fetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; MWUContentSync/1.0; +https://maddauni.online)"
    }
  });
  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}: ${response.status}`);
  }
  return response.text();
};

const getBundleRouteSlugs = async () => {
  let html = "";
  try {
    html = await fetchText(SITE_ORIGIN);
  } catch {
    const localFiles = await readdir("public/legacy");
    return localFiles
      .filter((file) => file.endsWith(".html"))
      .map((file) => file.replace(/\.html$/i, ""))
      .filter((slug) => !excludedSlugs.has(slug));
  }
  const bundlePath = extractAttribute(html, /<script[^>]+type=["']module["'][^>]+src=["']([^"']+\.js)["']/i);
  if (!bundlePath) {
    const localFiles = await readdir("public/legacy");
    return localFiles
      .filter((file) => file.endsWith(".html"))
      .map((file) => file.replace(/\.html$/i, ""))
      .filter((slug) => !excludedSlugs.has(slug));
  }

  const bundle = await fetchText(new URL(bundlePath, SITE_ORIGIN).toString());
  const end = bundle.indexOf("],cu=new Set(Fm)");
  const start = bundle.lastIndexOf("[", end);
  if (start < 0 || end < 0) {
    throw new Error("Could not locate legacy route list in deployed bundle.");
  }

  return JSON.parse(bundle.slice(start, end + 1))
    .filter((slug) => typeof slug === "string")
    .filter((slug) => !excludedSlugs.has(slug));
};

const extractSections = (bodyHtml, title, summary, firstImage, slug) => {
  const safeBodyHtml = stripDangerousHtml(bodyHtml);
  const sectionMatches = [...safeBodyHtml.matchAll(/<(section|main|header|footer)[^>]*>[\s\S]*?<\/\1>/gi)]
    .slice(0, 30)
    .map((match, index) => {
      const html = match[0];
      const h2 = cleanText(extractAttribute(html, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i));
      const image = extractAttribute(html, /<img[^>]+src=["']([^"']+)["']/i);
      return {
        type: "Raw HTML",
        title: h2 || `${title} Section ${index + 1}`,
        eyebrow: "Legacy HTML",
        body: cleanText(html).slice(0, 260) || summary,
        html,
        image: absolutePath(image || firstImage),
        ctaLabel: "",
        ctaUrl: slug === "index" ? "/" : `/${slug}`,
        layout: "Legacy HTML",
        className: "",
        styles: {
          paddingTop: "0",
          paddingBottom: "0",
          paddingLeft: "0",
          paddingRight: "0",
          marginTop: "0",
          marginBottom: "0",
          backgroundColor: "#ffffff",
          textColor: "#667085",
          headingColor: "#081933",
          accentColor: "#d6a128",
          align: "left",
          gap: "24",
          borderRadius: "0",
          maxWidth: "1200",
          imageRadius: "8",
          shadow: false
        },
        visible: true
      };
    });

  if (sectionMatches.length) {
    return sectionMatches;
  }

  return [
    {
      type: "Raw HTML",
      title,
      eyebrow: "Legacy HTML",
      body: summary,
      html: safeBodyHtml,
      image: absolutePath(firstImage),
      ctaLabel: "Open Page",
      ctaUrl: slug === "index" ? "/" : `/${slug}`,
      layout: "Legacy HTML",
      visible: true
    }
  ];
};

const extractPage = async (slug, index) => {
  const legacyUrl = `${SITE_ORIGIN}/legacy/${slug}.html`;
  let html = "";
  let source = "live-website";
  try {
    html = await fetchText(legacyUrl);
  } catch (error) {
    html = await readFile(`public/legacy/${slug}.html`, "utf8");
    source = "local-published-mirror";
    process.stderr.write(`Used local mirror for ${slug}: ${error.message}\n`);
  }
  const bodyHtml = extractAttribute(html, /<body[^>]*>([\s\S]*?)<\/body>/i);
  const title =
    cleanText(extractAttribute(html, /<title[^>]*>([\s\S]*?)<\/title>/i)) ||
    cleanText(extractAttribute(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)) ||
    titleFromSlug(slug);
  const h1 = cleanText(extractAttribute(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i));
  const metaDescription =
    extractAttribute(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    extractAttribute(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const firstImage = extractAttribute(html, /<img[^>]+src=["']([^"']+)["']/i);
  const bodyText = cleanText(bodyHtml);
  const summary = cleanText(metaDescription || bodyText).slice(0, 220) || `Published page for ${title}.`;

  return {
    source,
    sourceUrl: slug === "index" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}/${slug}`,
    title,
    slug: slug === "index" ? "home" : slug,
    type: pageTypeFromSlug(slug),
    menu: menuFromSlug(slug),
    status: "Published",
    template: pageTypeFromSlug(slug) === "Academic Program" ? "Program Detail" : "Standard Page",
    visibility: "Public",
    parentSlug: "",
    menuOrder: index + 1,
    heroHeadline: h1 || title,
    heroTag: "Published Website Page",
    summary,
    heroImage: absolutePath(firstImage),
    ctaLabel: pageTypeFromSlug(slug) === "Admission Page" ? "Apply Now" : "Learn More",
    ctaUrl: pageTypeFromSlug(slug) === "Admission Page" ? "/admission-apply" : `/${slug === "index" ? "" : slug}`,
    seoTitle: title,
    seoDescription: summary.slice(0, 160),
    rawHtml: html,
    bodyHtml: stripDangerousHtml(bodyHtml),
    customCss: "",
    styles: {
      canvasWidth: "1200",
      backgroundColor: "#ffffff",
      accentColor: "#d6a128",
      fontFamily: "Inter, Segoe UI, Arial, sans-serif"
    },
    owner: "Live Website Import",
    priority: "Medium",
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedBy: "Live Website Fetch",
    scheduledAt: "",
    revisions: [],
    sections: extractSections(bodyHtml, h1 || title, summary, firstImage, slug)
  };
};

const run = async () => {
  const slugs = await getBundleRouteSlugs();
  const pages = [];

  for (const [index, slug] of slugs.entries()) {
    try {
      pages.push(await extractPage(slug, index));
      process.stdout.write(`Fetched ${index + 1}/${slugs.length}: ${slug}\n`);
    } catch (error) {
      process.stderr.write(`Skipped ${slug}: ${error.message}\n`);
    }
  }

  const payload = {
    source: SITE_ORIGIN,
    fetchedAt: new Date().toISOString(),
    count: pages.length,
    pages
  };

  await mkdir("public/data", { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  process.stdout.write(`Wrote ${pages.length} pages to ${OUTPUT_PATH}\n`);
};

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
