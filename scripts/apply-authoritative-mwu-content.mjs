import fs from "node:fs";
import path from "node:path";

const adminRoot = "C:/Users/HOME/Desktop/MWU-Admin";
const siteRoot = "C:/Users/HOME/Desktop/MWU-Project";
const sourceRoot = "C:/Users/HOME/Downloads/Documents/MWU DATA from Abdul";
const targets = [
  path.join(adminRoot, "public/legacy"),
  path.join(siteRoot, "public/legacy")
];

const esc = (value = "") => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const list = (items = []) => `<div class="checklist style2"><ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul></div>`;
const table = (headers, rows) => `<div class="table-responsive"><table class="table table-bordered align-middle"><thead><tr>${headers.map((item) => `<th>${item}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((item) => `<td>${item}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const linkCards = (items = []) => `<div class="row gy-3">${items.map(([label, href, text]) => `<div class="col-md-6 col-xl-4"><a class="mwu-link-card" href="${href}"><strong>${label}</strong><span>${text || "Open page"}</span></a></div>`).join("")}</div>`;
const section = (title, content, eyebrow = "") => `<section class="mwu-content-section"><div class="title-area mb-20">${eyebrow ? `<span class="sub-title">${eyebrow}</span>` : ""}<h2 class="sec-title">${title}</h2></div>${content}</section>`;

function page({ slug, title, subtitle = "Madda Walabu University", description, parent = "Home", parentHref = "/", body }) {
  return `<!doctype html>
<html class="no-js" lang="en" dir="ltr">
<head>
  <meta charset="utf-8"><meta http-equiv="x-ua-compatible" content="ie=edge">
  <title>${esc(title)} | Madda Walabu University</title>
  <meta name="author" content="Madda Walabu University">
  <meta name="description" content="${esc(description || title)}">
  <meta name="robots" content="INDEX,FOLLOW"><meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
  <link rel="stylesheet" href="assets/css/bootstrap.min.css"><link rel="stylesheet" href="assets/css/fontawesome.min.css"><link rel="stylesheet" href="assets/css/magnific-popup.min.css"><link rel="stylesheet" href="assets/css/swiper-bundle.min.css"><link rel="stylesheet" href="assets/css/style.css">
  <style>
    .mwu-authoritative-page{background:#f6f9fd}.mwu-authoritative-page .mwu-page-shell{background:#fff;border:1px solid #dce6f2;border-radius:18px;padding:clamp(22px,4vw,52px);box-shadow:0 18px 46px rgba(8,35,70,.08)}
    .mwu-content-section+.mwu-content-section{border-top:1px solid #e5ebf3;margin-top:38px;padding-top:38px}.mwu-content-section p,.mwu-content-section li{color:#40536d;line-height:1.8}
    .mwu-profile-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin:24px 0}.mwu-profile-item{padding:18px;border-radius:12px;background:#eef4fc;border-left:4px solid #e4ad24}.mwu-profile-item span{display:block;color:#65758a;font-size:13px}.mwu-profile-item strong{display:block;color:#092c58;margin-top:4px}
    .mwu-link-card{display:flex;height:100%;flex-direction:column;gap:7px;padding:20px;border:1px solid #d7e3f1;border-radius:12px;background:#fff;text-decoration:none!important;box-shadow:0 8px 24px rgba(8,35,70,.06)}.mwu-link-card strong{color:#0b376c}.mwu-link-card span{color:#60738d;font-size:14px}.mwu-link-card:hover{border-color:#e4ad24;transform:translateY(-2px)}
    .mwu-downloads{display:flex;flex-wrap:wrap;gap:10px}.mwu-note{padding:15px 18px;border-radius:10px;background:#fff7df;border:1px solid #f2d684;color:#614b13}.table th{background:#0b376c;color:#fff}.table td{color:#334a67}.mwu-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}.mwu-stat{padding:22px;border-radius:12px;background:#0b376c;color:#fff}.mwu-stat strong{display:block;font-size:30px;color:#e8b328}.mwu-stat span{font-size:14px}
  </style>
</head>
<body>
<div id="mwu-universal-header"></div><script src="assets/js/universal-header.js"></script>
<div class="breadcumb-wrapper position-relative" data-bg-src="assets/img/shape/breadcrumb-shep.png"><div class="container th-container4"><div class="breadcumb-content"><h1 class="breadcumb-title">${esc(title)}</h1><ul class="breadcumb-menu"><li><a href="/">Home</a></li>${parent !== "Home" ? `<li><a href="${parentHref}">${esc(parent)}</a></li>` : ""}<li>${esc(title)}</li></ul></div></div></div>
<main class="space mwu-authoritative-page"><div class="container th-container4"><div class="mwu-page-shell"><div class="title-area"><span class="sub-title">${esc(subtitle)}</span><h1 class="sec-title">${esc(title)}</h1>${description ? `<p class="sec-text">${esc(description)}</p>` : ""}</div>${body}</div></div></main>
<div id="mwu-universal-footer"></div><script src="assets/js/universal-footer.js"></script>
<script src="assets/js/vendor/jquery-3.7.1.min.js"></script><script src="assets/js/swiper-bundle.min.js"></script><script src="assets/js/bootstrap.min.js"></script><script src="assets/js/jquery.magnific-popup.min.js"></script><script src="assets/js/jquery.counterup.min.js"></script><script src="assets/js/jquery-ui.min.js"></script><script src="assets/js/imagesloaded.pkgd.min.js"></script><script src="assets/js/isotope.pkgd.min.js"></script><script src="assets/js/wow.min.js"></script><script src="assets/js/gsap.min.js"></script><script src="assets/js/ScrollTrigger.min.js"></script><script src="assets/js/SplitText.min.js"></script><script src="assets/js/lenis.min.js"></script><script src="assets/js/main.js"></script>
</body></html>`;
}

const sharedProfile = (items) => `<div class="mwu-profile-strip">${items.map(([label, value]) => `<div class="mwu-profile-item"><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>`;
const programDownloads = (items) => `<div class="mwu-downloads">${items.map(([label, href]) => `<a class="th-btn" href="${href}" download>${label}</a>`).join("")}</div>`;

const pages = new Map();
const add = (data) => pages.set(data.slug, page(data));

add({
  slug: "library-services", title: "Library Services", subtitle: "Knowledge, Research and Learning Support",
  description: "MWU Library services, branches, electronic resources and 24/7 learning support.",
  parent: "Services", parentHref: "services.html",
  body: section("About MWU Library", `<p>The Madda Walabu University Library was established in 2006 at Goba Health Science College. It now operates a network of libraries across Robe, Goba and Shashemene campuses, including Social, Engineering and Technology, Digital, Natural Science, Postgraduate and Law libraries. The main library is located at the Robe Main Campus and the service is automated through the Koha library management system.</p><p>Approximately 105 employees support teaching, learning, research, publication, information access and recreational reading.</p>`) +
    section("Library Sections and Services", linkCards([
      ["Circulation", "#", "Front-desk lending, returns and user support."], ["Documentation", "#", "Photocopying, binding, repair and document preservation."], ["Bookstore", "#", "Acquisition, inventory, shelving and distribution."], ["Reference", "#", "Reference enquiry, orientation, CAS and SDI."], ["Periodicals", "#", "Newspapers, magazines, journals and serials."], ["ICT Services", "#", "Computer, internet, email and e-resource guidance."], ["E-Library", "#", "Electronic books and connected university-library resources."]
    ])) +
    section("Hours and Contact", sharedProfile([["Service hours", "24 hours a day, 7 days a week"], ["Official email", `<a href="mailto:library@mwu.edu.et">library@mwu.edu.et</a>`], ["Additional contact", `<a href="mailto:tesfayeteferi@gmail.com">tesfayeteferi@gmail.com</a>`]]))
});

add({
  slug: "research-internationalization-partnership", title: "Research Internationalization and Partnership Directorate",
  subtitle: "Office of the President", description: "MWU international partnerships, research collaboration, mobility and funded projects.",
  parent: "Research and Innovation", parentHref: "research.html",
  body: section("Directorate Overview", `<p>The Research Internationalization and Partnership Directorate advances MWU's academic and research excellence, technological innovation and global engagement. It leads international partnership development, institutional networking, high-impact research collaboration, mobility, capacity building and academic exchange aligned with institutional and national priorities.</p>`) +
    sharedProfile([["Director", "Dr Alemayehu Abate"], ["Director email", `<a href="mailto:alemayehu.abate@mwu.edu.et">alemayehu.abate@mwu.edu.et</a>`], ["Phone", "+251 910 030 121"], ["Office", "Main Building, Office 321, Bale Robe, P.O. Box 247"]]) +
    section("Coordinating Offices", linkCards([["Academic Affairs Internationalization and Partnership", "#", "Coordinator: Mr Feissa Kaba · feymath@gmail.com · +251 911 973 085"], ["Research and Project Affairs Internationalization and Partnership", "#", "Coordinator: Mr Tesfaye Amene · tesfuam@gmail.com · +251 973 660 771"]])) +
    section("Major Objectives", list(["Expand mutually beneficial international teaching, research and community-service partnerships.", "Attract joint funding, projects and capacity-building opportunities.", "Increase high-quality joint research and publication.", "Support student and staff mobility, exchange and scientific practice.", "Strengthen global visibility and standards in teaching, research and innovation."])) +
    section("Collaboration Areas", list(["Joint research and publication", "Faculty and student exchange", "Workshops, courses and scientific conferences", "Joint funding proposals and mobility", "Curriculum development and joint master's/PhD programs", "Institutional capacity building and shared facilities"])) +
    section("Partners", linkCards([["University of Messina", "#", "Italy"], ["University of Parma", "#", "Italy"], ["University of Udine", "#", "Italy"], ["University of Molise", "#", "Italy"], ["International Organization for Migration", "#", "International partner"]])) +
    section("Selected Funded Projects", table(["Project", "Period"], [
      ["Climate Adaptation in Africa: water security, biodiversity and livelihoods in the Bale Mountains (SEI/RAIA)", "2026–2027"],
      ["Coffee–forest carbon sequestration, biodiversity, soil health and yield (Research Council of Norway)", "2026–2028"],
      ["Preservation of Dirre Sheikh Hussein cultural heritage from climate change (ALIPH)", "2026–2028"],
      ["ECOSAVE Bale Eco-region conservation project", "2025–2027"],
      ["Erasmus+ KA171 mobility with the University of Messina", "2026–2028"],
      ["Irrigated wheat production using modern technologies (Grow Further)", "2025–2027"]
    ]))
});

const physicsObjectives = list(["Build strong theoretical, experimental and computational physics foundations.", "Develop laboratory, data-analysis, scientific communication and research competence.", "Apply physics to real-world scientific and technological challenges.", "Promote ethics, leadership, teamwork, independent learning and lifelong professional development."]);
add({
  slug: "department-physics", title: "Department of Physics", subtitle: "College of Natural and Computational Sciences",
  description: "Physics department leadership, programs, learning objectives, staff and curricula.",
  parent: "Academics", parentHref: "academics-structure.html",
  body: sharedProfile([["Head of Department", "Adem Beriso Bejo (PhD)"], ["Email", `<a href="mailto:ademberiso1985@gmail.com">ademberiso1985@gmail.com</a>`], ["Phone", "+251 911 942 734"], ["Office", "Block B-25, Room 228"]]) +
    section("Program Learning Objectives", physicsObjectives) +
    section("Academic Programs", linkCards([["BSc Physics", "program-ug-physics.html", "Regular and summer/in-service modalities"], ["MSc Physics", "program-pg-msc-in-physics.html", "Regular, extension and summer"], ["MSc Quantum Optics", "program-pg-msc-in-physics-quantum-optics.html", "Regular and extension"], ["MSc Solid State Physics", "program-pg-msc-in-physics-solid-state-physics.html", "Regular and extension"]])) +
    section("Curriculum Documents", programDownloads([["BSc Summer Course Breakdown", "assets/docs/physics/physics-bsc-summer-course-breakdown.pdf"], ["Harmonized MSc Curriculum", "assets/docs/physics/physics-msc-harmonized-curriculum.pdf"], ["MWU MSc Physics Curriculum (2018)", "assets/docs/physics/physics-msc-mwu-2018-curriculum.pdf"]])) +
    section("Department Staff", `<p>The supplied department roster records 17 instructors and three laboratory/technical staff. It includes six PhD academic staff, lecturers with MSc qualifications and laboratory professionals. The full roster should be maintained through the Admin staff directory so employment status can be kept current.</p>`)
});

const plantObjectives = list(["Improve food security through crop productivity and resilience.", "Promote climate-smart agriculture and environmental sustainability.", "Apply plant breeding, crop production, pest management and biotechnology.", "Integrate digital agriculture and precision farming.", "Build research, extension, entrepreneurship, leadership and ethical practice."]);
add({
  slug: "department-plant-science", title: "Department of Plant Science", subtitle: "College of Agriculture and Natural Resources",
  description: "Plant Science department profile, leadership, programs, learning objectives and staff.",
  parent: "Academics", parentHref: "academics-structure.html",
  body: sharedProfile([["Head of Department", "Solomon Debele Bedasa (PhD)"], ["Email", `<a href="mailto:plantscience@mwu.edu.et">plantscience@mwu.edu.et</a>`], ["Phone", "+251 913 815 152"], ["Office", "Bale-Robe Main Campus"]]) +
    section("About the Department", `<p>Established in 2007, the department produces competent graduates, conducts impactful research and delivers community services supporting sustainable agriculture and food security. Its focus includes crop production, plant breeding, genetics, plant protection, biotechnology, agronomy and climate-smart agriculture.</p>`) +
    section("Program Learning Objectives", plantObjectives) +
    section("Academic Programs", table(["Program", "Mode", "Duration", "Credits"], [["BSc Plant Science", "Regular", "4 years", "148"], ["BSc Plant Science", "Winter In-Service", "6 years", "126"], ["BSc Plant Science", "Extension/Summer", "5 years", "154"], ["MSc Agronomy", "Regular / Extension", "2 / 3 years", "31"], ["MSc Plant Pathology", "Regular / Extension", "2 / 3 years", "35"]])) +
    section("Staff Profile", `<div class="mwu-stat-grid"><div class="mwu-stat"><strong>24</strong><span>Total academic and technical staff</span></div><div class="mwu-stat"><strong>6</strong><span>PhD instructors</span></div><div class="mwu-stat"><strong>11</strong><span>MSc instructors</span></div><div class="mwu-stat"><strong>6</strong><span>Graduate/technical assistants</span></div></div>`)
});

add({
  slug: "school-law", title: "School of Law", subtitle: "Shaping Legal Minds, Advancing Justice, Serving Society",
  description: "MWU School of Law history, academic programs and free legal aid service.",
  parent: "Academics", parentHref: "academics-structure.html",
  body: section("School Overview", `<p>The School of Law delivers rigorous legal education that develops critical thinking, advocacy skills and professional ethics. The program began in 2004 E.C. with three academic staff as a department under the School of Behavioural Sciences and became the School of Law in 2008 E.C.</p><p>The School offers LL.B education through regular and weekend/extension programs at the Main Campus and Shashemene Campus.</p>`) +
    section("Academic Program", linkCards([["Bachelor of Laws (LL.B)", "program-ug-law.html", "Regular and extension delivery"]])) +
    section("Research and Community Service", `<p>The School operates free legal aid through six specialized centres under Oromia Attorney General Advocacy Licence No. 03-401260. Services focus on people unable to afford private legal representation, particularly women, children, persons with disabilities or health conditions, older people and internally displaced persons.</p>${linkCards([["Free Legal Aid Service", "community-legal-aid-services.html", "Advice, pleading preparation and court representation"]])}`)
});

const sshDepartments = [
  ["department-english-language-literature", "English Language and Literature", "Temesgen Dufera Dabal", "sesina112630@gmail.com / tamasgenduferadabal@gmail.com", "0911318982 / 0912438249", "Block 15, Room 309", ["BA English Language and Literature", "MA TEFL", "MA General Linguistics", "PhD English Language Teaching"]],
  ["department-sociology", "Sociology", "Meseret Seboka", "meseretseboka18@gmail.com", "0925973419 / 0938674153 / 0920500080", "Block 15, Room 312", ["BA Sociology"]],
  ["department-geography-environmental-studies", "Geography and Environmental Studies", "Derara Kunbushu Gurmu", "derarakunbushu12@gmail.com", "+251 912 264 840", "Block 32, Room 302", ["BA Geography and Environmental Studies", "MA Urban Planning and Management", "MSc Climate Change and Disaster Risk Management", "MA Geography and Environmental Studies", "PhD Geography and Environmental Studies"]],
  ["department-geographic-information-science", "Geographic Information Science", "Behailu Legese Ejigu", "behailugisrs@gmail.com", "Contact number requires confirmation", "Block 15, Room 302", ["BSc Geographic Information Science", "MSc GIS and Land Resource Management"]],
  ["department-afaan-oromo-literature", "Afaan Oromo and Literature", "Sufiyan Alo Aliyyi", "Zzebsuf@gmail.com", "0912099905 / 0921501323", "Block 15, Room 201", ["BA Afaan Oromo and Literature", "MA Afaan Oromo and Literature"]],
  ["department-journalism-communication", "Journalism and Communication", "Dibabe Lelisa Soboka", "lelisadibabe994@gmail.com", "+251 963 360 035", "Block 15, Room 109", ["BA Journalism and Communication"]],
  ["department-civics-ethical-studies", "Civics and Ethical Studies", "Mekides Mesfin", "mmesfine35@gmail.com", "0911074744", "Block 15, Room 106", ["BA Civics and Ethical Studies"]],
  ["department-history-heritage-management", "History and Heritage Management", "Bijiga Gerba Keno", "bijigagerba@yahoo.com", "0910296657", "Office to be confirmed", ["BA History and Heritage Management", "MA History"]],
  ["department-amharic-language-literature", "Ethiopian Language and Literature–Amharic", "Dr Fiseha Eshete G/Silassie", "tedlaeshete2002@gmail.com", "0910117466", "Block 15, Room 103", ["BA Amharic Language and Literature", "MA Applied Linguistics in Teaching Amharic"]]
];
const sshProgramLinks = new Map([
  ["BA English Language and Literature", "program-ug-english-language-and-literature.html"],
  ["MA TEFL", "program-pg-ma-in-tefl.html"],
  ["MA General Linguistics", "program-pg-ma-in-general-linguistics.html"],
  ["PhD English Language Teaching", "program-phd-phd-in-english-language-teaching.html"],
  ["BA Sociology", "program-ug-sociology.html"],
  ["BA Geography and Environmental Studies", "program-ug-geography-and-environmental-studies.html"],
  ["MA Urban Planning and Management", "program-pg-ma-in-urban-planning-and-management.html"],
  ["MSc Climate Change and Disaster Risk Management", "program-pg-msc-in-climate-change-and-disaster-risk-management.html"],
  ["MA Geography and Environmental Studies", "program-pg-ma-in-geography-and-environmental-studies.html"],
  ["PhD Geography and Environmental Studies", "program-phd-phd-in-geography-and-environment.html"],
  ["BSc Geographic Information Science", "program-ug-geographic-information-science.html"],
  ["MSc GIS and Land Resource Management", "program-pg-msc-in-gis-land-use-planning-and-management.html"],
  ["BA Afaan Oromo and Literature", "program-ug-afan-oromo-and-literature.html"],
  ["MA Afaan Oromo and Literature", "program-pg-ma-in-afan-oromo-and-literature.html"],
  ["BA Journalism and Communication", "program-ug-journalism-and-communication.html"],
  ["BA Civics and Ethical Studies", "program-ug-civics-and-ethical-education.html"],
  ["BA History and Heritage Management", "program-ug-history-and-heritage-management.html"],
  ["MA History", "program-pg-ma-in-history.html"],
  ["BA Amharic Language and Literature", "program-ug-amharic-language-and-literature.html"],
  ["MA Applied Linguistics in Teaching Amharic", "program-pg-ma-in-applied-linguistics-in-teaching-amharic.html"]
]);

add({
  slug: "college-social-sciences-humanities", title: "College of Social Sciences and Humanities", subtitle: "Teaching, Research and Community Service",
  description: "College profile, leadership, departments and academic programs.",
  parent: "Academics", parentHref: "academics-structure.html",
  body: sharedProfile([["Dean", "Obsa Mamo"], ["Email", `<a href="mailto:obsakosa@gmail.com">obsakosa@gmail.com</a>`], ["Phone", "+251 913 067 165"]]) +
    section("College Profile", `<p>Established under its current structure and name in 2009 E.C., the College advances MWU's three pillars: teaching, research and community service. It prepares graduates in languages, journalism, history, geography, geographic information science, sociology and civic studies; conducts research that addresses social challenges; and provides professional support to communities.</p>`) +
    section("Departments", linkCards(sshDepartments.map(([slug, title]) => [title, `${slug}.html`, "Department profile and academic programs"])))
});

for (const [slug, title, head, email, phone, office, programs] of sshDepartments) {
  add({
    slug, title: `Department of ${title}`, subtitle: "College of Social Sciences and Humanities",
    description: `${title} department leadership, learning profile and academic programs.`,
    parent: "Social Sciences and Humanities", parentHref: "college-social-sciences-humanities.html",
    body: sharedProfile([["Head of Department", head], ["Email", email.includes("@") ? `<a href="mailto:${email.split(" / ")[0]}">${email}</a>` : email], ["Phone", phone], ["Office", office]]) +
      section("Department Profile", `<p>The department supports discipline-based teaching, research, professional preparation and community engagement. Program delivery follows MWU academic policies and the approved curriculum for each award.</p>`) +
      section("Academic Programs", linkCards(programs.map((program) => [program, sshProgramLinks.get(program) || "program.html", "View program information"]))) +
      `<div class="mwu-note">Curriculum documents and HoD photographs referenced in the supplied profile should be attached through the Admin Media Library when the approved source files are provided.</div>`
  });
}

const staffRows = [
  ["Medicine and Health Science", "263", "31", "294"], ["Engineering", "107", "17", "124"], ["Computing", "30", "1", "31"], ["Agriculture and Natural Resources", "79", "19", "98"], ["Social Sciences and Humanities", "79", "15", "94"], ["Natural and Computational Sciences", "95", "15", "110"], ["Business and Economics", "78", "13", "91"], ["Education and Behavioural Studies", "39", "8", "47"], ["Law", "14", "2", "16"]
];
add({
  slug: "academic-staff-statistics", title: "Academic Staff Statistics", subtitle: "Institutional Facts and Figures",
  description: "Academic staff distribution by college, school and gender from the supplied institutional dataset.",
  parent: "About MWU", parentHref: "about.html",
  body: `<div class="mwu-stat-grid"><div class="mwu-stat"><strong>905</strong><span>Calculated total staff</span></div><div class="mwu-stat"><strong>784</strong><span>Calculated male staff</span></div><div class="mwu-stat"><strong>121</strong><span>Female staff</span></div><div class="mwu-stat"><strong>9</strong><span>Colleges/schools represented</span></div></div>` +
    section("Staff by Academic Unit", table(["College / School", "Male", "Female", "Total"], staffRows)) +
    `<div class="mwu-note">Quality check: the source document prints a grand total of 904 and male total of 782, while its listed subtotals calculate to 905 and 784. This page uses the calculated subtotals and flags the source discrepancy for institutional confirmation.</div>`
});

add({
  slug: "administration", title: "University Administration", subtitle: "Leadership and Executive Offices",
  description: "MWU leadership, vice-presidential offices, executive offices and directorates.",
  body: section("Office of the President", linkCards([["President Profile", "president.html", "About the President"], ["Research Internationalization and Partnership", "research-internationalization-partnership.html", "Global engagement and research partnership"], ["Institutional Transformation", "#", "Executive office"], ["ICT Directorate", "#", "Information and communication technology"], ["Strategic Affairs", "#", "Executive office"], ["Legal Services", "#", "Executive office"], ["Internal Audit", "#", "Executive office"]])) +
    section("Academic, Research and Community Service Vice President", list(["Special Assistant", "Academic Programs Directorate", "Education Quality Improvement Directorate", "Registrar and Alumni Directorate", "e-Learning Management Directorate", "Library Services Directorate", "Research, Publication, Ethics and Extension Directorate", "Technology Transfer and Community Service Directorate"])) +
    section("Administration and Development Vice President", list(["Student Dean Office", "Finance Executive Office", "Human Resource Services", "Procurement", "Engineering and Maintenance", "Peace and Security", "General Service", "Property Management", "Resource Development", "Transport Services"]))
});

add({
  slug: "academics-structure", title: "Colleges, Schools and Departments", subtitle: "Academic Structure",
  description: "MWU academic colleges, schools, departments and program catalogue.",
  body: section("Featured Academic Units", linkCards([["Social Sciences and Humanities", "college-social-sciences-humanities.html", "Nine departments"], ["Department of Physics", "department-physics.html", "BSc and MSc Physics"], ["Department of Plant Science", "department-plant-science.html", "BSc, Agronomy and Plant Pathology"], ["School of Law", "school-law.html", "LL.B and legal aid"], ["All Programs", "program.html", "Undergraduate, postgraduate and PhD catalogue"]])) +
    section("Colleges", list(["College of Engineering", "College of Computing", "College of Natural and Computational Sciences", "College of Agriculture and Natural Resources", "College of Medicine and Health Sciences", "College of Social Sciences and Humanities", "College of Business and Economics", "College of Education and Behavioural Studies"]))
});

add({
  slug: "services", title: "University Services", subtitle: "Student, Academic and Community Support",
  description: "MWU library, clinical, ICT, residential and campus services.",
  body: linkCards([["Library Services", "library-services.html", "Libraries, e-resources and 24/7 access"], ["Referral Hospital", "campus.html", "Teaching hospital and clinical services"], ["ICT Services", "contact.html", "Digital and technology support"], ["Legal Aid", "community-legal-aid-services.html", "Free legal assistance"], ["Training and Capacity Building", "community-training-capacity-building.html", "Community and professional training"], ["Consultancy", "community-consultancy-services.html", "Expert consulting services"], ["Campus Services", "campus.html", "Dormitory, cafeteria and student life"]])
});

add({ slug: "announcements", title: "Announcements", subtitle: "Latest from MWU", description: "Official university announcements.", body: `<p>Official institutional announcements will be published here through the MWU Admin news and announcements workflow.</p>${section("Institutional Archive", linkCards([["2018 Exam Centre Distribution", "exam-centre-statistics-2018.html", "Historical CBT/PBT allocation dataset"]]))}` });
add({ slug: "vacancies", title: "Vacancies", subtitle: "Work at MWU", description: "Official employment opportunities.", body: `<p>Approved university vacancy notices and application instructions will be published here. No active vacancy was included in the supplied content package.</p>` });
add({
  slug: "exam-centre-statistics-2018", title: "2018 Exam Centre Distribution", subtitle: "Historical Institutional Report",
  description: "Archived CBT and PBT examination-centre distribution supplied for the 2018 reporting period.",
  parent: "Announcements", parentHref: "announcements.html",
  body: `<div class="mwu-note">This is a historical 2018 allocation dataset and must not be interpreted as current student enrolment or current examination-centre capacity.</div>` +
    section("Summary", `<div class="mwu-stat-grid"><div class="mwu-stat"><strong>2,099</strong><span>CBT allocation total</span></div><div class="mwu-stat"><strong>5,162</strong><span>PBT allocation total</span></div><div class="mwu-stat"><strong>7,261</strong><span>Combined historical allocation</span></div></div>`) +
    section("CBT Centres", table(["Centre", "NS", "TSS", "Total"], [["MWU – Robe", "1,117", "683", "1,800"], ["MWU – Shashemene", "232", "67", "299"]])) +
    section("PBT Allocation by Area", table(["Zone / Woreda", "NS", "SS", "Total"], [["Arsi West – Gedeb Hasasa", "615", "114", "729"], ["Arsi West – Kokosa", "409", "310", "719"], ["Arsi West – Nensebo", "188", "137", "325"], ["Arsi West – Dodola", "187", "78", "265"], ["Bale – Goro", "168", "165", "333"], ["Bale – Harena Buluk", "122", "104", "226"], ["East Bale – Gindir", "265", "176", "441"], ["East Bale – Gindir Town", "196", "107", "303"], ["East Bale – Laga Hida", "217", "63", "280"], ["East Borena – West Welabu", "142", "139", "281"], ["East Borena – Meda Welabu", "102", "123", "225"]])) +
    section("Original Dataset", programDownloads([["Download 2018 XLSX", "assets/docs/reports/mwu-exam-centre-distribution-2018.xlsx"]]))
});

function programPage({ slug, title, level, overview, facts = [], outcomes = [], downloads = [], department }) {
  add({
    slug, title, subtitle: level, description: overview, parent: "Programs", parentHref: "program.html",
    body: department ? sharedProfile([["Academic unit", `<a href="${department[1]}">${department[0]}</a>`]]) : "" +
      section("Program Overview", `<p>${overview}</p>`) +
      (facts.length ? section("Program Structure", table(["Item", "Details"], facts)) : "") +
      (outcomes.length ? section("Learning Outcomes", list(outcomes)) : "") +
      (downloads.length ? section("Curriculum Resources", programDownloads(downloads)) : "")
  });
}

programPage({ slug:"program-ug-physics", title:"Bachelor of Science in Physics", level:"Undergraduate Degree", department:["Department of Physics","department-physics.html"], overview:"The BSc Physics program develops theoretical, experimental and computational competence for scientific work, education, industry and postgraduate study.", facts:[["Regular","4 years · 146 credit hours"],["Summer/In-Service","6–7 years; supplied course breakdown structures 135 credits across six summers and five winters"]], outcomes:["Apply theoretical and experimental physics to scientific problems.","Use modern laboratory, computational and data-analysis tools.","Communicate scientific findings and conduct ethical research."], downloads:[["BSc Summer Course Breakdown","assets/docs/physics/physics-bsc-summer-course-breakdown.pdf"]] });
programPage({ slug:"program-pg-msc-in-physics", title:"Master of Science in Physics", level:"Postgraduate Degree", department:["Department of Physics","department-physics.html"], overview:"Advanced Physics study combining core theory, research methods, specialization coursework and thesis or project work.", facts:[["Regular","2 years"],["Extension/Weekend","2–3 years"],["Summer","3–4 years"],["Credits","33–36 depending on thesis/project pathway"]], downloads:[["Harmonized MSc Curriculum","assets/docs/physics/physics-msc-harmonized-curriculum.pdf"],["MWU MSc Curriculum (2018)","assets/docs/physics/physics-msc-mwu-2018-curriculum.pdf"]] });
programPage({ slug:"program-pg-msc-in-physics-quantum-optics", title:"MSc Physics – Quantum Optics", level:"Postgraduate Specialization", department:["Department of Physics","department-physics.html"], overview:"A Physics specialization focused on advanced optics, quantum systems, laser physics, research methodology and thesis work.", facts:[["Regular","2 years"],["Extension/Weekend","2–3 years"],["Total","35 credit hours / 100 ECTS reported for regular and extension modalities"]], downloads:[["MWU MSc Physics Curriculum","assets/docs/physics/physics-msc-mwu-2018-curriculum.pdf"]] });
programPage({ slug:"program-pg-msc-in-physics-solid-state-physics", title:"MSc Physics – Solid State Physics", level:"Postgraduate Specialization", department:["Department of Physics","department-physics.html"], overview:"A Physics specialization in condensed matter and solid-state systems with advanced theory, laboratory/research methods and thesis work.", facts:[["Regular","2 years"],["Extension/Weekend","2–3 years"],["Total","35 credit hours / 100 ECTS reported for regular and extension modalities"]], downloads:[["MWU MSc Physics Curriculum","assets/docs/physics/physics-msc-mwu-2018-curriculum.pdf"]] });
programPage({ slug:"program-ug-plant-science", title:"Bachelor of Science in Plant Science", level:"Undergraduate Degree", department:["Department of Plant Science","department-plant-science.html"], overview:"Plant Science prepares graduates in crop production, plant breeding, genetics, plant protection, biotechnology, agronomy and climate-smart agriculture.", facts:[["Regular","4 years · 148 credits"],["Winter In-Service","6 years · 126 credits"],["Extension/Summer","5 years · 154 credits"]], outcomes:["Improve crop productivity, resilience and food security.","Apply plant breeding, pest management and biotechnology.","Use digital agriculture and climate-smart practices."] });
programPage({ slug:"program-pg-msc-in-agronomy", title:"Master of Science in Agronomy", level:"Postgraduate Degree", department:["Department of Plant Science","department-plant-science.html"], overview:"Advanced agronomy education and research supporting crop productivity, sustainable land management and food systems.", facts:[["Regular","2 years · 31 credits"],["Extension/Summer","3 years · 31 credits"]] });
programPage({ slug:"program-pg-msc-in-plant-pathology", title:"Master of Science in Plant Pathology", level:"Postgraduate Degree", department:["Department of Plant Science","department-plant-science.html"], overview:"Advanced study of plant disease diagnosis, epidemiology, crop protection and research.", facts:[["Regular","2 years · 35 credits"],["Extension/Summer","3 years · 35 credits"]] });
programPage({ slug:"program-ug-law", title:"Bachelor of Laws (LL.B)", level:"Undergraduate Degree", department:["School of Law","school-law.html"], overview:"The LL.B program develops legal knowledge, critical thinking, advocacy, research and professional ethics for service in the justice system and other legal sectors.", facts:[["Regular","Main Campus"],["Extension/Weekend","Main and Shashemene campuses"]], outcomes:["Interpret and apply legal principles ethically.","Develop legal writing, advocacy and research skills.","Support access to justice and community legal education."] });
programPage({ slug:"program-pg-specialty-in-surgery", title:"Specialty in General Surgery", level:"Postgraduate Medical Specialty", overview:"The national General Surgery training curriculum prepares competent surgeons through progressive supervised responsibility, clinical rotations, academic meetings, research and structured assessment.", facts:[["Award","Certificate/Specialty qualification in General Surgery"],["Structure","Sequenced rotations with progressive clinical responsibility"],["Requirements","Course completion, assessment, research and quality-assurance requirements"]], outcomes:["Manage emergency and elective surgical care.","Demonstrate safe perioperative and multidisciplinary practice.","Conduct research and maintain professional standards."], downloads:[["General Surgery Curriculum","assets/docs/medicine/general-surgery-training-curriculum.docx"]] });

const sshProgramProfiles = [
  ["program-ug-english-language-and-literature","BA English Language and Literature","Undergraduate Degree","English Language and Literature","Teaching English as a Foreign Language, literature, linguistics, communication and professional preparation."],
  ["program-pg-ma-in-tefl","MA Teaching English as a Foreign Language","Postgraduate Degree","English Language and Literature","Advanced preparation in language teaching, curriculum, assessment and applied research."],
  ["program-pg-ma-in-general-linguistics","MA General Linguistics","Postgraduate Degree","English Language and Literature","Advanced study of language structure, use, analysis and linguistic research."],
  ["program-phd-phd-in-english-language-teaching","PhD English Language Teaching","Doctoral Degree","English Language and Literature","Doctoral research and advanced scholarship in English language teaching."],
  ["program-ug-sociology","BA Sociology","Undergraduate Degree","Sociology","Study of society, institutions, social change, research and community relationships."],
  ["program-ug-geography-and-environmental-studies","BA Geography and Environmental Studies","Undergraduate Degree","Geography and Environmental Studies","Human and physical geography, environmental systems, spatial analysis and sustainable development."],
  ["program-pg-ma-in-urban-planning-and-management","MA Urban Planning and Management","Postgraduate Degree","Geography and Environmental Studies","Urban planning, governance, spatial development and sustainable city management."],
  ["program-pg-msc-in-climate-change-and-disaster-risk-management","MSc Climate Change and Disaster Risk Management","Postgraduate Degree","Geography and Environmental Studies","Climate science, adaptation, resilience and disaster-risk research and management."],
  ["program-pg-ma-in-geography-and-environmental-studies","MA Geography and Environmental Studies","Postgraduate Degree","Geography and Environmental Studies","Advanced geographic and environmental analysis with applied research."],
  ["program-phd-phd-in-geography-and-environment","PhD Geography and Environmental Studies","Doctoral Degree","Geography and Environmental Studies","Doctoral research in land resources, climate risk, urban and regional planning, or population and environment."],
  ["program-ug-geographic-information-science","BSc Geographic Information Science","Undergraduate Degree","Geographic Information Science","GIS, remote sensing, spatial databases, mapping and applied geospatial analysis."],
  ["program-pg-msc-in-gis-land-use-planning-and-management","MSc GIS and Land Resource Management","Postgraduate Degree","Geographic Information Science","Advanced GIS, land-use planning, spatial decision support and resource management."],
  ["program-ug-afan-oromo-and-literature","BA Afaan Oromo and Literature","Undergraduate Degree","Afaan Oromo and Literature","Language skills, linguistics, literature, culture and professional communication."],
  ["program-pg-ma-in-afan-oromo-and-literature","MA Afaan Oromo and Literature","Postgraduate Degree","Afaan Oromo and Literature","Advanced language, literature and research preparation."],
  ["program-ug-journalism-and-communication","BA Journalism and Communication","Undergraduate Degree","Journalism and Communication","Journalism practice, media production, public communication, ethics and research."],
  ["program-ug-civics-and-ethical-education","BA Civics and Ethical Studies","Undergraduate Degree","Civics and Ethical Studies","Civic knowledge, ethics, governance, citizenship and community responsibility."],
  ["program-ug-history-and-heritage-management","BA History and Heritage Management","Undergraduate Degree","History and Heritage Management","Historical inquiry, heritage documentation, interpretation and management."],
  ["program-pg-ma-in-history","MA History","Postgraduate Degree","History and Heritage Management","Advanced historical scholarship, source analysis and research."],
  ["program-ug-amharic-language-and-literature","BA Amharic Language and Literature","Undergraduate Degree","Ethiopian Language and Literature–Amharic","Amharic language, linguistics, literature and professional communication."],
  ["program-pg-ma-in-applied-linguistics-in-teaching-amharic","MA Applied Linguistics in Teaching Amharic","Postgraduate Degree","Ethiopian Language and Literature–Amharic","Applied linguistics, Amharic language pedagogy and research."]
];
for (const [slug, title, level, departmentName, overview] of sshProgramProfiles) {
  const department = sshDepartments.find((item) => item[1] === departmentName);
  programPage({
    slug, title, level, overview,
    department: [departmentName, `${department?.[0] || "college-social-sciences-humanities"}.html`],
    outcomes: ["Develop discipline-specific knowledge and analytical competence.", "Apply research, communication and ethical professional practice.", "Contribute to education, public service and community development."]
  });
}

add({
  slug:"community-legal-aid-services", title:"Free Legal Aid Services", subtitle:"School of Law · Community Engagement",
  description:"MWU free legal advice, pleading preparation and court representation for vulnerable communities.", parent:"Community Engagement", parentHref:"community.html",
  body: section("Access to Justice", `<p>The School of Law provides free legal aid across six specialized centres under Oromia Attorney General Advocacy Licence No. 03-401260. The service supports people who cannot afford private legal advocates, with particular attention to women, children, persons with disabilities or health conditions, older people and internally displaced persons.</p>`) +
    section("Services", list(["Expert legal advice and case assessment", "Drafting legal pleadings and supporting documents", "Direct representation before courts where appropriate", "Legal-rights education and community awareness", "Referral and follow-up support"])) +
    `<div class="mwu-note">The previous placeholder phone number has been removed. Requests should use the university contact page until the School supplies an approved legal-aid phone number and email.</div><div class="btn-wrap mt-25"><a class="th-btn" href="contact.html">Contact MWU</a><a class="th-btn style-border1" href="school-law.html">School of Law</a></div>`
});

const menuTree = [
  ["Home","/"],
  ["About Us","about.html",[["About MWU","about.html"],["Mission and Vision","about.html#mission"],["MWU Leadership","faculty.html"],["Academic Staff Statistics","academic-staff-statistics.html"]]],
  ["Latest","news.html",[["News","news.html"],["Events","event.html"],["Announcements","announcements.html"],["Vacancies","vacancies.html"]]],
  ["Administration","administration.html",[["President","president.html"],["Office of the President","administration.html"],["Research Internationalization & Partnership","research-internationalization-partnership.html"],["Academic & Research Vice President","administration.html"],["Administration & Development Vice President","administration.html"]]],
  ["Academics","program.html",[["Colleges, Schools & Departments","academics-structure.html"],["Social Sciences & Humanities","college-social-sciences-humanities.html"],["Physics Department","department-physics.html"],["Plant Science Department","department-plant-science.html"],["School of Law","school-law.html"],["All Programs","program.html"]]],
  ["Research & Innovation","research.html",[["Active Research","research.html"],["Internationalization & Partnership","research-internationalization-partnership.html"],["Research Centers","robe-integrated-research-center.html"],["Journals & Conferences","research.html"]]],
  ["Community","community.html",[["Legal Aid","community-legal-aid-services.html"],["Training","community-training-capacity-building.html"],["Consultancy","community-consultancy-services.html"],["Volunteer Programs","community-volunteer-program.html"]]],
  ["Services","services.html",[["Library","library-services.html"],["Referral Hospital & Clinics","campus.html"],["ICT & Campus Services","services.html"]]],
  ["Blogs","blog.html"]
];
const menuHtml = (items) => `<ul>${items.map(([label, href, children]) => `<li${children?.length ? ` class="menu-item-has-children"` : ""}><a href="${href}">${label}</a>${children?.length ? `<ul class="sub-menu">${children.map(([childLabel, childHref, grand]) => `<li${grand?.length ? ` class="menu-item-has-children"` : ""}><a href="${childHref}">${childLabel}</a>${grand?.length ? menuHtml(grand) : ""}</li>`).join("")}</ul>` : ""}</li>`).join("")}</ul>`;

function replaceFirstListAfter(html, marker, replacement) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Header marker not found: ${marker}`);
  const start = html.indexOf("<ul", markerIndex);
  const openEnd = html.indexOf(">", start) + 1;
  let depth = 1;
  const tagPattern = /<\/?ul\b[^>]*>/gi;
  tagPattern.lastIndex = openEnd;
  let match;
  while ((match = tagPattern.exec(html))) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(0, start) + replacement + html.slice(tagPattern.lastIndex);
  }
  throw new Error(`Unclosed menu list after ${marker}`);
}

for (const target of targets) {
  fs.mkdirSync(target, { recursive: true });
  for (const [slug, html] of pages) fs.writeFileSync(path.join(target, `${slug}.html`), html);
}

// Keep supporting pages referenced by the approved menu available in the
// public website checkout even when that checkout previously lagged Admin.
for (const fileName of ["event.html", "community-consultancy-services.html", "community-training-capacity-building.html", "community-volunteer-program.html"]) {
  fs.copyFileSync(path.join(adminRoot, "public/legacy", fileName), path.join(siteRoot, "public/legacy", fileName));
}

const copies = [
  ["2002 Kiremt  Physics Curriculum course breakdown.pdf", "assets/docs/physics/physics-bsc-summer-course-breakdown.pdf"],
  ["Physics (PDF).pdf", "assets/docs/physics/physics-msc-harmonized-curriculum.pdf"],
  ["Physics Curr.pdf", "assets/docs/physics/physics-msc-mwu-2018-curriculum.pdf"],
  ["Revised_NATIONAL_GENERAL_SURGERY_TRAINING_CURRICULUM_1_4_2.docx", "assets/docs/medicine/general-surgery-training-curriculum.docx"],
  ["For Website---MWU--Library.docx", "assets/docs/source-material/mwu-library-source.docx"],
  ["Internationalization_and_Research_Partnership_IRPD_Madda_Walabu.docx", "assets/docs/source-material/irpd-source.docx"],
  ["Madda_Walabu_University_Lists_of_Academic_Staff_Detail_with_Designations.docx", "assets/docs/source-material/academic-staff-statistics-source.docx"],
  ["PlSc for Website.docx", "assets/docs/source-material/plant-science-source.docx"],
  ["school of law.docx", "assets/docs/source-material/school-of-law-source.docx"],
  ["Social Science and Humanities College Website Profile.docx", "assets/docs/source-material/sshc-profile-source.docx"]
  ,["MEDA WOLABU YNI. 2018.xlsx", "assets/docs/reports/mwu-exam-centre-distribution-2018.xlsx"]
];
for (const target of targets) {
  for (const [source, destination] of copies) {
    const output = path.join(target, destination);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, source), output);
  }
}

const headerPaths = [
  path.join(adminRoot, "public/assets/partials/inner-header.html"),
  path.join(siteRoot, "public/assets/partials/inner-header.html")
];
for (const headerPath of headerPaths) {
  let html = fs.readFileSync(headerPath, "utf8");
  html = replaceFirstListAfter(html, '<div class="th-mobile-menu">', menuHtml(menuTree));
  html = replaceFirstListAfter(html, '<nav class="main-menu">', menuHtml(menuTree));
  fs.writeFileSync(headerPath, html);
}

const registryPath = path.join(siteRoot, "src/legacyPages.js");
let registry = fs.readFileSync(registryPath, "utf8");
const newSlugs = [...pages.keys()].filter((slug) => !registry.includes(`"${slug}"`)).sort();
if (newSlugs.length) {
  registry = registry.replace("export const legacyPages = [", `export const legacyPages = [\n${newSlugs.map((slug) => `  "${slug}",`).join("\n")}`);
  fs.writeFileSync(registryPath, registry);
}

console.log(`Generated/updated ${pages.size} pages in both repositories.`);
console.log(`Copied ${copies.length} authoritative source/curriculum files to each website.`);
console.log(`Registered ${newSlugs.length} new website routes and synchronized both shared headers.`);

if (process.argv.includes("--publish-api")) {
  await import("dotenv/config");
  const apiBase = String(process.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  const loginResponse = await fetch(`${apiBase}/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: process.env.ADMIN_BOOTSTRAP_EMAIL,
      password: process.env.ADMIN_BOOTSTRAP_PASSWORD
    })
  });
  if (!loginResponse.ok) throw new Error(`Admin login failed (${loginResponse.status})`);
  const loginPayload = await loginResponse.json();
  const token = loginPayload.token || loginPayload.data?.token || loginPayload.access_token;
  const headers = { "content-type": "application/json", Authorization: `Bearer ${token}` };
  const pageResponse = await fetch(`${apiBase}/admin/pages`, { headers });
  if (!pageResponse.ok) throw new Error(`Admin pages fetch failed (${pageResponse.status})`);
  const pagePayload = await pageResponse.json();
  const existingPages = Array.isArray(pagePayload) ? pagePayload : pagePayload.pages || pagePayload.data || [];
  const bySlug = new Map(existingPages.map((entry) => [String(entry.slug || entry.page_slug || ""), entry]));
  let created = 0;
  let updated = 0;
  const failures = [];

  for (const [slug, html] of pages) {
    const existing = bySlug.get(slug);
    const titleMatch = html.match(/<title>(.*?)\s*\|\s*Madda Walabu University<\/title>/i);
    const title = titleMatch?.[1] || slug.replace(/-/g, " ");
    const type = slug.startsWith("program-")
      ? "Program Page"
      : slug.startsWith("department-")
        ? "Department Page"
        : /^(college-|school-|academics-)/.test(slug)
          ? "Academic Page"
          : "Static Page";
    const payload = {
      ...(existing || {}),
      id: existing?.id,
      page_id: existing?.page_id || existing?.id,
      title,
      slug,
      type,
      page_type: "static",
      status: "Published",
      visibility: "Public",
      template: "Legacy HTML",
      source_url: `/legacy/${slug}.html`,
      body_html: html,
      raw_html: "",
      sections: []
    };
    const response = await fetch(existing ? `${apiBase}/admin/pages/${encodeURIComponent(existing.id || slug)}` : `${apiBase}/admin/pages`, {
      method: existing ? "PUT" : "POST",
      headers,
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      existing ? updated++ : created++;
    } else {
      failures.push(`${slug}: ${response.status} ${await response.text()}`);
    }
  }

  const headerPage = bySlug.get("site-header");
  if (headerPage) {
    const headerHtml = fs.readFileSync(path.join(adminRoot, "public/assets/partials/inner-header.html"), "utf8");
    const response = await fetch(`${apiBase}/admin/pages/${encodeURIComponent(headerPage.id || "site-header")}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        ...headerPage,
        id: headerPage.id,
        page_id: headerPage.page_id || headerPage.id,
        slug: "site-header",
        status: "Published",
        body_html: headerHtml,
        raw_html: "",
        sections: []
      })
    });
    if (!response.ok) failures.push(`site-header: ${response.status} ${await response.text()}`);
    else updated++;
  }

  console.log(`Admin API publish complete: ${created} created, ${updated} updated, ${failures.length} failed.`);
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  }
}
