import { initialMediaLibrary, mediaApiUrl, buildMediaDimensions, normalizeMediaItem, normalizeMediaApiItem, mergeMediaLibraries, readFileAsDataUrl, readImageDimensions, normalizeLiveAssetUrl } from "../modules/mediaLibrary";
import { getAuthHeaders, readApiError } from "../runtime/portalRuntime";
import { readOptionalJson } from "../runtime/pageRuntime";

export default function useMediaController({
  requireAnyPortalAccess, mediaStorageMode, adminToken, mediaLibrary, setMediaLibrary, setMediaStorageMode, setNotice, setDangerDialog, updateField
}) {
  const commitMediaLibrary = (nextLibrary) => {  
    const normalizedLibrary = nextLibrary.map(normalizeMediaItem);  
    setMediaLibrary(normalizedLibrary);  
    return normalizedLibrary;  
  };  
    
  const requestDangerConfirmation = ({  
    title,  
    message,  
    details = [],  
    verificationText = "DELETE",  
    continueLabel = "Continue",  
    finalLabel = "Delete Permanently"  
  }) => new Promise((resolve) => {  
    setDangerDialog({  
      title,  
      message,  
      details,  
      verificationText,  
      continueLabel,  
      finalLabel,  
      resolve  
    });  
  });  
    
  const resolveDangerConfirmation = (accepted) => {  
    setDangerDialog((current) => {  
      current?.resolve?.(accepted);  
      return null;  
    });  
  };  
    
  const uploadMediaFilesLocally = async (files) => {  
    const fileList = Array.from(files || []).filter(Boolean);  
    if (!fileList.length) {  
      return [];  
    }  
    
    const uploadedItems = [];  
    for (const file of fileList) {  
      const path = await readFileAsDataUrl(file);  
      const { width, height } = await readImageDimensions(path);  
      uploadedItems.push(normalizeMediaItem({  
        title: file.name.replace(/\.[^.]+$/, "") || "Uploaded media",  
        type: "Upload",  
        path,  
        bytes: file.size,  
        width,  
        height,  
        mimeType: file.type || "image/jpeg"  
      }));  
    }  
    
    commitMediaLibrary([...uploadedItems, ...mediaLibrary]);  
    setMediaStorageMode("local");  
    setNotice(`Uploaded ${uploadedItems.length} media item${uploadedItems.length === 1 ? "" : "s"} to the browser media library.`);  
    return uploadedItems;  
  };  
    
  const uploadMediaFiles = async (files) => {  
    const fileList = Array.from(files || []).filter(Boolean);  
    if (!fileList.length) {  
      return [];  
    }  
    if (!requireAnyPortalAccess(["media"], "Media uploads")) {  
      return [];  
    }  
    
    if (mediaStorageMode === "api") {
      try {
        const uploadedItems = [];  
        for (const file of fileList) {  
          const dataUrl = await readFileAsDataUrl(file);  
          const { width, height } = await readImageDimensions(dataUrl);  
          const response = await fetch(mediaApiUrl(), {  
            method: "POST",  
            headers: {  
              "Content-Type": "application/json",  
              Accept: "application/json",  
              ...getAuthHeaders(adminToken)
            },  
            body: JSON.stringify({  
              title: file.name.replace(/\.[^.]+$/, "") || "Uploaded media",  
              type: "Upload",  
              width,  
              height,  
              dimensions: buildMediaDimensions(width, height),  
              upload: {  
                name: file.name,  
                type: file.type,  
                dataUrl  
              }  
            })  
          });  
          if (response.status === 401) {
            throw new Error("Your portal session is no longer authorized for media uploads. Sign in again.");
          }  
          if (!response.ok) {  
            throw new Error(await readApiError(response, "Media upload failed."));  
          }  
          const payload = await readOptionalJson(response);  
          const rawItem = payload?.item || payload?.data?.item || payload?.media || payload?.data?.media || payload?.data || payload || {};  
          const item = normalizeMediaApiItem(rawItem);  
          if (item.path) {  
            uploadedItems.push(item);  
          }  
          const nextItems = Array.isArray(payload?.items)  
            ? payload.items  
            : Array.isArray(payload?.data?.items)  
              ? payload.data.items  
              : null;  
          if (nextItems) {  
            commitMediaLibrary(mergeMediaLibraries(nextItems, uploadedItems, initialMediaLibrary));  
          }  
        }  
        if (uploadedItems.length) {  
          if (!mediaLibrary.some((entry) => uploadedItems.some((uploaded) => uploaded.path === entry.path))) {  
            commitMediaLibrary(mergeMediaLibraries(uploadedItems, mediaLibrary, initialMediaLibrary));  
          }  
          setNotice(`Uploaded ${uploadedItems.length} media item${uploadedItems.length === 1 ? "" : "s"} to the website media library.`);  
          return uploadedItems;  
        }  
    
        setNotice("Media upload completed without returning a public image URL. The image was not added.");
        return [];
      } catch (error) {
        setNotice(error.message || "Media upload failed.");
        return [];
      }  
    }  
    
    return uploadMediaFilesLocally(fileList);  
  };  
    
  const deleteMediaItem = async (mediaId) => {  
    if (!requireAnyPortalAccess(["media"], "Media delete")) {  
      return false;  
    }  
    const removedItem = mediaLibrary.find((item) => String(item.id) === String(mediaId)) || null;  
    if (!removedItem) {  
      return false;  
    }  
    
    const confirmed = await requestDangerConfirmation({  
      title: "Delete media item?",  
      message: "This permanently removes the selected media item and may affect pages that reference it.",  
      details: [  
        `Media: ${removedItem.title || "Untitled media"}`,  
        `Path: ${removedItem.path || "No media path available"}`  
      ],  
      verificationText: removedItem.title || "DELETE MEDIA",  
      finalLabel: "Delete Media"  
    });  
    if (!confirmed) {  
      setNotice("Media delete cancelled.");  
      return false;  
    }  
    
    const nextLibrary = mediaLibrary.filter((item) => String(item.id) !== String(mediaId));  
    if (nextLibrary.length === mediaLibrary.length) {  
      return false;  
    }  
    
    if (mediaStorageMode === "api") {  
      return fetch(mediaApiUrl(`/admin/media/${encodeURIComponent(mediaId)}`), {  
        method: "DELETE",  
        headers: {  
          Accept: "application/json",  
          ...getAuthHeaders(adminToken)
        }  
      }).then(async (response) => {  
        if (response.status === 401) {
          setNotice("Your portal session is no longer authorized to delete media. Sign in again.");
          return false;  
        }  
        if (!response.ok) {  
          setNotice(await readApiError(response, "Media delete failed."));  
          return false;  
        }  
        const payload = await readOptionalJson(response);  
        const remoteItems = Array.isArray(payload?.items)  
          ? payload.items  
          : Array.isArray(payload?.data?.items)  
            ? payload.data.items  
            : [];  
        commitMediaLibrary(mergeMediaLibraries(remoteItems, initialMediaLibrary));  
        if (formPage.heroImage && removedItem?.path === formPage.heroImage) {  
          updateField("heroImage", remoteItems[0]?.path || initialMediaLibrary[0]?.path || "");  
        }  
        setNotice("Media item deleted from the website media library.");  
        return true;  
      }).catch((error) => {  
        setNotice(error.message || "Media delete failed.");  
        return false;  
      });  
    }  
    
    commitMediaLibrary(nextLibrary);  
    if (formPage.heroImage && removedItem?.path === formPage.heroImage) {  
      updateField("heroImage", nextLibrary[0]?.path || "");  
    }  
    setNotice("Media item deleted from the browser media library.");  
    return true;  
  };  
    
  const copyMediaUrl = async (url) => {  
    if (!url) return false;  
    try {  
      const copyValue = normalizeLiveAssetUrl(url) || url;  
      await navigator.clipboard.writeText(copyValue);  
      setNotice("Media URL copied.");  
      return true;  
    } catch {  
      setNotice("Clipboard copy failed. Copy the media URL manually.");  
      return false;  
    }  
  };  
    

  return {
    commitMediaLibrary, requestDangerConfirmation, resolveDangerConfirmation, uploadMediaFiles, deleteMediaItem, copyMediaUrl
  };
}
