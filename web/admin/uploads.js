export async function uploadFile(file) {
  const types = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    mp4: "video/mp4",
    webm: "video/webm",
  };
  const mime = types[file.name.split(".").pop().toLowerCase()];
  if (!mime) throw new Error("Use JPG, PNG, WEBP, MP4 ou WEBM.");
  if (file.size > (mime.startsWith("video") ? 100 : 10) * 1024 * 1024)
    throw new Error("Limite: 10 MB por imagem e 100 MB por vídeo.");
  const response = await fetch("/api/media", {
    method: "POST",
    headers: {
      "Content-Type": mime,
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
