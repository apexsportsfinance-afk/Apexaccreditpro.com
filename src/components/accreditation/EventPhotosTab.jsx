import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, Image as ImageIcon, Trash2, Eye, EyeOff, Loader2, FolderPlus, Tag, Save } from 'lucide-react';
import { PhotoAPI } from '../../lib/photoApi';
import { GlobalSettingsAPI } from '../../lib/broadcastApi';
import { compressImage, generateThumbnail } from '../../lib/imageCompression';
import { useAuth } from '../../contexts/AuthContext';
import Card, { CardHeader, CardContent } from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import StorageImage from '../ui/StorageImage';
import { cn } from '../../lib/utils';

// Lazy-loaded: FaceMatchingManager statically imports the heavy face-api.js
// (~hundreds of KB). Deferring it keeps face-api out of the QRSystem route chunk
// — it loads only when the gallery actually has photos and this UI mounts.
const FaceMatchingManager = lazy(() => import('./FaceMatchingManager'));

const galleryVisibilityKey = (eventId) => `event_${eventId}_gallery_enabled`;
const galleryCaptionKey = (eventId) => `event_${eventId}_gallery_caption`;

export default function EventPhotosTab({ eventId, onToast, disabled }) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [albums, setAlbums] = useState(['General Event Photos', 'Opening Ceremony', 'Competition', 'Awards', 'VIP']);
  const [selectedAlbum, setSelectedAlbum] = useState('General Event Photos');
  const [newAlbumName, setNewAlbumName] = useState('');
  const fileInputRef = useRef(null);

  // Whole-section visibility on the public QR Profile - mirrors the Live
  // Scores "Enabled/Disabled" toggle. Absent setting defaults to enabled so
  // events that predate this control keep showing their gallery as before.
  const [galleryEnabled, setGalleryEnabled] = useState(true);
  const [galleryCaption, setGalleryCaption] = useState('');
  const [savingVisibility, setSavingVisibility] = useState(false);

  useEffect(() => {
    loadPhotos();
    GlobalSettingsAPI.get(galleryVisibilityKey(eventId))
      .then(v => setGalleryEnabled(v === null || v === undefined ? true : v !== 'false'))
      .catch(() => setGalleryEnabled(true));
    GlobalSettingsAPI.get(galleryCaptionKey(eventId))
      .then(v => setGalleryCaption(v || ''))
      .catch(() => setGalleryCaption(''));
  }, [eventId]);

  const handleSaveVisibility = async () => {
    if (disabled) return;
    setSavingVisibility(true);
    try {
      await GlobalSettingsAPI.set(galleryVisibilityKey(eventId), String(galleryEnabled));
      await GlobalSettingsAPI.set(galleryCaptionKey(eventId), galleryCaption || '');
      onToast("Gallery settings saved!", "success");
    } catch (err) {
      onToast("Failed to save gallery settings", "error");
    } finally {
      setSavingVisibility(false);
    }
  };

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const data = await PhotoAPI.getPhotosByEvent(eventId);
      setPhotos(data || []);
      
      // Extract dynamic albums
      if (data && data.length > 0) {
        const uniqueAlbums = [...new Set(data.map(p => p.album_name).filter(Boolean))];
        const merged = [...new Set([...albums, ...uniqueAlbums])];
        setAlbums(merged);
      }
    } catch (err) {
      console.error("Failed to load photos:", err);
      // Suppress error toast if it's just the table not existing yet during local testing
      if (err.code !== '42P01') {
        onToast("Failed to load photos. Did you run the SQL script?", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (files.length > 50) {
      onToast("Maximum 50 photos per upload batch", "warning");
      return;
    }

    setUploading(true);
    try {
      onToast(`Compressing and uploading ${files.length} photos...`, "info");
      
      const compressedFiles = [];
      const thumbnailFiles = [];
      
      for (const file of files) {
        // High-res compressed version
        const highRes = await compressImage(file, 1920, 1080, 0.85);
        compressedFiles.push(highRes);
        
        // Thumbnail version
        const thumb = await generateThumbnail(file, 600, 0.7);
        thumbnailFiles.push(thumb);
      }

      // Upload High-res
      const uploadedHighRes = await PhotoAPI.uploadPhotosToLocal(compressedFiles);
      // Upload Thumbnails
      const uploadedThumbs = await PhotoAPI.uploadPhotosToLocal(thumbnailFiles);

      // Save to Supabase
      const insertPromises = uploadedHighRes.map((highResItem, index) => {
        const thumbItem = uploadedThumbs[index];
        return PhotoAPI.savePhotoRecord({
          event_id: eventId,
          album_name: selectedAlbum,
          title: highResItem.originalName.split('.')[0] || 'Photo',
          url: highResItem.url,
          thumbnail_url: thumbItem.url,
          size_bytes: compressedFiles[index].size,
          is_public: true,
          uploaded_by: user?.id
        });
      });

      await Promise.all(insertPromises);
      onToast("Photos uploaded successfully", "success");
      await loadPhotos();
    } catch (err) {
      console.error("Upload error:", err);
      onToast(`Failed to upload photos: ${err.message}`, "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleVisibility = async (photo) => {
    try {
      await PhotoAPI.updatePhotoVisibility(photo.id, !photo.is_public);
      setPhotos(photos.map(p => p.id === photo.id ? { ...p, is_public: !photo.is_public } : p));
    } catch (err) {
      onToast("Failed to update visibility", "error");
    }
  };

  const deletePhoto = async (id) => {
    if (!window.confirm("Are you sure you want to delete this photo?")) return;
    try {
      await PhotoAPI.deletePhotoRecord(id);
      setPhotos(photos.filter(p => p.id !== id));
      onToast("Photo deleted", "success");
    } catch (err) {
      onToast("Failed to delete photo", "error");
    }
  };

  const handleAddAlbum = () => {
    if (newAlbumName && !albums.includes(newAlbumName)) {
      setAlbums([...albums, newAlbumName]);
      setSelectedAlbum(newAlbumName);
      setNewAlbumName('');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-gray-800 bg-gray-900/50">
        <CardContent className="py-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Event Photos Feature</h3>
              <p className="text-sm text-gray-400">Enable or disable the Event Photos gallery tab on the public QR Profile.</p>
            </div>
            <div className="flex items-center gap-4">
              <label className={cn("flex items-center gap-3 group", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={galleryEnabled}
                    onChange={(e) => setGalleryEnabled(e.target.checked)}
                    disabled={disabled}
                    className="sr-only peer"
                  />
                  <div className={cn(
                    "w-11 h-6 bg-gray-800 border border-white/10 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white",
                    !disabled && "group-hover:border-white/20"
                  )} />
                </div>
                <span className={cn("text-sm font-bold text-white uppercase tracking-widest", !disabled && "group-hover:text-emerald-400")}>
                  {galleryEnabled ? "Enabled" : "Disabled"}
                </span>
              </label>
              <Button onClick={handleSaveVisibility} disabled={disabled} loading={savingVisibility} variant="primary">
                <Save className="w-4 h-4 mr-2" /> Save
              </Button>
            </div>
          </div>

          {/* Gallery message — shown to athletes above their photos (e.g. a social tag prompt) */}
          <div className="border-t border-gray-800 pt-5">
            <label className="text-sm font-bold text-white flex items-center gap-2">
              <Tag className="w-4 h-4 text-purple-400" /> Gallery Message <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <p className="text-xs text-gray-400 mt-1 mb-2">
              Appears above the photos on the athlete's QR profile — great for a social-tag prompt. Leave blank to hide. Saved with the button above.
            </p>
            <textarea
              value={galleryCaption}
              onChange={(e) => setGalleryCaption(e.target.value)}
              placeholder="📸 Loved your photos? Tag us @apexsports & @hamdansportscomplex!"
              rows={2}
              maxLength={200}
              disabled={disabled}
              className="w-full rounded-lg border border-gray-700 bg-gray-800/50 text-white text-sm px-4 py-2.5 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 resize-none disabled:opacity-50"
            />
            <p className="text-[11px] text-gray-500 mt-1 text-right">{galleryCaption.length}/200</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-800 bg-gray-900/50">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-blue-400" /> Event Gallery Manager
            </h3>
            <p className="text-sm text-gray-400">Upload and manage photos for this event. Max 50 photos per batch.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Section */}
        <div className="p-6 border border-dashed border-gray-700 rounded-xl bg-gray-800/30">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="flex-1 space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Select
                    label="Upload to Album"
                    value={selectedAlbum}
                    onChange={(e) => setSelectedAlbum(e.target.value)}
                    options={albums.map(a => ({ value: a, label: a }))}
                    disabled={disabled || uploading}
                  />
                </div>
                <div className="flex-1 flex gap-2">
                  <Input
                    placeholder="New Album Name..."
                    value={newAlbumName}
                    onChange={(e) => setNewAlbumName(e.target.value)}
                    disabled={disabled || uploading}
                  />
                  <Button variant="secondary" onClick={handleAddAlbum} disabled={!newAlbumName || disabled || uploading}>
                    <FolderPlus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/jpeg, image/png, image/webp"
                className="hidden"
                onChange={handleFileUpload}
                disabled={disabled || uploading}
              />
              <Button 
                size="lg" 
                onClick={() => fileInputRef.current?.click()} 
                disabled={disabled || uploading}
                className="w-full md:w-auto"
              >
                {uploading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...</>
                ) : (
                  <><UploadCloud className="w-5 h-5 mr-2" /> Select Photos</>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Face Matching Manager */}
        {photos.length > 0 && !disabled && (
          <Suspense fallback={<div className="flex justify-center p-6"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>}>
            <FaceMatchingManager
              eventId={eventId}
              galleryPhotos={photos.filter(p => p.is_public)}
              onToast={onToast}
            />
          </Suspense>
        )}

        {/* Gallery Section */}
        <div>
          <h4 className="text-white font-medium mb-4 flex justify-between items-center">
            Uploaded Photos ({photos.length})
          </h4>
          
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
          ) : photos.length === 0 ? (
            <div className="text-center p-12 border border-gray-800 rounded-xl bg-gray-900/50">
              <ImageIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No photos uploaded for this event yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <AnimatePresence>
                {photos.map(photo => (
                  <motion.div
                    key={photo.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`group relative rounded-xl overflow-hidden aspect-square border ${photo.is_public ? 'border-gray-700' : 'border-red-900/50 opacity-60'}`}
                  >
                    <StorageImage
                      src={photo.thumbnail_url || photo.url}
                      alt={photo.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    
                    {/* Overlay controls */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                      <div className="flex justify-between items-start">
                        <Badge variant={photo.is_public ? "success" : "danger"} className="text-[10px] py-0">
                          {photo.is_public ? 'Public' : 'Hidden'}
                        </Badge>
                        <button 
                          onClick={() => toggleVisibility(photo)}
                          className="p-1.5 bg-gray-800/80 rounded-lg hover:bg-gray-700 text-white"
                          title={photo.is_public ? "Hide from QR Profile" : "Show in QR Profile"}
                          disabled={disabled}
                        >
                          {photo.is_public ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </div>
                      
                      <div className="flex justify-between items-end">
                        <div className="text-xs text-white truncate pr-2" title={photo.album_name}>
                          <Tag className="w-3 h-3 inline mr-1" />{photo.album_name}
                        </div>
                        <button 
                          onClick={() => deletePhoto(photo.id)}
                          className="p-1.5 bg-red-500/80 rounded-lg hover:bg-red-600 text-white"
                          title="Delete photo"
                          disabled={disabled}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </CardContent>
      </Card>
    </div>
  );
}
