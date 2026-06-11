import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, X, ChevronDown, ChevronUp, Loader2, ChevronLeft, ChevronRight, ScanFace } from 'lucide-react';
import { PhotoAPI } from '../../lib/photoApi';
import { cn } from '../../lib/utils';

export default function QRProfileGallery({ eventId, matchedPhotoIds = [] }) {
  const [photos, setPhotos] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [activeAlbum, setActiveAlbum] = useState('All');
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [touchStart, setTouchStart] = useState(null);

  const filteredPhotos = activeAlbum === 'All' 
    ? photos 
    : activeAlbum === 'My Photos'
      ? photos.filter(p => matchedPhotoIds.includes(p.id))
      : photos.filter(p => p.album_name === activeAlbum);

  const currentPhotoIndex = selectedPhoto ? filteredPhotos.findIndex(p => p.id === selectedPhoto.id) : -1;

  const handleNext = (e) => {
    e?.stopPropagation();
    if (currentPhotoIndex !== -1 && currentPhotoIndex < filteredPhotos.length - 1) {
      setSelectedPhoto(filteredPhotos[currentPhotoIndex + 1]);
    }
  };

  const handlePrev = (e) => {
    e?.stopPropagation();
    if (currentPhotoIndex > 0) {
      setSelectedPhoto(filteredPhotos[currentPhotoIndex - 1]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedPhoto) return;
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') setSelectedPhoto(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhoto, filteredPhotos]);

  const handleTouchStart = (e) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchEnd = (e) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    if (diff > 50) handleNext();
    if (diff < -50) handlePrev();
    setTouchStart(null);
  };

  useEffect(() => {
    if (eventId && isExpanded && !hasLoaded) {
      loadPhotos();
    }
  }, [eventId, isExpanded, hasLoaded]);

  const loadPhotos = async () => {
    if (hasLoaded) return;
    try {
      setLoading(true);
      // Fetch only public photos
      const data = await PhotoAPI.getPhotosByEvent(eventId, true);
      setPhotos(data || []);
      
      if (data && data.length > 0) {
        const uniqueAlbums = [...new Set(data.map(p => p.album_name).filter(Boolean))];
        
        // Add My Photos tab if matches exist
        const defaultAlbums = ['All'];
        if (matchedPhotoIds && matchedPhotoIds.length > 0) {
          defaultAlbums.push('My Photos');
        }
        
        setAlbums([...defaultAlbums, ...uniqueAlbums]);
        
        // Auto-select My Photos if it exists
        if (matchedPhotoIds && matchedPhotoIds.length > 0) {
          setActiveAlbum('My Photos');
        }
        
        setHasLoaded(true);
      }
    } catch (err) {
      console.error("Failed to load public photos:", err);
    } finally {
      setLoading(false);
    }
  };

  if (hasLoaded && !loading && photos.length === 0) {
    return null; // Don't show the gallery section at all if there are no public photos
  }

  return (
    <div className="w-full mb-6">
      <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-xl">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between pb-4 group cursor-pointer border-b border-slate-100"
        >
          <div className="flex items-center gap-4">
            <div className="p-4 bg-purple-50 rounded-2xl group-hover:bg-purple-100 transition-colors">
              <ImageIcon className="w-8 h-8 text-purple-600" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Event Gallery</h2>
              <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1">
                {hasLoaded ? `${photos.length} Photos Available` : "Tap to view photos"}
              </p>
            </div>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 group-hover:bg-purple-50 transition-colors">
            {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-purple-500" /> : <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-purple-500" />}
          </div>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="pt-6 space-y-4">
                {loading ? (
                  <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 text-purple-500 animate-spin" /></div>
                ) : (
                  <>
                    {/* Album filter pills */}
                    {albums.length > 1 && (
                      <div className="flex flex-wrap gap-2 pb-2">
                        {albums.map(album => (
                          <button
                            key={album}
                            onClick={() => setActiveAlbum(album)}
                            className={cn(
                              "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                              activeAlbum === album 
                                ? "bg-purple-600 text-white shadow-md shadow-purple-500/30" 
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            )}
                          >
                            {album}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Masonry-style Grid */}
                    {activeAlbum === 'My Photos' && filteredPhotos.length === 0 ? (
                      <div className="text-center py-12 px-4 bg-purple-50/50 rounded-2xl border border-purple-100">
                         <ScanFace className="w-12 h-12 text-purple-300 mx-auto mb-3" />
                         <p className="text-slate-600 font-medium">No matched photos found yet.</p>
                         <p className="text-slate-400 text-sm mt-1">Please check the full event gallery.</p>
                         <button onClick={() => setActiveAlbum('All')} className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-purple-700">View All Photos</button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        <AnimatePresence mode="popLayout">
                          {filteredPhotos.map((photo) => (
                            <motion.div
                              key={photo.id}
                              layout
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{ duration: 0.2 }}
                              onClick={() => setSelectedPhoto(photo)}
                              className="aspect-square rounded-xl overflow-hidden cursor-pointer relative group bg-slate-100"
                            >
                              <img
                                src={photo.thumbnail_url || photo.url}
                                alt={photo.title}
                                loading="lazy"
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fullscreen Lightbox Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 md:p-12 select-none"
            onClick={() => setSelectedPhoto(null)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <button 
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white backdrop-blur-md z-50"
              onClick={() => setSelectedPhoto(null)}
            >
              <X className="w-6 h-6" />
            </button>

            {/* Navigation Arrows */}
            {currentPhotoIndex > 0 && (
              <button 
                className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white backdrop-blur-md z-50 hidden sm:block"
                onClick={handlePrev}
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}

            {currentPhotoIndex !== -1 && currentPhotoIndex < filteredPhotos.length - 1 && (
              <button 
                className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white backdrop-blur-md z-50 hidden sm:block"
                onClick={handleNext}
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            )}
            
            <motion.div
              key={selectedPhoto.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center justify-center w-full h-full max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.title}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
              
              <div className="mt-6 text-center shrink-0">
                <h3 className="text-white font-bold text-lg mb-1">{selectedPhoto.title}</h3>
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest">{selectedPhoto.album_name}</p>
                <p className="text-white/30 text-[10px] font-bold mt-2">
                  {currentPhotoIndex + 1} OF {filteredPhotos.length}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
