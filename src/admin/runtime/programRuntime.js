import { assets } from "../modules/mediaLibrary";
import { PROGRAM_CATEGORIES_KEY, PROGRAMS_KEY, makeId, todayIso } from "./portalRuntime";
import { slugify, createSection, normalizeSection, titleCaseStatus, createBlankLocalDraftPage, isSiteChromePage } from "./pageRuntime";

const initialProgramCategories = [
  {
    id: makeId(),
    name: "Undergraduate Programs",
    slug: "undergraduate-programs",
    description: "Bachelor-level programs across agriculture, engineering, health sciences, business, education, and social sciences.",
    status: "Published",
    menuOrder: 1,
    featured: true,
    heroImage: assets.agriculture
  },
  {
    id: makeId(),
    name: "Postgraduate Programs",
    slug: "postgraduate-programs",
    description: "Master's, specialty, and advanced professional programs supporting research and leadership.",
    status: "Published",
    menuOrder: 2,
    featured: true,
    heroImage: assets.health
  },
  {
    id: makeId(),
    name: "Health Sciences",
    slug: "health-sciences",
    description: "Medicine, public health, nursing, pharmacy, medical laboratory science, and related health programs.",
    status: "Published",
    menuOrder: 3,
    featured: true,
    heroImage: assets.health
  },
  {
    id: makeId(),
    name: "Agriculture and Natural Resources",
    slug: "agriculture-natural-resources",
    description: "Crop, livestock, natural resources, rural development, forestry, and environmental science programs.",
    status: "Published",
    menuOrder: 4,
    featured: true,
    heroImage: assets.agriculture
  }
];

const normalizeProgramCategory = (category) => ({
  id: category?.id || makeId(),
  name: category?.name || "New Category",
  slug: slugify(category?.slug || category?.name || "new-category"),
  description: category?.description || "Describe this program category.",
  status: category?.status || "Draft",
  menuOrder: Number.isFinite(Number(category?.menuOrder)) ? Number(category.menuOrder) : 1,
  featured: Boolean(category?.featured),
  heroImage: category?.heroImage || assets.agriculture,
  programIds: Array.isArray(category?.programIds)
    ? Array.from(new Set(category.programIds.map(String).filter(Boolean)))
    : null,
  updatedAt: category?.updatedAt || todayIso()
});

const initialPrograms = [
  {
    id: makeId(),
    title: "Crop and Livestock Management",
    slug: "crop-and-livestock-management",
    categorySlug: "agriculture-natural-resources",
    level: "Undergraduate",
    college: "College of Agriculture",
    duration: "4 Years",
    delivery: "Regular",
    campus: "Main Campus",
    status: "Published",
    featured: true,
    applicationOpen: true,
    heroImage: assets.agriculture,
    summary: "Applied training in sustainable crop production, animal science, rural development, and agricultural field practice."
  },
  {
    id: makeId(),
    title: "Clinical and Public Health Sciences",
    slug: "clinical-and-public-health-sciences",
    categorySlug: "health-sciences",
    level: "Postgraduate",
    college: "College of Health Sciences",
    duration: "2 Years",
    delivery: "Regular",
    campus: "Goba Campus",
    status: "Published",
    featured: true,
    applicationOpen: true,
    heroImage: assets.health,
    summary: "Advanced study in clinical practice, community health, epidemiology, health systems, and public health research."
  },
  {
    id: makeId(),
    title: "Sustainable Tourism and Heritage",
    slug: "sustainable-tourism-and-heritage",
    categorySlug: "undergraduate-programs",
    level: "Undergraduate",
    college: "College of Business and Economics",
    duration: "3 Years",
    delivery: "Regular",
    campus: "Main Campus",
    status: "Review",
    featured: true,
    applicationOpen: false,
    heroImage: assets.campus,
    summary: "Tourism, cultural heritage, and destination management program focused on sustainable regional development."
  },
  {
    id: makeId(),
    title: "MSc in General Public Health",
    slug: "msc-in-general-public-health",
    categorySlug: "postgraduate-programs",
    level: "Postgraduate",
    college: "College of Health Sciences",
    duration: "2 Years",
    delivery: "Weekend",
    campus: "Goba Campus",
    status: "Published",
    featured: false,
    applicationOpen: true,
    heroImage: assets.health,
    summary: "Graduate public health program for health professionals working in research, policy, and community health leadership."
  }
];

