import { useState, useRef, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Paperclip, FileText, Camera, ScanLine, Upload, X, Check, AlertTriangle, Loader2 } from "lucide-react";

type EvidenceType = "document" | "photo" | "scan" | "note" | "other";

interface UploadFile {
  file: File;
  evidenceType: EvidenceType;
  status: "pending" | "uploading" | "complete" | "error";
  error?: string;
}

interface UploadDrawerProps {
  caseId: string | null;
  caseName: string | null;
  onUploadComplete?: () => void;
}

export function UploadDrawer({ caseId, caseName, onUploadComplete }: UploadDrawerProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("document");
  const [isUploading, setIsUploading] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<Blob[]>([]);
  const [scanPages, setScanPages] = useState<Blob[]>([]);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    
    const newFiles: UploadFile[] = Array.from(selectedFiles).map(file => ({
      file,
      evidenceType,
      status: "pending"
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
  }, [evidenceType]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob(blob => {
        if (blob) {
          setCapturedPhotos(prev => [...prev, blob]);
        }
      }, "image/jpeg", 0.9);
    }
  };

  const captureScanPage = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob(blob => {
        if (blob) {
          setScanPages(prev => [...prev, blob]);
        }
      }, "image/png");
    }
  };

  const uploadFiles = async () => {
    if (!caseId) return;
    
    setIsUploading(true);
    
    for (let i = 0; i < files.length; i++) {
      const uploadFile = files[i];
      if (uploadFile.status !== "pending") continue;
      
      setFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: "uploading" } : f
      ));
      
      try {
        const initRes = await fetch(`/api/cases/${caseId}/uploads/init`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: uploadFile.file.name,
            mimeType: uploadFile.file.type,
            evidenceType: uploadFile.evidenceType
          })
        });
        
        if (!initRes.ok) {
          throw new Error("Failed to initialize upload");
        }
        
        const { uploadId, uploadUrl } = await initRes.json();
        
        const dataRes = await fetch(uploadUrl, {
          method: "PUT",
          body: uploadFile.file
        });
        
        if (!dataRes.ok) {
          throw new Error("Failed to upload file data");
        }
        
        await fetch(`/api/cases/${caseId}/uploads/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId })
        });
        
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: "complete" } : f
        ));
      } catch (err: any) {
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: "error", error: err.message } : f
        ));
      }
    }
    
    setIsUploading(false);
    onUploadComplete?.();
  };

  const uploadPhotos = async () => {
    if (!caseId || capturedPhotos.length === 0) return;
    
    setIsUploading(true);
    
    for (let i = 0; i < capturedPhotos.length; i++) {
      const blob = capturedPhotos[i];
      const filename = `photo_${Date.now()}_${i + 1}.jpg`;
      
      try {
        const initRes = await fetch(`/api/cases/${caseId}/uploads/init`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename,
            mimeType: "image/jpeg",
            evidenceType: "photo"
          })
        });
        
        if (!initRes.ok) throw new Error("Failed to initialize upload");
        
        const { uploadId, uploadUrl } = await initRes.json();
        
        await fetch(uploadUrl, { method: "PUT", body: blob });
        
        await fetch(`/api/cases/${caseId}/uploads/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId })
        });
      } catch (err) {
        console.error("Photo upload failed:", err);
      }
    }
    
    setCapturedPhotos([]);
    setIsUploading(false);
    stopCamera();
    onUploadComplete?.();
  };

  const uploadScans = async () => {
    if (!caseId || scanPages.length === 0) return;
    
    setIsUploading(true);
    
    for (let i = 0; i < scanPages.length; i++) {
      const blob = scanPages[i];
      const filename = `scan_page_${i + 1}.png`;
      
      try {
        const initRes = await fetch(`/api/cases/${caseId}/uploads/init`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename,
            mimeType: "image/png",
            evidenceType: "scan"
          })
        });
        
        if (!initRes.ok) throw new Error("Failed to initialize upload");
        
        const { uploadId, uploadUrl } = await initRes.json();
        
        await fetch(uploadUrl, { method: "PUT", body: blob });
        
        await fetch(`/api/cases/${caseId}/uploads/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId })
        });
      } catch (err) {
        console.error("Scan upload failed:", err);
      }
    }
    
    setScanPages([]);
    setIsUploading(false);
    stopCamera();
    onUploadComplete?.();
  };

  const handleClose = () => {
    stopCamera();
    setOpen(false);
    setFiles([]);
    setCapturedPhotos([]);
    setScanPages([]);
  };

  if (!caseId) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" data-testid="button-upload-trigger">
            <Paperclip className="w-4 h-4 mr-2" />
            Attach
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Upload Evidence</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No Case Selected</AlertTitle>
              <AlertDescription>
                You must select or create a case before uploading evidence.
                All evidence must be bound to a case for governance compliance.
              </AlertDescription>
            </Alert>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-upload-trigger">
          <Paperclip className="w-4 h-4 mr-2" />
          Attach
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Upload Evidence</SheetTitle>
        </SheetHeader>
        
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Attach to Case</div>
          <div className="font-medium text-sm mt-1">{caseName || "Unnamed Case"}</div>
          <div className="text-xs text-muted-foreground font-mono mt-0.5">{caseId}</div>
        </div>

        <Tabs defaultValue="files" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="files" data-testid="tab-files">
              <FileText className="w-4 h-4 mr-1" />
              Files
            </TabsTrigger>
            <TabsTrigger value="photos" data-testid="tab-photos">
              <Camera className="w-4 h-4 mr-1" />
              Photos
            </TabsTrigger>
            <TabsTrigger value="scan" data-testid="tab-scan">
              <ScanLine className="w-4 h-4 mr-1" />
              Scan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Evidence Type</Label>
              <Select value={evidenceType} onValueChange={(v) => setEvidenceType(v as EvidenceType)}>
                <SelectTrigger data-testid="select-evidence-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="photo">Photo</SelectItem>
                  <SelectItem value="scan">Scan</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone-files"
            >
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Drag & drop files here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, DOCX, TXT, JPG, PNG
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
                data-testid="input-file"
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Files</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                      <div className="flex items-center gap-2 truncate">
                        {f.status === "uploading" && <Loader2 className="w-4 h-4 animate-spin" />}
                        {f.status === "complete" && <Check className="w-4 h-4 text-green-500" />}
                        {f.status === "error" && <X className="w-4 h-4 text-red-500" />}
                        <span className="truncate">{f.file.name}</span>
                        <Badge variant="secondary" className="text-xs">{f.evidenceType}</Badge>
                      </div>
                      {f.status === "pending" && (
                        <Button variant="ghost" size="sm" onClick={() => removeFile(i)}>
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              className="w-full"
              onClick={uploadFiles}
              disabled={files.filter(f => f.status === "pending").length === 0 || isUploading}
              data-testid="button-upload-files"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload {files.filter(f => f.status === "pending").length} File(s)
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="photos" className="mt-4 space-y-4">
            {!cameraStream ? (
              <Button onClick={startCamera} className="w-full" data-testid="button-start-camera">
                <Camera className="w-4 h-4 mr-2" />
                Start Camera
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden bg-black">
                  <video ref={videoRef} autoPlay playsInline className="w-full" />
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={capturePhoto} className="flex-1" data-testid="button-capture-photo">
                    <Camera className="w-4 h-4 mr-2" />
                    Capture
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {capturedPhotos.length > 0 && (
              <div className="space-y-2">
                <Label>Captured Photos ({capturedPhotos.length})</Label>
                <div className="grid grid-cols-3 gap-2">
                  {capturedPhotos.map((blob, i) => (
                    <img
                      key={i}
                      src={URL.createObjectURL(blob)}
                      alt={`Capture ${i + 1}`}
                      className="w-full aspect-square object-cover rounded"
                    />
                  ))}
                </div>
                <Button
                  className="w-full"
                  onClick={uploadPhotos}
                  disabled={isUploading}
                  data-testid="button-upload-photos"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload {capturedPhotos.length} Photo(s)
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="scan" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Capture multiple pages to create a multi-page scan document.
            </p>

            {!cameraStream ? (
              <Button onClick={startCamera} className="w-full" data-testid="button-start-scanner">
                <ScanLine className="w-4 h-4 mr-2" />
                Start Scanner
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden bg-black">
                  <video ref={videoRef} autoPlay playsInline className="w-full" />
                  <div className="absolute inset-4 border-2 border-dashed border-white/50 rounded pointer-events-none" />
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={captureScanPage} className="flex-1" data-testid="button-capture-page">
                    <ScanLine className="w-4 h-4 mr-2" />
                    Capture Page {scanPages.length + 1}
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {scanPages.length > 0 && (
              <div className="space-y-2">
                <Label>Scanned Pages ({scanPages.length})</Label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {scanPages.map((blob, i) => (
                    <div key={i} className="relative flex-shrink-0">
                      <img
                        src={URL.createObjectURL(blob)}
                        alt={`Page ${i + 1}`}
                        className="h-24 w-auto rounded"
                      />
                      <Badge className="absolute top-1 left-1 text-xs">{i + 1}</Badge>
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full"
                  onClick={uploadScans}
                  disabled={isUploading}
                  data-testid="button-upload-scans"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload {scanPages.length} Page(s)
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
