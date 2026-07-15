import { useEffect, useRef, useState } from "react";
import { Copy, Trash2, Upload } from "lucide-react";

const shortenMediaUrl = (value = "", maxLength = 54) => {
  const raw = String(value || "").trim();
  if (!raw || raw.length <= maxLength) return raw;
  const keep = Math.max(10, Math.floor((maxLength - 3) / 2));
  return `${raw.slice(0, keep)}...${raw.slice(-keep)}`;
};

export default function MediaView({
  mediaItems = [],
  mediaStorageMode = "local",
  selectedImage,
  onSelect,
  onUploadMedia,
  onDeleteMedia,
  onCopyUrl
}) {
  const [selectedMediaId, setSelectedMediaId] = useState(
    mediaItems.find((media) => media.path === selectedImage)?.id || mediaItems[0]?.id || ""
  );
  const uploadInputRef = useRef(null);
  const selectedMedia = mediaItems.find((media) => String(media.id) === String(selectedMediaId)) || mediaItems[0] || null;

  useEffect(() => {
    if (selectedImage) {
      const match = mediaItems.find((media) => media.path === selectedImage);
      if (match) {
        setSelectedMediaId(match.id);
        return;
      }
    }
    if (selectedMediaId && !mediaItems.some((media) => String(media.id) === String(selectedMediaId))) {
      setSelectedMediaId(mediaItems[0]?.id || "");
    }
  }, [mediaItems, selectedImage, selectedMediaId]);

  const handleUpload = async (event) => {
    const files = event.target.files;
    if (!files?.length) {
      return;
    }
    try {
      const uploaded = await onUploadMedia(files);
      if (uploaded[0]) {
        setSelectedMediaId(uploaded[0].id);
      }
    } finally {
      event.target.value = "";
    }
  };

  return (
    <section className="panel media-view">
      <input ref={uploadInputRef} type="file" accept="image/*" multiple hidden onChange={handleUpload} />
      <div className="panel-head">
        <div>
          <span className="eyebrow">Media Library</span>
          <h2>Website Visual Assets</h2>
          <small className="media-library-mode">
            {mediaStorageMode === "api" ? "Connected to website media storage" : "Browser fallback storage only"}
          </small>
        </div>
        <button className="ghost-button" type="button" onClick={() => uploadInputRef.current?.click()}>
          <Upload size={17} />
          <span>Upload</span>
        </button>
      </div>

      <div className="media-library-layout">
        <div className="media-grid">
          {mediaItems.map((media) => (
            <button
              type="button"
              className={selectedMediaId === media.id ? "media-card active" : "media-card"}
              key={media.id}
              onClick={() => {
                setSelectedMediaId(media.id);
                onSelect(media.path);
              }}
            >
              <img src={media.path} alt="" />
              <span>{media.type}</span>
              <strong>{media.title}</strong>
              <small>{media.size || media.dimensions}</small>
            </button>
          ))}
        </div>
        <aside className="media-details-card">
          {selectedMedia ? (
            <>
              <img src={selectedMedia.path} alt={selectedMedia.title} />
              <div className="media-details-copy">
                <span className="eyebrow">Image Information</span>
                <h3>{selectedMedia.title}</h3>
                <dl className="standalone-media-meta-list">
                  <div>
                    <dt>Upload date</dt>
                    <dd>{selectedMedia.uploadedAt || "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Name</dt>
                    <dd>{selectedMedia.title}</dd>
                  </div>
                  <div>
                    <dt>Size</dt>
                    <dd>{selectedMedia.size || "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Dimensions</dt>
                    <dd>{selectedMedia.dimensions || "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>URL</dt>
                    <dd className="url" title={selectedMedia.path}>
                      {shortenMediaUrl(selectedMedia.path) || "Unknown"}
                    </dd>
                  </div>
                </dl>
                <div className="standalone-media-sidebar-actions">
                  <button className="ghost-button" type="button" onClick={() => onCopyUrl(selectedMedia.path)}>
                    <Copy size={16} />
                    <span>Copy URL</span>
                  </button>
                  <button className="danger-button" type="button" onClick={() => onDeleteMedia(selectedMedia.id)}>
                    <Trash2 size={16} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="standalone-media-picker-empty sidebar">
              <strong>No media selected</strong>
              <span>Select any asset to review its stored details.</span>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
