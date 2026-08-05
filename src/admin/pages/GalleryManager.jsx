// src/admin/pages/GalleryManager.jsx
//
// Admin page for posting photos/videos with a caption to the public
// Gallery page, and for editing or deleting posts already made. Uploads
// the file(s) to Firebase Storage (`gallery/`) and writes ONE doc to
// Firestore `gallery` collection per "post" — even when several
// photos/videos are selected at once. That single doc carries a
// `mediaItems` array (each entry: { url, mediaType, storagePath }), so
// a multi-select upload shows up as ONE Facebook-style post with all
// its photos/videos grouped together, instead of several separate
// posts. The doc also carries the shared caption, likeCount, likedBy[],
// and comments[] — the same shape the public Gallery.jsx reads and
// lets visitors like/comment/share.
//
// Each post is also tagged with the school that made it: schoolCode is
// read from the logged-in admin's dashboard context, and schoolName /
// schoolLogoUrl are resolved from `schools/{schoolCode}` ONCE, at
// upload time, and stored directly on the gallery doc. This means the
// public Gallery page never has to look the school up again at render
// time, and posts keep showing the school exactly as it was when
// posted, even if that school's name/logo changes later.
//
// SCOPING: this admin page only ever loads/edits/deletes gallery posts
// that belong to the logged-in admin's own school (filtered by
// schoolCode). This is separate from the public Gallery.jsx, which is
// meant to show every school's posts together for visitors — that page
// is untouched.
//
// MULTI-UPLOAD: admins can select several photos/videos in one go. All
// selected files are uploaded and bundled into a SINGLE gallery doc
// (one post, many media items) sharing one caption, one likeCount,
// one likedBy[], and one comments[] — exactly like a Facebook post
// with multiple photos.
//
// BACKWARDS COMPATIBILITY: older posts created before this change may
// still have the old single-media shape (`mediaUrl` + `mediaType` at
// the top level, no `mediaItems` array). getItemMedia() below normalizes
// both shapes into a single `mediaItems` array so the rest of this file
// (and the edit modal) can treat every post the same way.

import { useEffect, useState } from "react";
import { db, storage } from "../../firebase/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Image as ImageIcon, Upload, Trash2, Heart, MessageCircle, Pencil, X, Save } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { getSchoolCode } from "../../utils/schoolContext";

