import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { getSupportedMimeType, base64FromBlob } from "../utils/audio";

interface UseAudioRecorderProps {
  onRecordingComplete: (base64Data: string, format: string) => void | Promise<void>;
  selectedDeviceId: string;
  setRecordingState: (isRecording: boolean) => void;
}

export const useAudioRecorder = ({
  onRecordingComplete,
  selectedDeviceId,
  setRecordingState,
}: UseAudioRecorderProps) => {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDeviceId
          ? {
              deviceId: { exact: selectedDeviceId },
            }
          : true, // Fix constraint logic
      });

      setMicPermissionGranted(true);
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      // Reset chunks when starting new recording
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e: BlobEvent) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const base64Data = await base64FromBlob(blob);
          const format = mimeType.split('/')[1];
          await onRecordingComplete(base64Data, format);
        } catch (error) {
          console.error("Error saving recording:", error);
          toast.error(error instanceof Error ? error.message : String(error));
        } finally {
          stream.getTracks().forEach((track) => track.stop());
          mediaRecorderRef.current = null;
          setIsRecording(false);
          setRecordingState(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingState(true);
      mediaRecorder.start(200);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? t("apps.soundboard.errors.microphonePermissionDenied", {
              defaultValue: "Microphone permission denied. Allow microphone access in your browser and try again.",
            })
          : t("apps.soundboard.errors.recordingFailed", {
              defaultValue: "Could not start recording. Check your microphone and try again.",
            })
      );
      setMicPermissionGranted(false);
      setIsRecording(false);
      setRecordingState(false);
    }
  }, [selectedDeviceId, onRecordingComplete, setRecordingState, t]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return {
    isRecording,
    micPermissionGranted,
    startRecording,
    stopRecording,
  };
};
