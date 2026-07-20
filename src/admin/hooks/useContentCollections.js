import { useMemo } from "react";
import { findSiteChromePage, createSiteChromePage } from "../runtime/siteChromeRuntime";
import { isSiteChromePage } from "../runtime/pageRuntime";
import { getSeoScore, isProgramPage, isBlogPage, isEventPage, isNormalWebsitePage } from "../runtime/programRuntime";

export default function useContentCollections({
  pages, siteChromeTab, formPage, programs, programCategories, query, statusFilter, typeFilter, menuFilter, sortKey
}) {
  const contentManagedPages = useMemo(() => pages.filter((page) => !isSiteChromePage(page)), [pages]);  
    
  const activeSiteChromePage = useMemo(() => {  
    const existing = findSiteChromePage(pages, siteChromeTab);  
    if (isMatchingSiteChromePage(formPage, siteChromeTab)) {  
      return createSiteChromePage(siteChromeTab, formPage);  
    }  
    return createSiteChromePage(siteChromeTab, existing || {});  
  }, [formPage, pages, siteChromeTab]);  
    
  const programPages = useMemo(  
    () =>  
      contentManagedPages  
        .filter(isProgramPage)  
        .sort((a, b) => {  
          if (a.slug === "program" || a.slug?.startsWith("programs-")) return -1;  
          if (b.slug === "program" || b.slug?.startsWith("programs-")) return 1;  
          return a.title.localeCompare(b.title);  
        }),  
    [contentManagedPages]  
  );  
  const megaMenuPrograms = useMemo(() => {  
    const catalogPrograms = programs.map((program) => ({  
      ...program,  
      id: String(program.id),  
      pageSlug: program.pageSlug || program.slug  
    }));  
    const representedKeys = new Set(  
      catalogPrograms.flatMap((program) => [  
        String(program.pageSlug || "").toLowerCase(),  
        String(program.slug || "").toLowerCase(),  
        String(program.title || "").toLowerCase()  
      ])  
    );  
    const pagePrograms = programPages  
      .filter((page) => page.slug !== "program" && !String(page.slug || "").startsWith("programs-"))  
      .filter(  
        (page) =>  
          !representedKeys.has(String(page.slug || "").toLowerCase()) &&  
          !representedKeys.has(String(page.title || "").toLowerCase())  
      )  
      .map((page) => {  
        const slug = String(page.slug || "");  
        const level = slug.includes("-phd-")  
          ? "PhD"  
          : slug.includes("-pg-")  
            ? "Postgraduate"  
            : "Undergraduate";  
        const categorySlug = level === "PhD"  
          ? "phd-programs"  
          : level === "Postgraduate"  
            ? "postgraduate-programs"  
            : "undergraduate-programs";  
        return {  
          id: `page:${page.id}`,  
          title: page.title,  
          slug,  
          pageSlug: slug,  
          categorySlug,  
          level,  
          college: page.owner || "Academic Affairs",  
          status: page.status || "Published",  
          heroImage: page.heroImage || "",  
          summary: page.summary || "",  
          source: "page"  
        };  
      });  
    
    return [...catalogPrograms, ...pagePrograms].sort((a, b) => a.title.localeCompare(b.title));  
  }, [programPages, programs]);  
    
  const blogPages = useMemo(  
    () =>  
      contentManagedPages  
        .filter(isBlogPage)  
        .sort((a, b) => {  
          if (a.slug === "blog") return -1;  
          if (b.slug === "blog") return 1;  
          return new Date(b.updatedAt) - new Date(a.updatedAt);  
        }),  
    [contentManagedPages]  
  );  
    
  const eventPages = useMemo(  
    () =>  
      contentManagedPages  
        .filter(isEventPage)  
        .sort((a, b) => {  
          if (a.slug === "event") return -1;  
          if (b.slug === "event") return 1;  
          return new Date(b.updatedAt) - new Date(a.updatedAt);  
        }),  
    [contentManagedPages]  
  );  
    
  const standardPages = useMemo(() => contentManagedPages.filter(isNormalWebsitePage), [contentManagedPages]);  
    
  const filteredPages = useMemo(() => {  
    return standardPages.filter((page) => {  
      const matchesQuery = [page.title, page.slug, page.type, page.menu, page.owner]  
        .join(" ")  
        .toLowerCase()  
        .includes(query.toLowerCase());  
      const matchesStatus = statusFilter === "All" || (page.status || "").toLowerCase() === statusFilter.toLowerCase();  
      const matchesType = typeFilter === "All" || page.type === typeFilter;  
      const matchesMenu = menuFilter === "All" || page.menu === menuFilter;  
      return matchesQuery && matchesStatus && matchesType && matchesMenu;  
    }).sort((a, b) => {  
      if (sortKey === "title") {  
        return a.title.localeCompare(b.title);  
      }  
    
      if (sortKey === "menuOrder") {  
        return Number(a.menuOrder || 0) - Number(b.menuOrder || 0);  
      }  
    
      if (sortKey === "status") {  
        return a.status.localeCompare(b.status);  
      }  
    
      return new Date(b.updatedAt) - new Date(a.updatedAt);  
    });  
  }, [standardPages, query, statusFilter, typeFilter, menuFilter, sortKey]);  
    
  const stats = useMemo(() => {  
    const published = contentManagedPages.filter((page) => page.status === "Published").length;  
    const review = contentManagedPages.filter((page) => page.status === "Review").length;  
    const scheduled = contentManagedPages.filter((page) => page.status === "Scheduled").length;  
    const archived = contentManagedPages.filter((page) => page.status === "Archived").length;  
    const averageSeo = Math.round(  
      contentManagedPages.reduce((sum, page) => sum + getSeoScore(page), 0) / Math.max(contentManagedPages.length, 1)  
    );  
    
    return { published, review, scheduled, archived, averageSeo };  
  }, [contentManagedPages]);  
    

  return { contentManagedPages, activeSiteChromePage, programPages, megaMenuPrograms, blogPages, eventPages, standardPages, filteredPages, stats };
}