function formatDate(ts) {
  if (!ts?.seconds) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Normalizes any gallery doc (old single-media shape OR new
// mediaItems[] shape) into a flat array of { url, mediaType, storagePath }.
// Lets every part of this file treat old and new posts identically.
function getItemMedia(item) {
  if (Array.isArray(item.mediaItems) && item.mediaItems.length > 0) {
    return item.mediaItems;
  }
  if (item.mediaUrl) {
    return [
      {
        url: item.mediaUrl,
        mediaType: item.mediaType || "image",
        storagePath: item.storagePath || "",
      },
    ];
  }
  return [];
}

export default function GalleryManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // ---- Multi-file selection state ----
  // Each entry: { file, mediaType, previewUrl }
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });

  const [confirmDelete, setConfirmDelete] = useState(null);

  // ---- Edit modal state ----
  const [editTarget, setEditTarget] = useState(null); // the gallery item being edited
  const [editCaption, setEditCaption] = useState("");
  // Media inside the edit modal is managed as a list so admins can
  // remove existing items and/or add new files, same mental model as
  // the main upload picker.
  // Each entry: { kind: "existing", url, mediaType, storagePath }
  //          or { kind: "new", file, mediaType, previewUrl }
  const [editMediaList, setEditMediaList] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const schoolCode = getSchoolCode();

    // Only load gallery posts that belong to this admin's own school.
    // Without this filter every school's admin would see (and could
    // edit/delete) every other school's posts here.
    const q = query(
      collection(db, "gallery"),
      where("schoolCode", "==", schoolCode || "__none__"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Handles selecting one or more files at once. Appends to whatever is
  // already staged, so admins can add files across multiple picks too.
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const next = files.map((f) => ({
      file: f,
      mediaType: f.type.startsWith("video") ? "video" : "image",
      previewUrl: URL.createObjectURL(f),
    }));

    setSelectedFiles((prev) => [...prev, ...next]);
    // Allow re-selecting the same file(s) again later.
    e.target.value = "";
  };

  const removeSelectedFile = (idx) => {
    setSelectedFiles((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return copy;
    });
  };

  // Looks up the real school name + logo for the given schoolCode from
  // the `schools` collection. Called once at post time so the gallery
  // doc carries its own snapshot of who posted it.
  async function resolveSchoolInfo(schoolCode) {
    let schoolName = "";
    let schoolLogoUrl = "";

    if (!schoolCode) {
      return { schoolName, schoolLogoUrl };
    }

    try {
      const schoolSnap = await getDoc(doc(db, "schools", schoolCode));
      if (schoolSnap.exists()) {
        const sData = schoolSnap.data();
        schoolName = sData.schoolName || sData.name || "";
        schoolLogoUrl = sData.logoUrl || "";
      }
    } catch (err) {
      console.error("Failed to load school info for gallery post:", err);
    }

    return { schoolName, schoolLogoUrl };
  }

  // Uploads every selected file to Storage and returns the array of
  // { url, mediaType, storagePath } entries to store on the gallery doc.
  async function uploadAllSelectedFiles() {
    const uploaded = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const { file, mediaType } = selectedFiles[i];

      const fileRef = ref(storage, `gallery/${Date.now()}_${i}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      uploaded.push({ url, mediaType, storagePath: fileRef.fullPath });
      setUploadProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    return uploaded;
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert("Fadlan dooro sawir ama muuqaal (waxaad dooran kartaa dhowr sawir/muuqaal).");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress({ done: 0, total: selectedFiles.length });

      // Resolved once and reused for this post — same school posting
      // all of these files together.
      const schoolCode = getSchoolCode();
      const { schoolName, schoolLogoUrl } = await resolveSchoolInfo(schoolCode);

      const trimmedCaption = caption.trim();

      // Upload every file first, then write ONE doc containing all of
      // them as mediaItems — this is what makes a multi-select upload
      // render as a single Facebook-style post instead of many.
      const mediaItems = await uploadAllSelectedFiles();

      const docId = `${Date.now()}`;
      await setDoc(doc(db, "gallery", docId), {
        mediaItems,
        caption: trimmedCaption,
        schoolCode: schoolCode || "",
        schoolName,
        schoolLogoUrl,
        likeCount: 0,
        likedBy: [],
        comments: [],
        createdAt: serverTimestamp(),
      });

      selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      setSelectedFiles([]);
      setCaption("");
      alert("Waa la daabacay!");
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay: " + err.message);
    } finally {
      setUploading(false);
      setUploadProgress({ done: 0, total: 0 });
    }
  };

  const handleDelete = async (item) => {
    try {
      const mediaList = getItemMedia(item);
      // Best-effort cleanup of every file in this post — a missing file
      // (already deleted from Storage) is fine, we just move on.
      for (const m of mediaList) {
        if (!m.storagePath) continue;
        try {
          await deleteObject(ref(storage, m.storagePath));
        } catch (e) {
          // File may already be gone from storage — continue removing the doc.
        }
      }
      await deleteDoc(doc(db, "gallery", item.id));
      setConfirmDelete(null);
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay marka la tirtirayay: " + err.message);
    }
  };

  // ---- Fur modal-ka wax-ka-bedelka post-ga ----
  function openEdit(item) {
    setEditTarget(item);
    setEditCaption(item.caption || "");
    setEditMediaList(
      getItemMedia(item).map((m) => ({
        kind: "existing",
        url: m.url,
        mediaType: m.mediaType || "image",
        storagePath: m.storagePath || "",
      }))
    );
  }

  function closeEdit() {
    // Release object URLs for any newly-added (not-yet-saved) files.
    editMediaList.forEach((m) => {
      if (m.kind === "new" && m.previewUrl) URL.revokeObjectURL(m.previewUrl);
    });
    setEditTarget(null);
    setEditCaption("");
    setEditMediaList([]);
  }

  // Adds more files to the post being edited (on top of whatever
  // existing media is still kept).
  function handleEditFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const next = files.map((f) => ({
      kind: "new",
      file: f,
      mediaType: f.type.startsWith("video") ? "video" : "image",
      previewUrl: URL.createObjectURL(f),
    }));

    setEditMediaList((prev) => [...prev, ...next]);
    e.target.value = "";
  }

  // Removes one media item from the post being edited. If it was an
  // existing (already-saved) item, its Storage file is deleted when
  // the edit is saved. If it was a newly-added file, we just drop it
  // from the list — nothing was uploaded yet.
  function removeEditMediaItem(idx) {
    setEditMediaList((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      if (removed?.kind === "new" && removed.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return copy;
    });
  }

  // ---- Kaydi wax-ka-bedelka post-ga: qoraalka marwalba, iyo liiska
  // sawirada/muuqaallada (kuwa la haystay + kuwa cusub oo la soo daray).
  // Kuwa laga saaray liiska (existing items removed) waa laga tirtiraa
  // Storage-ka. schoolName/schoolLogoUrl looma taabto edit-ka — waxay
  // sii ahaadaan sida ay ahaayeen markii post-ka la sameeyay. ----
  async function saveEdit() {
    if (!editTarget) return;

    if (editMediaList.length === 0) {
      alert("Post-ku waa inuu yeeshaa ugu yaraan hal sawir ama muuqaal.");
      return;
    }

    try {
      setSavingEdit(true);

      // Figure out which originally-saved items were removed by the
      // admin in this edit, so we can clean them up from Storage.
      const originalMedia = getItemMedia(editTarget);
      const keptStoragePaths = new Set(
        editMediaList
          .filter((m) => m.kind === "existing")
          .map((m) => m.storagePath)
      );
      const removedMedia = originalMedia.filter(
        (m) => m.storagePath && !keptStoragePaths.has(m.storagePath)
      );

      // Upload any newly-added files.
      const uploadedNew = [];
      for (const m of editMediaList) {
        if (m.kind !== "new") continue;
        const newFileRef = ref(storage, `gallery/${Date.now()}_${m.file.name}`);
        await uploadBytes(newFileRef, m.file);
        const url = await getDownloadURL(newFileRef);
        uploadedNew.push({ url, mediaType: m.mediaType, storagePath: newFileRef.fullPath });
      }

      // Final media array, in the same order shown in the modal.
      let uploadedIdx = 0;
      const finalMediaItems = editMediaList.map((m) => {
        if (m.kind === "existing") {
          return { url: m.url, mediaType: m.mediaType, storagePath: m.storagePath };
        }
        return uploadedNew[uploadedIdx++];
      });

      const updatedFields = {
        caption: editCaption.trim(),
        mediaItems: finalMediaItems,
      };

      // Clear the legacy single-media fields so old and new shapes
      // never both exist on the same doc after an edit.
      if (editTarget.mediaUrl !== undefined) {
        updatedFields.mediaUrl = null;
        updatedFields.mediaType = null;
        updatedFields.storagePath = null;
      }

      await updateDoc(doc(db, "gallery", editTarget.id), updatedFields);

      // Now that the doc write succeeded, clean up removed files.
      for (const m of removedMedia) {
        try {
          await deleteObject(ref(storage, m.storagePath));
        } catch (e) {
          // Old file may already be gone — ignore.
        }
      }

      setItems((prev) =>
        prev.map((it) => (it.id === editTarget.id ? { ...it, ...updatedFields } : it))
      );

      alert("Post-ka waa la cusboonaysiiyay.");
      closeEdit();
    } catch (err) {
      console.error(err);
      alert("Khalad ayaa dhacay markii la kaydinayay: " + err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0a1c" }}>
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar title="Gallery" />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 14,
                background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ImageIcon color="#fff" size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff" }}>
                Gallery Manager
              </h1>
              <p style={{ margin: "3px 0 0", color: "#8b87ad", fontSize: 13 }}>
                Soo dhig sawiro iyo muuqaallo — waxay isla markiiba ka muuqan doonaan bogga Gallery-ga
              </p>
            </div>
          </div>

          {/* Upload card */}
          <div
            style={{
              background: "linear-gradient(160deg,#151233,#181341)",
              borderRadius: 20,
              padding: 26,
              border: "1px solid rgba(139,108,245,0.25)",
              marginBottom: 30,
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <div style={{ width: 220, minWidth: 220, display: "flex", flexDirection: "column", gap: 10 }}>
              <label
                htmlFor="galleryFile"
                style={{
                  width: "100%",
                  aspectRatio: "4/3",
                  borderRadius: 16,
                  border: "2px dashed rgba(139,108,245,0.4)",
                  background: "rgba(139,108,245,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <Upload size={28} color="#8b6cf5" />
                <span style={{ color: "#8b87ad", fontSize: 12, marginTop: 8, textAlign: "center", padding: "0 10px" }}>
                  Riix si aad u soo doorato sawiro/muuqaallo badan
                </span>
              </label>
              <input
                id="galleryFile"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              {selectedFiles.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 6,
                  }}
                >
                  {selectedFiles.map((f, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: "relative",
                        aspectRatio: "1/1",
                        borderRadius: 8,
                        overflow: "hidden",
                        background: "#000",
                      }}
                    >
                      {f.mediaType === "video" ? (
                        <video src={f.previewUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                      ) : (
                        <img src={f.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      )}
                      <button
                        onClick={() => removeSelectedFile(idx)}
                        style={{
                          position: "absolute",
                          top: 2,
                          right: 2,
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          border: "none",
                          background: "rgba(0,0,0,0.7)",
                          color: "#fff",
                          fontSize: 11,
                          lineHeight: "18px",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {selectedFiles.length > 0 && (
                <span style={{ color: "#8b87ad", fontSize: 11.5 }}>
                  {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} la doortay — waxay wada noqon doonaan hal post
                </span>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ color: "#a9a6c4", fontSize: 12.5, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Faallo (Caption) — waxay wada dhaqmaysaa dhammaan sawirada/muuqaallada aad soo dooratay
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={4}
                  placeholder="Qor faallo ku saabsan sawirka ama muuqaalka..."
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1.5px solid rgba(139,108,245,0.3)",
                    background: "rgba(255,255,255,0.02)",
                    color: "#e5e3f7",
                    fontSize: 13.5,
                    resize: "vertical",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <button
                onClick={handleUpload}
                disabled={uploading}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  justifyContent: "center",
                  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  padding: "13px 24px",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: uploading ? "not-allowed" : "pointer",
                  opacity: uploading ? 0.7 : 1,
                  alignSelf: "flex-start",
                }}
              >
                <Upload size={16} />
                {uploading
                  ? `Soo dhigaya... (${uploadProgress.done}/${uploadProgress.total})`
                  : selectedFiles.length > 1
                  ? `Post ${selectedFiles.length} Files as One Post`
                  : "Post to Gallery"}
              </button>
            </div>
          </div>

          {/* Posted items grid */}
          {loading ? (
            <p style={{ color: "#8b87ad" }}>Loading...</p>
          ) : items.length === 0 ? (
            <p style={{ color: "#8b87ad" }}>Weli wax lama soo dhigin.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 18,
              }}
            >
              {items.map((item) => {
                const mediaList = getItemMedia(item);
                const cover = mediaList[0];
                const extraCount = mediaList.length - 1;

                return (
                  <div
                    key={item.id}
                    style={{
                      background: "linear-gradient(160deg,#1c1840,#211c48)",
                      borderRadius: 16,
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div style={{ width: "100%", aspectRatio: "4/3", background: "#000", position: "relative" }}>
                      {cover?.mediaType === "video" ? (
                        <video src={cover.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                      ) : cover ? (
                        <img src={cover.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : null}

                      {extraCount > 0 && (
                        <span
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            background: "rgba(0,0,0,0.7)",
                            color: "#fff",
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: "4px 9px",
                            borderRadius: 20,
                          }}
                        >
                          +{extraCount} more
                        </span>
                      )}
                    </div>

                    <div style={{ padding: 14 }}>
                      <p
                        style={{
                          color: "#e5e3f7",
                          fontSize: 12.5,
                          margin: "0 0 10px",
                          minHeight: 18,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {item.caption || "—"}
                      </p>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: 11.5,
                          color: "#8b87ad",
                          marginBottom: 10,
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Heart size={12} /> {item.likeCount || 0}
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <MessageCircle size={12} /> {(item.comments || []).length}
                        </span>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>

                      <div style={{ display: "flex", gap: 6, marginBottom: confirmDelete === item.id ? 6 : 0 }}>
                        <button
                          onClick={() => openEdit(item)}
                          style={{
                            flex: 1,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            border: "1px solid rgba(139,108,245,0.35)",
                            background: "rgba(139,108,245,0.12)",
                            color: "#c4b5fd",
                            fontWeight: 700,
                            fontSize: 11.5,
                            padding: "7px 0",
                            borderRadius: 8,
                            cursor: "pointer",
                          }}
                        >
                          <Pencil size={12} />
                          Edit
                        </button>

                        {confirmDelete === item.id ? (
                          <div style={{ display: "flex", gap: 6, flex: 1 }}>
                            <button
                              onClick={() => handleDelete(item)}
                              style={{
                                flex: 1,
                                border: "none",
                                background: "#ef4444",
                                color: "#fff",
                                fontWeight: 700,
                                fontSize: 11.5,
                                padding: "7px 0",
                                borderRadius: 8,
                                cursor: "pointer",
                              }}
                            >
                              Xaqiiji
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              style={{
                                flex: 1,
                                border: "1px solid rgba(255,255,255,0.15)",
                                background: "transparent",
                                color: "#a9a6c4",
                                fontWeight: 700,
                                fontSize: 11.5,
                                padding: "7px 0",
                                borderRadius: 8,
                                cursor: "pointer",
                              }}
                            >
                              Jooji
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(item.id)}
                            style={{
                              flex: 1,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              border: "1px solid rgba(239,68,68,0.3)",
                              background: "rgba(239,68,68,0.12)",
                              color: "#f87171",
                              fontWeight: 700,
                              fontSize: 11.5,
                              padding: "7px 0",
                              borderRadius: 8,
                              cursor: "pointer",
                            }}
                          >
                            <Trash2 size={12} />
                            Tirtir
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ---- Edit modal ---- */}
      {editTarget && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "linear-gradient(160deg,#151233,#181341)",
              border: "1px solid rgba(139,108,245,0.3)",
              borderRadius: 20,
              width: "100%",
              maxWidth: 560,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 24px",
                borderBottom: "1px solid rgba(139,108,245,0.2)",
              }}
            >
              <h2 style={{ color: "#fff", margin: 0, fontSize: 18 }}>Wax ka bedel Post-ka</h2>
              <button
                onClick={closeEdit}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "none",
                  color: "#fff",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "22px 24px" }}>
              <label
                style={{
                  color: "#a9a6c4",
                  fontSize: 12.5,
                  fontWeight: 700,
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Sawirada/Muuqaallada Post-kan ({editMediaList.length})
              </label>

              {editMediaList.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  {editMediaList.map((m, idx) => {
                    const src = m.kind === "existing" ? m.url : m.previewUrl;
                    return (
                      <div
                        key={idx}
                        style={{
                          position: "relative",
                          aspectRatio: "1/1",
                          borderRadius: 10,
                          overflow: "hidden",
                          background: "#000",
                        }}
                      >
                        {m.mediaType === "video" ? (
                          <video src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                        ) : (
                          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )}
                        <button
                          onClick={() => removeEditMediaItem(idx)}
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            border: "none",
                            background: "rgba(0,0,0,0.7)",
                            color: "#fff",
                            fontSize: 12,
                            lineHeight: "20px",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <label
                htmlFor="editGalleryFile"
                style={{
                  display: "flex",
                  width: "100%",
                  padding: "14px",
                  borderRadius: 12,
                  border: "2px dashed rgba(139,108,245,0.4)",
                  background: "rgba(139,108,245,0.06)",
                  flexDirection: "row",
                  gap: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  marginBottom: 18,
                }}
              >
                <Upload size={18} color="#8b6cf5" />
                <span style={{ color: "#8b87ad", fontSize: 12.5 }}>
                  Ku dar sawiro/muuqaallo cusub
                </span>
              </label>
              <input
                id="editGalleryFile"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleEditFileChange}
                style={{ display: "none" }}
              />

              <label
                style={{
                  color: "#a9a6c4",
                  fontSize: 12.5,
                  fontWeight: 700,
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Faallo (Caption)
              </label>
              <textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                rows={4}
                placeholder="Qor faallo ku saabsan sawirka ama muuqaalka..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1.5px solid rgba(139,108,245,0.3)",
                  background: "rgba(255,255,255,0.02)",
                  color: "#e5e3f7",
                  fontSize: 13.5,
                  resize: "vertical",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
                padding: "16px 24px",
                borderTop: "1px solid rgba(139,108,245,0.2)",
              }}
            >
              <button
                onClick={closeEdit}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1.5px solid rgba(139,108,245,0.3)",
                  color: "#fff",
                  padding: "11px 20px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13.5,
                }}
              >
                Iska daa
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "linear-gradient(90deg,#6d5df0,#8b6cf5)",
                  color: "#fff",
                  border: "none",
                  padding: "11px 20px",
                  borderRadius: 10,
                  cursor: savingEdit ? "not-allowed" : "pointer",
                  opacity: savingEdit ? 0.7 : 1,
                  fontWeight: 700,
                  fontSize: 13.5,
                }}
              >
                <Save size={15} />
                {savingEdit ? "Kaydinaya..." : "Kaydi Isbedelka"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}