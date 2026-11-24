// Saves uploaded images. Uses Cloudinary when its keys are set in .env,
// otherwise saves the file into server/uploads and serves it from /uploads.
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const cloudinary = require('cloudinary').v2;

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };

function cloudinaryEnabled() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  );
}

// Returns the address the image can be loaded from.
async function saveImage(buffer, mimetype, folder) {
  if (cloudinaryEnabled()) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `quickchat/${folder}`, resource_type: 'image' },
        (error, res) => (error ? reject(error) : resolve(res))
      );
      stream.end(buffer);
    });
    return result.secure_url;
  }

  const dir = path.join(UPLOAD_DIR, folder);
  await fs.mkdir(dir, { recursive: true });
  const name = `${crypto.randomUUID()}.${EXTENSIONS[mimetype] || 'bin'}`;
  await fs.writeFile(path.join(dir, name), buffer);
  return `/uploads/${folder}/${name}`;
}

// Saves any file (chat attachments). Keeps the original name for the download link.
// Returns { url, name }.
async function saveFile(buffer, originalName, folder) {
  const safeName = path.basename(originalName || 'file').replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'file';
  if (cloudinaryEnabled()) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `quickchat/${folder}`, resource_type: 'auto', use_filename: true },
        (error, res) => (error ? reject(error) : resolve(res))
      );
      stream.end(buffer);
    });
    return { url: result.secure_url, name: safeName };
  }

  const dir = path.join(UPLOAD_DIR, folder);
  await fs.mkdir(dir, { recursive: true });
  const stored = `${crypto.randomUUID()}-${safeName}`;
  await fs.writeFile(path.join(dir, stored), buffer);
  return { url: `/uploads/${folder}/${stored}`, name: safeName };
}

module.exports = { saveImage, saveFile, UPLOAD_DIR };
