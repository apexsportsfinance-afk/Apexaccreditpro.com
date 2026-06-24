import React, { useState, useRef } from 'react';
import { ScanFace, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import * as faceapi from 'face-api.js';
import Button from '../ui/Button';
import { AccreditationsAPI } from '../../lib/storage';
import { resolveFileUrl } from '../../lib/storage/fileUrl';

const MODELS_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

export default function FaceMatchingManager({ eventId, galleryPhotos, onToast }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [stats, setStats] = useState(null);

  const loadModels = async () => {
    setProgressText('Loading AI Models...');
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
  };

  const processFaces = async () => {
    if (!galleryPhotos || galleryPhotos.length === 0) {
      onToast("No gallery photos to process.", "warning");
      return;
    }

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
        const photo = galleryPhotos[i];
        try {
          const img = await faceapi.fetchImage(await resolveFileUrl(photo.url));
          const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
          if (detections.length > 0) {
            galleryDescriptors.push({ photoId: photo.id, descriptors: detections.map(d => d.descriptor) });
          }
        } catch (err) {
          console.warn(`Could not process gallery photo ${photo.id}`, err);
        }
        setProgressPercent(10 + Math.floor((i / galleryPhotos.length) * 40));
      }

      setProgressText('Analyzing Participant Profiles...');
      let totalMatchesFound = 0;
      let participantsMatched = 0;

      for (let i = 0; i < accWithPhotos.length; i++) {
        const acc = accWithPhotos[i];
        setProgressText(`Matching Participant ${i+1}/${accWithPhotos.length}: ${acc.firstName}`);
        setProgressPercent(50 + Math.floor((i / accWithPhotos.length) * 45));

        try {
          const img = await faceapi.fetchImage(await resolveFileUrl(acc.photoUrl));
          const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
          
          if (!detection) continue; // No face found in profile photo

          const matchedPhotoIds = [];

          // Compare against all gallery faces
          for (const gPhoto of galleryDescriptors) {
            for (const gDesc of gPhoto.descriptors) {
              const distance = faceapi.euclideanDistance(detection.descriptor, gDesc);
              // 0.6 is typical threshold. Lower = stricter.
              if (distance < 0.55) {
                if (!matchedPhotoIds.includes(gPhoto.photoId)) {
                  matchedPhotoIds.push(gPhoto.photoId);
                }
                break; // Found them in this photo, move to next gallery photo
              }
            }
          }

          if (matchedPhotoIds.length > 0) {
            totalMatchesFound += matchedPhotoIds.length;
            participantsMatched++;

            // Save to database
            const currentDocs = acc.documents || {};
            await AccreditationsAPI.update(acc.id, {
              documents: {
                ...currentDocs,
                matched_photos: matchedPhotoIds
              }
            });
          } else {
             // Clear any old matches if they exist
             if (acc.documents && acc.documents.matched_photos) {
                 const newDocs = { ...acc.documents };
                 delete newDocs.matched_photos;
                 await AccreditationsAPI.update(acc.id, { documents: newDocs });
             }
          }

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
      onToast("An error occurred during face matching.", "error");
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
            Scan uploaded gallery photos against participant profile photos. Matches will appear in the "My Photos" tab on their QR Profile.
          </p>
          {stats && (
            <div className="mt-4 flex gap-4 text-xs font-medium text-emerald-400 bg-emerald-900/20 px-3 py-2 rounded-lg inline-flex items-center">
              <CheckCircle className="w-4 h-4" />
              Found {stats.totalMatches} matches across {stats.participantsMatched} participants!
            </div>
          )}
        </div>
        
        <div className="flex-shrink-0 w-full md:w-auto">
          {isProcessing ? (
            <div className="flex flex-col items-center gap-2">
               <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
               <div className="text-xs text-indigo-300 font-bold uppercase">{progressText} ({progressPercent}%)</div>
               <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                 <div className="bg-indigo-500 h-1.5 transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
               </div>
            </div>
          ) : (
            <Button 
              onClick={processFaces} 
              className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white"
              icon={ScanFace}
            >
              Run Face Matching
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