const normalizeProgram = (program) => ({
  id: program?.id || makeId(),
  title: program?.title || "New Program",
  slug: slugify(program?.slug || program?.title || "new-program"),
  categorySlug: program?.categorySlug || "undergraduate-programs",
  pageSlug: program?.pageSlug || program?.page_slug || "",
  level: program?.level || "Undergraduate",
  college: program?.college || "Academic Affairs",
  duration: program?.duration || "4 Years",
  delivery: program?.delivery || "Regular",
  campus: program?.campus || "Main Campus",
  status: program?.status || "Draft",
  featured: Boolean(program?.featured),
  applicationOpen: program?.applicationOpen !== false,
  heroImage: program?.heroImage || assets.agriculture,
  summary: program?.summary || "Write a concise program summary for students.",
  updatedAt: program?.updatedAt || todayIso()
});

const normalizeProgramLevel = (program = {}) => {
  const raw = String(program.level || program.level_name || program.levelName || "").toLowerCase();
  if (raw.includes("phd") || raw.includes("doctor")) return "PhD";
  if (raw.includes("master") || raw.includes("msc") || raw.includes("ma ") || raw.includes("postgraduate")) return "Postgraduate";
  if (raw.includes("special")) return "Specialty";
  if (raw.includes("short")) return "Short Course";
  return "Undergraduate";
};

const normalizeImportedProgram = (program = {}) => {
  const title = String(program.title || "New Program").trim() || "New Program";
  const slug = slugify(program.slug || title);
  const departmentName = String(program.department_name || program.departmentName || program.college || "").trim();
  const levelName = String(program.level_name || program.levelName || program.level || "").trim();
  const categorySlug = slugify(program.department_slug || departmentName || program.level_slug || levelName || "undergraduate-programs");

  return normalizeProgram({
    id: program.id ? `live-program-${program.id}` : `live-program-${slug}`,
    title,
    slug,
    categorySlug,
    pageSlug: slug,
    level: normalizeProgramLevel(program),
    college: departmentName || "Academic Affairs",
    duration: program.duration || "See admission requirements",
    delivery: program.delivery || "Regular",
    campus: program.campus || "Main Campus",
    status: titleCaseStatus(program.status || "Published"),
    featured: Number(program.sort_order || 0) <= 12,
    applicationOpen: true,
    heroImage:
      categorySlug.includes("health") ? assets.health
        : categorySlug.includes("agric") || categorySlug.includes("natural") ? assets.agriculture
          : categorySlug.includes("tourism") || categorySlug.includes("environment") ? assets.campus
            : assets.hero,
    summary:
      program.short_description ||
      program.description ||
      program.seo_description ||
      `${title} program at Madda Walabu University.`,
    updatedAt: program.updated_at || program.updatedAt || todayIso()
  });
};

const createProgramCategoriesFromImportedPrograms = (importedPrograms = []) => {
  const categoryMap = new Map();
  importedPrograms.forEach((program, index) => {
    const categorySlug = slugify(program.department_slug || program.department_name || program.level_slug || program.level_name || "undergraduate-programs");
    if (!categorySlug || categoryMap.has(categorySlug)) return;
    const categoryName = program.department_name || program.level_name || "Academic Programs";
    categoryMap.set(categorySlug, normalizeProgramCategory({
      id: `live-category-${categorySlug}`,
      name: categoryName,
      slug: categorySlug,
      description: `${categoryName} programs imported from the live MWU website catalog.`,
      status: "Published",
      menuOrder: index + 1,
      featured: true,
      heroImage:
        categorySlug.includes("health") ? assets.health
          : categorySlug.includes("agric") || categorySlug.includes("natural") ? assets.agriculture
            : assets.hero
    }));
  });
  return Array.from(categoryMap.values());
};

const createProgramPageFromProgram = (program = {}) =>
  createBlankLocalDraftPage({
    title: program.title || "Academic Program",
    slug: program.slug || slugify(program.title || "academic-program"),
    type: "Academic Program",
    menu: "Programs",
    status: program.status || "Published",
    template: "Program Detail",
    visibility: "Public",
    parentSlug: "program",
    menuOrder: Number(program.menuOrder || 1) || 1,
    showInHeader: 1,
    showInFooter: 0,
    heroHeadline: program.title || "Academic Program",
    heroTag: program.level || "Academic Program",
    summary: program.summary || `${program.title || "Academic program"} at Madda Walabu University.`,
    heroImage: program.heroImage || assets.hero,
    ctaLabel: "Apply Now",
    ctaUrl: "/admission-apply",
    seoTitle: `${program.title || "Academic Program"} | Madda Walabu University`,
    seoDescription: program.summary || `${program.title || "Academic program"} at Madda Walabu University.`,
    owner: program.college || "Academic Affairs",
    priority: "Medium",
    sections: [
      createSection("Hero Banner"),
      normalizeSection({
        type: "Text Block",
        title: "Program Overview",
        body: program.summary || `${program.title || "This program"} is offered by Madda Walabu University.`
      }),
      normalizeSection({
        type: "Feature Cards",
        title: "Program Details",
        body: `Level: ${program.level || "Academic Program"} | College: ${program.college || "Academic Affairs"} | Duration: ${program.duration || "See admission requirements"} | Delivery: ${program.delivery || "Regular"}`
      }),
      createSection("CTA Banner")
    ]
  });

