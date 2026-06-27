import React, { useState, useRef } from 'react';
import { ScanFace, Loader2, CheckCircle, AlertTriangle, X } from 'lucide-react';
import * as faceapi from 'face-api.js';
import Button from '../ui/Button';
import { AccreditationsAPI } from '../../lib/storage';
import { resolveFileUrl } from '../../lib/storage/fileUrl';

// Self-hosted weights (public/models) instead of a third-party CDN, so the
// feature works on restricted networks and can't break when an upstream repo
// changes. Files are the face-api.js 0.22.2 weight set. BASE_URL respects any
// Vite base path.
const MODELS_URL = `${import.meta.env.BASE_URL}models`;

// Cap the longest edge fed to the detector. Phone photos are often 3000-4000px;
// detection is just as reliable at ~1024px but far faster and far lighter on
// memory — important when scanning hundreds/thousands of gallery photos.
const MAX_EDGE = 1024;

// Distance threshold: lower = stricter. 0.55 favours precision (fewer wrong
// matches) over recall, which matters for a per-person "My Photos" feature.
const MATCH_THRESHOLD = 0.55;

export default function FaceMatchingManager({ eventId, galleryPhotos, scopeLabel = 'All', onToast }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [stats, setStats] = useState(null);
  const modelsLoadedRef = useRef(false);
  const cancelRef = useRef(false);

  const loadModels = async () => {
    if (modelsLoadedRef.current) return;
    setProgressText('Loading AI Models...');
    try {
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
      modelsLoadedRef.current = true;
    } catch (err) {
      console.error('Face model load failed', err);
      throw new Error('MODEL_LOAD_FAILED');
    }
  };

  // Downscale to MAX_EDGE on the longest side and return a canvas the detector
  // can consume directly — keeps full-resolution bitmaps out of memory.
  const toScaledInput = (img) => {
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    if (scale === 1) return img;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  const requestCancel = () => {
    cancelRef.current = true;
    setProgressText('Cancelling…');
  };

  const processFaces = async () => {
    if (!galleryPhotos || galleryPhotos.length === 0) {
      onToast("No gallery photos to process.", "warning");
      return;
    }

    cancelRef.current = false;
    try {
      setIsProcessing(true);
      setStats(null);
      setProgressPercent(0);

      await loadModels();

      setProgressText('Fetching Participant Profiles...');
      setProgressPercent(5);
      const accreditations = await AccreditationsAPI.getByEventId(eventId);

      const accWithPhotos = accreditations.filter(a => a.photoUrl);
      if (accWithPhotos.length === 0) {
        onToast("No participants have profile photos.", "warning");
        setIsProcessing(false);
        return;
      }

      setProgressText('Analyzing Gallery Photos...');
      setProgressPercent(10);

      const galleryDescriptors = [];
      for (let i = 0; i < galleryPhotos.length; i++) {
        if (cancelRef.current) { onToast("Face matching cancelled.", "warning"); setIsProcessing(false); return; }
        const photo = galleryPhotos[i];
        try {
          const img = await faceapi.fetchImage(await resolveFileUrl(photo.url));
          const detections = await faceapi.detectAllFaces(toScaledInput(img)).withFaceLandmarks().withFaceDescriptors();
          if (detections.length > 0) {
            galleryDescriptors.push({ photoId: photo.id, descriptors: detections.map(d => d.descriptor) });
          }
        } catch (err) {
          console.warn(`Could not process gallery photo ${photo.id}`, err);
        }
        setProgressText(`Analyzing Gallery Photos ${i + 1}/${galleryPhotos.length}…`);
        setProgressPercent(10 + Math.floor((i / galleryPhotos.length) * 40));
      }

      setProgressText('Analyzing Participant Profiles...');
      let totalMatchesFound = 0;
      let participantsMatched = 0;

      for (let i = 0; i < accWithPhotos.length; i++) {
        if (cancelRef.current) { onToast("Face matching cancelled.", "warning"); setIsProcessing(false); return; }
        const acc = accWithPhotos[i];
        setProgressText(`Matching Participant ${i + 1}/${accWithPhotos.length}: ${acc.firstName}`);
        setProgressPercent(50 + Math.floor((i / accWithPhotos.length) * 45));

        try {
          const img = await faceapi.fetchImage(await resolveFileUrl(acc.photoUrl));
          const detection = await faceapi.detectSingleFace(toScaledInput(img)).withFaceLandmarks().withFaceDescriptor();

          if (!detection) continue; // No face found in profile photo

          const matchedPhotoIds = [];

          // Compare against all gallery faces
          for (const gPhoto of galleryDescriptors) {
            for (const gDesc of gPhoto.descriptors) {
              const distance = faceapi.euclideanDistance(detection.descriptor, gDesc);
              if (distance < MATCH_THRESHOLD) {
                if (!matchedPhotoIds.includes(gPhoto.photoId)) {
                  matchedPhotoIds.push(gPhoto.photoId);
                }
                break; // Found them in this photo, move to next gallery photo
              }
            }
          }

          if (matchedPhotoIds.length > 0) {
            // ADD to existing matches (union) instead of overwriting — so scanning
            // one album never erases matches found in previously-scanned albums.
            const currentDocs = acc.documents || {};
            const existing = Array.isArray(currentDocs.matched_photos) ? currentDocs.matched_photos : [];
            const merged = Array.from(new Set([...existing, ...matchedPhotoIds]));
            const newlyAdded = merged.length - existing.length;

            if (newlyAdded > 0) {
              totalMatchesFound += newlyAdded;
              participantsMatched++;
              await AccreditationsAPI.update(acc.id, {
                documents: { ...currentDocs, matched_photos: merged }
              });
            }
          }
          // No "else" clear: a participant not present in THIS album keeps the
          // matches found in other albums.

        } catch (err) {
          console.warn(`Could not process participant ${acc.id}`, err);
        }
      }

      setProgressPercent(100);
      setProgressText('Processing Complete!');
      setStats({
        galleryProcessed: galleryPhotos.length,
        participantsProcessed: accWithPhotos.length,
        totalMatches: totalMatchesFound,
        participantsMatched: participantsMatched
      });
      onToast("Face matching completed successfully!", "success");

    } catch (err) {
      console.error("Face matching error:", err);
      if (err?.message === 'MODEL_LOAD_FAILED') {
        onToast("Couldn't load the AI face models. Please refresh and try again.", "error");
      } else {
        onToast("An error occurred during face matching.", "error");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 border border-indigo-500/30 rounded-xl bg-indigo-900/10 mb-6">
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div>
          <h4 className="text-lg font-bold text-indigo-300 flex items-center gap-2 mb-2">
            <ScanFace className="w-5 h-5" /> Smart Face Matching (My Photos)
          </h4>
          <p className="text-sm text-indigo-200/70">
            Scans the photos currently in view against participant profile photos and <strong className="text-indigo-200">adds</strong> to existing matches. Results show in each athlete's "My Photos" tab.
          </p>
          <p className="text-xs text-indigo-300/90 mt-1 font-semibold">
            {scopeLabel === 'All'
              ? `Scanning all albums · ${galleryPhotos.length} photo${galleryPhotos.length === 1 ? '' : 's'}`
              : `Scanning album "${scopeLabel}" · ${galleryPhotos.length} photo${galleryPhotos.length === 1 ? '' : 's'}`}
          </p>
          {stats && (
            <div className="mt-4 flex gap-4 text-xs font-medium text-emerald-400 bg-emerald-900/20 px-3 py-2 rounded-lg inline-flex items-center">
              <CheckCircle className="w-4 h-4" />
              {stats.totalMatches > 0
                ? `Added ${stats.totalMatches} new match${stats.totalMatches === 1 ? '' : 'es'} across ${stats.participantsMatched} participant${stats.participantsMatched === 1 ? '' : 's'}!`
                : `No new matches in this scan — already up to date.`}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 w-full md:w-auto">
          {isProcessing ? (
            <div className="flex flex-col items-center gap-2">
               <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
               <div className="text-xs text-indigo-300 font-bold uppercase text-center">{progressText} ({progressPercent}%)</div>
               <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                 <div className="bg-indigo-500 h-1.5 transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
               </div>
               <button
                 onClick={requestCancel}
                 disabled={cancelRef.current}
                 className="mt-1 flex items-center gap-1 text-[11px] font-bold uppercase text-rose-300 hover:text-rose-200 disabled:opacity-50"
               >
                 <X className="w-3 h-3" /> Cancel
               </button>
            </div>
          ) : (
            <Button
              onClick={processFaces}
              className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white"
              icon={ScanFace}
            >
              {scopeLabel === 'All' ? 'Run Face Matching' : 'Scan This Album'}
            </Button>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 text-[11px] text-amber-200/50">
         <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
         <p>Processing runs locally in your browser to protect privacy and save server costs. Please keep this tab open until it completes. High-resolution photos may take a few minutes to process.</p>
      </div>
    </div>
  );
}
