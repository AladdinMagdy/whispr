import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../providers/AuthProvider";
import { getSuspensionService } from "../services/suspensionService";
import { Suspension, SuspensionType, BanType } from "../types";

export const useSuspensionCheck = () => {
  const { user } = useAuth();
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspensions, setSuspensions] = useState<Suspension[]>([]);
  const [canAppeal, setCanAppeal] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkSuspensionStatus = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      setIsSuspended(false);
      return;
    }
    try {
      setLoading(true);
      const suspensionService = getSuspensionService();
      const { suspensions: userSuspensions, canAppeal: userCanAppeal } =
        await suspensionService.isUserSuspended(user.uid);

      // Only consider permanent bans as "suspended" for app access
      // Temporary bans and warnings allow normal app access but block whisper creation
      const hasPermanentBan = userSuspensions.some(
        (s) =>
          s.type === SuspensionType.PERMANENT &&
          s.banType === BanType.CONTENT_HIDDEN
      );

      setIsSuspended(hasPermanentBan);
      setSuspensions(userSuspensions);
      setCanAppeal(userCanAppeal);
    } catch (error) {
      console.error("Error checking suspension status:", error);
      setIsSuspended(false);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    checkSuspensionStatus();
  }, [checkSuspensionStatus]);

  // Check if user has any active suspension (for blocking whisper creation)
  const hasActiveSuspension = useCallback(() => {
    return suspensions.some(
      (s) => s.isActive && s.endDate && s.endDate > new Date()
    );
  }, [suspensions]);

  const refreshSuspensionStatus = () => {
    checkSuspensionStatus();
  };

  return {
    isSuspended,
    suspensions,
    canAppeal,
    loading,
    hasActiveSuspension,
    refreshSuspensionStatus,
  };
};