const loadProgramCategories = () => {
  try {
    const stored = window.localStorage.getItem(PROGRAM_CATEGORIES_KEY);
    const parsed = stored ? JSON.parse(stored) : initialProgramCategories;
    const normalized = Array.isArray(parsed) ? parsed.map(normalizeProgramCategory) : initialProgramCategories.map(normalizeProgramCategory);
    const existingSlugs = new Set(normalized.map((category) => category.slug));
    const missingSeedCategories = initialProgramCategories
      .map(normalizeProgramCategory)
      .filter((category) => !existingSlugs.has(category.slug));

    return [...normalized, ...missingSeedCategories];
  } catch {
    return initialProgramCategories.map(normalizeProgramCategory);
  }
};

const loadPrograms = () => {
  try {
    const stored = window.localStorage.getItem(PROGRAMS_KEY);
    const parsed = stored ? JSON.parse(stored) : initialPrograms;
    const normalized = Array.isArray(parsed) ? parsed.map(normalizeProgram) : initialPrograms.map(normalizeProgram);
    const existingSlugs = new Set(normalized.map((program) => program.slug));
    const missingSeedPrograms = initialPrograms
      .map(normalizeProgram)
      .filter((program) => !existingSlugs.has(program.slug));

    return [...normalized, ...missingSeedPrograms];
  } catch {
    return initialPrograms.map(normalizeProgram);
  }
};

const getSeoScore = (page) => {
  const checks = [
    (page.title || "").length >= 12,
    (page.slug || "").length >= 4,
    (page.summary || "").length >= 90,
    (page.seoTitle || "").length >= 25 && (page.seoTitle || "").length <= 70,
    (page.seoDescription || "").length >= 80 && (page.seoDescription || "").length <= 160,
    Array.isArray(page.sections) && page.sections.some((section) => section.visible !== false),
    Boolean(page.heroImage)
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

const isProgramPage = (page) =>
  [page?.title, page?.slug, page?.type, page?.menu]
    .join(" ")
    .toLowerCase()
    .includes("program");

const isBlogPage = (page) =>
  [page?.title, page?.slug, page?.type, page?.menu]
    .join(" ")
    .toLowerCase()
    .match(/\b(blog|blogs|news|article)\b/);

const isResearchPage = (page) =>
  [page?.title, page?.slug, page?.type, page?.menu]
    .join(" ")
    .toLowerCase()
    .match(/\b(research|publication|publications|journal|journals)\b/);

const isEventPage = (page) =>
  [page?.title, page?.slug, page?.type, page?.menu]
    .join(" ")
    .toLowerCase()
    .match(/\b(event|events)\b/);

const isDedicatedPage = (page) => isProgramPage(page) || isResearchPage(page) || isBlogPage(page) || isEventPage(page);

const isNormalWebsitePage = (page) => {
  if (isSiteChromePage(page)) {
    return false;
  }

  if (isDedicatedPage(page)) {
    return false;
  }

  const slug = page?.slug || "";
  const utilitySlugs = new Set([
    "cart",
    "checkout",
    "wishlist",
    "shop",
    "shop-details",
    "typography",
    "pricing",
    "error",
    "reviews",
    "students",
    "teacher",
    "teacher-details",
    "bysexual",
    "scrollship"
  ]);

  return !utilitySlugs.has(slug);
};

export {
  initialProgramCategories,
  normalizeProgramCategory,
  initialPrograms,
  normalizeProgram,
  normalizeProgramLevel,
  normalizeImportedProgram,
  createProgramCategoriesFromImportedPrograms,
  createProgramPageFromProgram,
  loadProgramCategories,
  loadPrograms,
  getSeoScore,
  isProgramPage,
  isBlogPage,
  isResearchPage,
  isEventPage,
  isDedicatedPage,
  isNormalWebsitePage
};
