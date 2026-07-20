import { updateProgramsMegaMenuMarkup } from "../views/SiteChromeView";
import { LIVE_PROGRAMS_API_URL, apiUrl, getAuthHeaders, readApiError, todayIso } from "../runtime/portalRuntime";
import { slugify, normalizeSection, normalizePage, toApiPagePayload, readOptionalJson, getPageApiIdentifiers, isMatchingSiteChromePage } from "../runtime/pageRuntime";
import { findSiteChromePage, normalizeSiteChromeApiPage, getSiteChromeHtml, createSiteChromePage } from "../runtime/siteChromeRuntime";
import { normalizeProgramCategory, normalizeProgram, normalizeImportedProgram, createProgramCategoriesFromImportedPrograms, createProgramPageFromProgram } from "../runtime/programRuntime";

export default function useProgramController({
  requireAnyPortalAccess, megaMenuPrograms, requestDangerConfirmation, persistPageToApi, publishSiteChromeFile,
  adminToken, pages, setPages, programCategories, setProgramCategories, programs, setPrograms, formPage, setFormPage, setNotice
}) {
  const mainProgramsPage =  
    pages.find((page) => page.slug === "programs-for-local-and-global-competence") ||  
    pages.find((page) => page.menu === "Programs") ||  
    formPage;  
    
  const updateMainProgramsPage = (field, value) => {  
    if (!requireAnyPortalAccess(["programs"], "Program page updates")) {  
      return;  
    }  
    const nextPage = {  
      ...mainProgramsPage,  
      [field]: field === "slug" ? slugify(value) : value,  
      updatedAt: todayIso(),  
      updatedBy: "Content Editor"  
    };  
    
    setPages((current) => current.map((page) => (String(page.id) === String(nextPage.id) ? nextPage : page)));  
    if (String(formPage.id) === String(nextPage.id)) {  
      setFormPage(nextPage);  
    }  
  };  
    
  const addProgramCategory = () => {  
    if (!requireAnyPortalAccess(["programs"], "Program category creation")) {  
      return;  
    }  
    const category = normalizeProgramCategory({  
      name: "New Program Category",  
      slug: `new-program-category-${programCategories.length + 1}`,  
      status: "Draft",  
      menuOrder: programCategories.length + 1  
    });  
    
    setProgramCategories((current) => [category, ...current]);  
    setNotice("Program category created.");  
  };  
    
  const updateProgramCategory = (categoryId, field, value) => {  
    if (!requireAnyPortalAccess(["programs"], "Program category updates")) {  
      return;  
    }  
    const previousCategory = programCategories.find((category) => category.id === categoryId);  
    setProgramCategories((current) =>  
      current.map((category) => {  
        if (category.id !== categoryId) {  
          return category;  
        }  
    
        const nextCategory = {  
          ...category,  
          [field]:  
            field === "featured"  
              ? Boolean(value)  
              : field === "programIds"  
                ? Array.from(new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean)))  
                : value,  
          updatedAt: todayIso()  
        };  
    
        if (field === "name" && category.slug === slugify(category.name)) {  
          nextCategory.slug = slugify(value);  
        }  
    
        if (field === "slug") {  
          nextCategory.slug = slugify(value);  
        }  
    
        if (field === "menuOrder") {  
          nextCategory.menuOrder = Number(value || 1);  
        }  
    
        return nextCategory;  
      })  
    );  
    
    const nextCategorySlug =  
      field === "slug"  
        ? slugify(value)  
        : field === "name" && previousCategory?.slug === slugify(previousCategory.name)  
          ? slugify(value)  
          : "";  
    if (nextCategorySlug && previousCategory && nextCategorySlug !== previousCategory.slug) {  
      setPrograms((current) =>  
        current.map((program) =>  
          program.categorySlug === previousCategory.slug  
            ? { ...program, categorySlug: nextCategorySlug, updatedAt: todayIso() }  
            : program  
        )  
      );  
    }  
  };  
    
  const updateProgramMegaMenuCategory = (categoryId, programIds) => {  
    if (!requireAnyPortalAccess(["programs", "site-chrome"], "Programs mega-menu updates")) {  
      return;  
    }  
    const normalizedIds = Array.from(  
      new Set((Array.isArray(programIds) ? programIds : []).map(String).filter(Boolean))  
    );  
    const nextCategories = programCategories.map((category) =>  
      category.id === categoryId  
        ? { ...category, programIds: normalizedIds, updatedAt: todayIso() }  
        : category  
    );  
    const updateHeaderPage = (page) => {  
      if (!isMatchingSiteChromePage(page, "header")) return page;  
      const currentHtml = getSiteChromeHtml(page);  
      if (!currentHtml) return page;  
      const nextHtml = updateProgramsMegaMenuMarkup(currentHtml, nextCategories, megaMenuPrograms);  
      return createSiteChromePage("header", {  
        ...page,  
        bodyHtml: nextHtml,  
        rawHtml: "",  
        sections: [  
          normalizeSection({  
            id: page.sections?.[0]?.id,  
            type: "Raw HTML",  
            title: "Website Header Markup",  
            html: nextHtml,  
            body: nextHtml,  
            layout: "Legacy HTML",  
            visible: true  
          })  
        ]  
      });  
    };  
    
    setProgramCategories(nextCategories);  
    setPages((current) => current.map(updateHeaderPage));  
    setFormPage((current) => updateHeaderPage(current));  
    setNotice("Programs mega-menu assignments updated. Use Save Mega Menu to publish them live.");  
  };  
    
  const saveProgramsMegaMenu = async ({ categories = programCategories, html = "" } = {}) => {  
    if (!requireAnyPortalAccess(["programs", "site-chrome"], "Programs mega-menu publishing")) {  
      return null;  
    }  
    
    try {  
      let headerPage = findSiteChromePage(pages, "header");  
      if (!headerPage) {  
        setNotice("Website Header record was not found in the Admin API.");  
        return null;  
      }  
    
      for (const identifier of getPageApiIdentifiers(headerPage)) {  
        try {  
          const response = await fetch(apiUrl(`/admin/pages/${encodeURIComponent(identifier)}`), {  
            headers: getAuthHeaders(adminToken),  
            cache: "no-store"  
          });  
          if (!response.ok) continue;  
          const payload = await readOptionalJson(response);  
          const detailedPage = normalizeSiteChromeApiPage(payload, headerPage);  
          if (isMatchingSiteChromePage(detailedPage, "header")) {  
            headerPage = detailedPage;  
            break;  
          }  
        } catch {  
          // Try the next stable page identifier.  
        }  
      }  
    
      const currentHtml = getSiteChromeHtml(headerPage);  
      if (!currentHtml) {  
        setNotice("Website Header record contains no markup to update.");  
        return null;  
      }  
    
      const nextHtml = html || updateProgramsMegaMenuMarkup(currentHtml, categories, megaMenuPrograms);  
      const pageOverride = createSiteChromePage("header", {  
        ...headerPage,  
        status: "Published",  
        bodyHtml: nextHtml,  
        rawHtml: "",  
        sections: [  
          normalizeSection({  
            id: headerPage.sections?.[0]?.id,  
            type: "Raw HTML",  
            title: "Website Header Markup",  
            html: nextHtml,  
            body: nextHtml,  
            layout: "Legacy HTML",  
            visible: true  
          })  
        ]  
      });  
      const { savedPage } = await persistPageToApi(pageOverride, headerPage);  
    
      setPages((current) =>  
        current.map((page) => (isMatchingSiteChromePage(page, "header") ? savedPage : page))  
      );  
      if (isMatchingSiteChromePage(formPage, "header")) {  
        setFormPage(savedPage);  
      }  
      setProgramCategories(categories);  
      const publishResult = await publishSiteChromeFile("header", nextHtml);  
      if (!publishResult.live) {  
        const reason = publishResult.error || "The live site publishing endpoint did not accept the update.";  
        setNotice(`Programs mega-menu was saved to the Header database record, but the live header was not updated. ${reason}`);  
        return null;  
      }  
      setNotice("Programs mega-menu saved to the Header database record and published live.");  
      return savedPage;  
    } catch (error) {  
      setNotice(error.message || "Programs mega-menu save failed.");  
      return null;  
    }  
  };  
    
  const importLivePrograms = async () => {  
    if (!requireAnyPortalAccess(["programs"], "Live program import")) {  
      return;  
    }  
    
    try {  
      const response = await fetch(LIVE_PROGRAMS_API_URL, {  
        headers: { Accept: "application/json" },  
        cache: "no-store"  
      });  
      if (!response.ok) {  
        throw new Error(await readApiError(response, "Live programs API is not available."));  
      }  
    
      const payload = await readOptionalJson(response);  
      const sourcePrograms = Array.isArray(payload?.programs)  
        ? payload.programs  
        : Array.isArray(payload?.data?.programs)  
          ? payload.data.programs  
          : Array.isArray(payload?.data)  
            ? payload.data  
            : Array.isArray(payload)  
              ? payload  
              : [];  
    
      if (!sourcePrograms.length) {  
        setNotice("No live programs were returned by the public API.");  
        return;  
      }  
    
      const importedPrograms = sourcePrograms.map(normalizeImportedProgram);  
      const importedCategories = createProgramCategoriesFromImportedPrograms(sourcePrograms);  
      const importedProgramPages = importedPrograms.map((program, index) =>  
        normalizePage({  
          ...createProgramPageFromProgram({ ...program, menuOrder: index + 1 }),  
          id: `program-page-${program.slug}`,  
          isLocalDraft: false,  
          localOnly: false,  
          pageSlug: program.slug  
        })  
      );  
      const savedProgramPages = [];  
      for (const page of importedProgramPages) {  
        try {  
          const existingPage = pages.find((entry) => entry.slug === page.slug);  
          const response = await fetch(apiUrl(existingPage ? `/admin/pages/${encodeURIComponent(existingPage.id || existingPage.slug)}` : "/admin/pages"), {  
            method: existingPage ? "PUT" : "POST",  
            headers: {  
              "Content-Type": "application/json",  
              ...getAuthHeaders(adminToken)  
            },  
            body: JSON.stringify(toApiPagePayload({ ...existingPage, ...page, id: existingPage?.id || page.id }))  
          });  
          if (response.ok) {  
            const payload = await readOptionalJson(response);  
            savedProgramPages.push(normalizePage(payload?.page || payload?.data?.page || payload?.data || page));  
          } else {  
            savedProgramPages.push(page);  
          }  
        } catch {  
          savedProgramPages.push(page);  
        }  
      }  
    
      setProgramCategories((current) => {  
        const nextBySlug = new Map(current.map((category) => [category.slug, normalizeProgramCategory(category)]));  
        importedCategories.forEach((category) => {  
          nextBySlug.set(category.slug, {  
            ...(nextBySlug.get(category.slug) || {}),  
            ...category,  
            updatedAt: todayIso()  
          });  
        });  
        return Array.from(nextBySlug.values()).sort((a, b) => Number(a.menuOrder || 0) - Number(b.menuOrder || 0));  
      });  
    
      setPrograms((current) => {  
        const nextBySlug = new Map(current.map((program) => [program.slug, normalizeProgram(program)]));  
        importedPrograms.forEach((program) => {  
          nextBySlug.set(program.slug, {  
            ...(nextBySlug.get(program.slug) || {}),  
            ...program,  
            pageSlug: program.slug,  
            updatedAt: todayIso()  
          });  
        });  
        return Array.from(nextBySlug.values()).sort((a, b) => a.title.localeCompare(b.title));  
      });  
    
      setPages((current) => {  
        const nextBySlug = new Map(current.map((page) => [page.slug, normalizePage(page)]));  
        savedProgramPages.forEach((page) => {  
          nextBySlug.set(page.slug, {  
            ...(nextBySlug.get(page.slug) || {}),  
            ...page,  
            updatedAt: todayIso()  
          });  
        });  
        return Array.from(nextBySlug.values());  
      });  
    
      setNotice(`Imported ${importedPrograms.length} programs, ${importedCategories.length} categories, and ${savedProgramPages.length} program pages from the live website API.`);  
    } catch (error) {  
      setNotice(error.message || "Live program import failed.");  
    }  
  };  
    
  const deleteProgramCategory = async (categoryId) => {  
    if (!requireAnyPortalAccess(["programs"], "Program category deletion")) {  
      return;  
    }  
    const category = programCategories.find((item) => item.id === categoryId);  
    if (!category) {  
      return;  
    }  
    
    const movedPrograms = programs.filter((program) => program.categorySlug === category.slug).length;  
    const confirmed = await requestDangerConfirmation({  
      title: "Delete program category?",  
      message: "The category will be removed and its related programs will be moved into the default category.",  
      details: [  
        `Category: ${category.name}`,  
        `Programs to reassign: ${movedPrograms}`  
      ],  
      verificationText: category.slug || category.name || "DELETE CATEGORY",  
      finalLabel: "Delete Category"  
    });  
    if (!confirmed) {  
      setNotice("Category delete cancelled.");  
      return;  
    }  
    
    const uncategorized = programCategories.find((item) => item.slug === "undergraduate-programs") || programCategories[0];  
    setPrograms((current) =>  
      current.map((program) =>  
        program.categorySlug === category.slug ? { ...program, categorySlug: uncategorized.slug, updatedAt: todayIso() } : program  
      )  
    );  
    setProgramCategories((current) => current.filter((item) => item.id !== categoryId));  
    setNotice("Category removed. Programs were moved to the default category.");  
  };  
    
  const addProgram = (categorySlug = "") => {  
    if (!requireAnyPortalAccess(["programs"], "Program creation")) {  
      return;  
    }  
    const program = normalizeProgram({  
      title: "New Academic Program",  
      slug: `new-academic-program-${programs.length + 1}`,  
      categorySlug: categorySlug || programCategories[0]?.slug || "undergraduate-programs",  
      status: "Draft"  
    });  
    
    setPrograms((current) => [program, ...current]);  
    setNotice("Program created.");  
  };  
    
  const updateProgram = (programId, field, value) => {  
    if (!requireAnyPortalAccess(["programs"], "Program updates")) {  
      return;  
    }  
    setPrograms((current) =>  
      current.map((program) => {  
        if (program.id !== programId) {  
          return program;  
        }  
    
        const nextProgram = {  
          ...program,  
          [field]: ["featured", "applicationOpen"].includes(field) ? Boolean(value) : value,  
          updatedAt: todayIso()  
        };  
    
        if (field === "title" && program.slug === slugify(program.title)) {  
          nextProgram.slug = slugify(value);  
        }  
    
        if (field === "slug") {  
          nextProgram.slug = slugify(value);  
        }  
    
        return nextProgram;  
      })  
    );  
  };  
    
  const deleteProgram = async (programId) => {  
    if (!requireAnyPortalAccess(["programs"], "Program deletion")) {  
      return;  
    }  
    const targetProgram = programs.find((program) => program.id === programId);  
    if (!targetProgram) {  
      return;  
    }  
    
    const confirmed = await requestDangerConfirmation({  
      title: "Delete program?",  
      message: "This permanently removes the selected academic program record.",  
      details: [  
        `Program: ${targetProgram.title}`,  
        `Slug: /${targetProgram.slug}`  
      ],  
      verificationText: targetProgram.slug || targetProgram.title || "DELETE PROGRAM",  
      finalLabel: "Delete Program"  
    });  
    if (!confirmed) {  
      setNotice("Program delete cancelled.");  
      return;  
    }  
    
    setPrograms((current) => current.filter((program) => program.id !== programId));  
    setProgramCategories((current) =>  
      current.map((category) =>  
        Array.isArray(category.programIds) && category.programIds.includes(String(programId))  
          ? { ...category, programIds: category.programIds.filter((id) => id !== String(programId)), updatedAt: todayIso() }  
          : category  
      )  
    );  
    setNotice("Program removed.");  
  };  
    

  return {
    addProgramCategory, updateProgramCategory, updateProgramMegaMenuCategory, saveProgramsMegaMenu,
    importLivePrograms, deleteProgramCategory, addProgram, updateProgram, deleteProgram
  };
}
