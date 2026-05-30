import { useState, useEffect } from "react";
import { AttendanceAPI } from "../lib/attendanceApi";

/**
 * Helper to match an active session from the list based on current time.
 */
function findActiveSession(sessionList) {
  if (!sessionList || sessionList.length === 0) return null;
  const now = new Date();
  const currentH = now.getHours();
  const currentM = now.getMinutes();
  const currentTimeVal = currentH * 60 + currentM;

  return sessionList.find(s => {
    if (!s.start_time || !s.end_time) return false;
    const [startH, startM] = s.start_time.split(':').map(Number);
    const [endH, endM] = s.end_time.split(':').map(Number);
    const startVal = startH * 60 + startM;
    const endVal = endH * (s.end_time.includes(':') ? 60 : 1) + (endM || 0);
    return currentTimeVal >= startVal && currentTimeVal <= endVal;
  });
}

/**
 * Custom hook to manage scheduling sessions and tracking the active session.
 * 
 * @param {string} eventId - Unique identifier of the selected event.
 * @param {string} mode - Selected scanning mode (e.g. 'attendance').
 * @returns {Object} { sessions, activeSession, refetchSessions }
 */
export function useScannerSessions(eventId, mode) {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);

  // 1. Fetch today's sessions
  useEffect(() => {
    const fetchSessions = async () => {
      if (eventId && mode === "attendance") {
        try {
          const today = new Date().toISOString().split('T')[0];
          const data = await AttendanceAPI.getSessions(eventId, today);
          setSessions(data || []);
        } catch (err) {
          console.warn("Failed to load sessions:", err);
        }
      } else {
        setSessions([]);
        setActiveSession(null);
      }
    };
    
    fetchSessions();
  }, [eventId, mode]);

  // 2. Automatically compute and update active session every minute
  useEffect(() => {
    if (sessions.length > 0) {
      // Set initial active session
      setActiveSession(findActiveSession(sessions));

      // Periodic check every minute
      const interval = setInterval(() => {
        setActiveSession(findActiveSession(sessions));
      }, 60000);

      return () => clearInterval(interval);
    } else {
      setActiveSession(null);
    }
  }, [sessions]);

  return {
    sessions,
    activeSession,
    refetchSessions: async () => {
      if (eventId && mode === "attendance") {
        try {
          const today = new Date().toISOString().split('T')[0];
          const data = await AttendanceAPI.getSessions(eventId, today);
          setSessions(data || []);
        } catch (err) {
          console.warn("Failed to load sessions:", err);
        }
      }
    }
  };
}
