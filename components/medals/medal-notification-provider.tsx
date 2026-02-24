"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { MedalAchievementModal } from "@/components/medals/medal-achievement-modal";

type MedalPayload = {
  medalKey: string;
  medalName: string;
  description?: string;
};

type MedalNotificationContextValue = {
  showMedal: (payload: MedalPayload) => void;
};

const MedalNotificationContext = createContext<MedalNotificationContextValue | null>(null);

export function MedalNotificationProvider({ children }: { children: ReactNode }) {
  const [modalData, setModalData] = useState<MedalPayload | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMedal = useCallback((payload: MedalPayload) => {
    if (closingTimerRef.current) {
      clearTimeout(closingTimerRef.current);
      closingTimerRef.current = null;
    }
    setModalData(payload);
    setIsOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsOpen(false);
    if (closingTimerRef.current) {
      clearTimeout(closingTimerRef.current);
    }
    closingTimerRef.current = setTimeout(() => {
      setModalData(null);
      closingTimerRef.current = null;
    }, 320);
  }, []);

  useEffect(() => {
    return () => {
      if (closingTimerRef.current) {
        clearTimeout(closingTimerRef.current);
      }
    };
  }, []);

  return (
    <MedalNotificationContext.Provider value={{ showMedal }}>
      {children}
      {modalData && (
        <MedalAchievementModal
          isOpen={isOpen}
          medalKey={modalData.medalKey}
          medalName={modalData.medalName}
          description={modalData.description}
          onClose={handleModalClose}
        />
      )}
    </MedalNotificationContext.Provider>
  );
}

export function useMedalNotification() {
  const context = useContext(MedalNotificationContext);
  if (!context) {
    throw new Error("useMedalNotification must be used within a MedalNotificationProvider");
  }
  return context;
}
