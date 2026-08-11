import { Camera, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface CameraBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function CameraBarcodeScanner({
  isOpen,
  onClose,
  onScan,
}: CameraBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setErrorMsg(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("كاميرا الجهاز غير مدعومة في هذا المتصفح");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "تعذر فتح الكاميرا، يرجى التأكد من الصلاحيات";
      setErrorMsg(msg);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }
    void startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Mock manual barcode entry for testing/fallback if hardware scanner is not present
  const handleSimulatedScan = () => {
    const mockBarcode = `6291${Math.floor(10000000 + Math.random() * 90000000)}`;
    onScan(mockBarcode);
    toast.success(`تم قراءة الباركود: ${mockBarcode}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <Camera size={20} className="text-primary" />
            <h3 className="text-sm font-bold text-ink">ماسح الباركود بالكاميرا</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="pressable rounded-lg p-2 text-muted hover:bg-surface-subtle"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative flex min-h-[260px] flex-col items-center justify-center bg-black p-4">
          {errorMsg ? (
            <div className="p-4 text-center text-xs font-semibold text-danger">
              {errorMsg}
            </div>
          ) : (
            <div className="relative aspect-square w-full max-w-[240px] overflow-hidden rounded-xl border-2 border-primary">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
              />
              <div className="absolute inset-0 border-2 border-dashed border-primary/50 animate-pulse" />
            </div>
          )}
          <p className="mt-3 text-center text-xs text-white/70">
            وجّه الكاميرا نحو الباركود لقراءته تلقائياً
          </p>
        </div>

        <div className="flex flex-col gap-2 p-4">
          <button
            type="button"
            onClick={handleSimulatedScan}
            className="pressable flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-xs font-bold text-primary-on"
          >
            مسح تجريبي / قراءة باركود
          </button>
        </div>
      </div>
    </div>
  );
}
