"use client";
import { useEffect, useState } from "react";
import { useLocal } from "@/modules/learning/ui/local-provider";
import { localRequest } from "@/modules/content/ui/api";
import type { StudySnapshot } from "../domain/study-types";
export function useStudy() {
  const local = useLocal();
  const [data, setData] = useState<StudySnapshot | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (local.mode !== "local" || local.status !== "ready") return;
    let alive = true;
    void localRequest<StudySnapshot>("/study/today")
      .then((value) => {
        if (alive) {
          setData(value);
          setError("");
          setLoading(false);
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e instanceof Error ? e.message : "Chưa đọc được lịch học.");
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [
    local.mode,
    local.status,
    local.data?.settings?.version,
    local.data?.progress.attempts,
    local.data?.learning.reviews,
    revision,
  ]);
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === "visible") {
        setLoading(true);
        setRevision((n) => n + 1);
      }
    };
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, []);
  return {
    data,
    error,
    loading,
    reload: () => {
      setLoading(true);
      setRevision((n) => n + 1);
    },
  };
}
