import { useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  Download,
  FileImage,
  X,
  Archive,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Sparkles,
  Loader2,
  Layers,
  Wand2,
  PartyPopper,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Slide {
  slideNumber: number;
  filename: string;
  url: string;
}

interface ConversionResult {
  sessionId: string;
  totalSlides: number;
  originalFilename: string;
  slides: Slide[];
}

type AppState = "idle" | "uploading" | "done";

export default function Home() {
  const { toast } = useToast();
  const [appState, setAppState] = useState<AppState>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [lightboxSlide, setLightboxSlide] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const convertMutation = useMutation({
    mutationFn: async (file: File): Promise<ConversionResult> => {
      const formData = new FormData();
      formData.append("file", file);

      setUploadProgress(5);
      progressIntervalRef.current = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 8;
        });
      }, 600);

      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: "Conversion failed" }));
        throw new Error(err.message || "Conversion failed");
      }

      setUploadProgress(100);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      setAppState("done");
      setUploadProgress(100);
    },
    onError: (error: Error) => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setAppState("idle");
      setUploadProgress(0);
      toast({
        title: "Oops! Something went wrong",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.match(/\.(pptx|ppt)$/i)) {
        toast({
          title: "Wrong file type!",
          description: "I only work with .pptx and .ppt files.",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      setAppState("uploading");
      setUploadProgress(0);
      convertMutation.mutate(file);
    },
    [convertMutation, toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleReset = () => {
    setAppState("idle");
    setSelectedFile(null);
    setResult(null);
    setUploadProgress(0);
    setLightboxSlide(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadSlide = (slide: Slide) => {
    const a = document.createElement("a");
    a.href = slide.url;
    a.download = `slide-${String(slide.slideNumber).padStart(3, "0")}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAll = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = `/api/download-all/${result.sessionId}`;
    a.download = "slides.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openLightbox = (slideNumber: number) => setLightboxSlide(slideNumber);
  const closeLightbox = () => setLightboxSlide(null);
  const prevSlide = () => {
    if (lightboxSlide === null || !result) return;
    setLightboxSlide(lightboxSlide > 1 ? lightboxSlide - 1 : result.totalSlides);
  };
  const nextSlide = () => {
    if (lightboxSlide === null || !result) return;
    setLightboxSlide(lightboxSlide < result.totalSlides ? lightboxSlide + 1 : 1);
  };

  const currentLightboxSlide = result?.slides.find((s) => s.slideNumber === lightboxSlide);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-primary/5 via-accent/5 to-transparent pointer-events-none" />

      <header className="border-b bg-card/60 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-pink-500 dark:from-primary dark:to-pink-400 flex items-center justify-center shadow-sm">
              <Wand2 className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-bold text-foreground tracking-tight text-[15px]">Lindsay's Converter</span>
          </div>
          {appState === "done" && (
            <Button size="sm" variant="outline" onClick={handleReset} data-testid="button-new-conversion" className="rounded-full">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Convert another
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12 relative z-10">
        {appState === "idle" && (
          <div className="flex flex-col items-center gap-10">
            <div className="text-center max-w-lg">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3.5 py-1.5 rounded-full mb-5">
                <Sparkles className="w-3.5 h-3.5" />
                High-quality, zero compression
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-foreground mb-3 leading-tight">
                Lindsay's PPT to PNG
                <br />
                <span className="bg-gradient-to-r from-primary to-pink-500 dark:from-primary dark:to-pink-400 bg-clip-text text-transparent">
                  Converter
                </span>
              </h1>
              <p className="text-muted-foreground text-base leading-relaxed">
                Drop your PowerPoint in, get gorgeous lossless PNGs out.
                <br className="hidden sm:block" />
                It's that easy!
              </p>
            </div>

            <div
              data-testid="upload-dropzone"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "w-full max-w-xl rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 p-12 flex flex-col items-center gap-5",
                dragOver
                  ? "border-primary bg-primary/8 scale-[1.02] shadow-lg shadow-primary/10"
                  : "border-primary/30 bg-card/50 hover:border-primary/60 hover:bg-card/80 hover:shadow-md"
              )}
            >
              <div className={cn(
                "w-18 h-18 rounded-2xl flex items-center justify-center transition-all duration-300",
                dragOver
                  ? "bg-gradient-to-br from-primary to-pink-500 text-white scale-110 shadow-lg shadow-primary/20"
                  : "bg-gradient-to-br from-primary/15 to-pink-500/10 text-primary"
              )}
              style={{ width: "4.5rem", height: "4.5rem" }}
              >
                <Upload className="w-7 h-7" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-foreground mb-1">
                  {dragOver ? "Yes! Drop it right here" : "Drag & drop your .pptx file"}
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse your files
                </p>
              </div>
              <div className="flex flex-wrap justify-center items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-full">
                  <Sparkles className="w-3 h-3 text-primary" />
                  Lossless
                </span>
                <span className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-full">
                  <FileImage className="w-3 h-3 text-primary" />
                  300 DPI
                </span>
                <span className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-full">
                  <Layers className="w-3 h-3 text-primary" />
                  Up to 200 MB
                </span>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pptx,.ppt"
              className="hidden"
              data-testid="input-file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-xl">
              {[
                { icon: Layers, title: "Pixel perfect", desc: "Every detail preserved, exactly like your slides", color: "from-violet-500 to-purple-500" },
                { icon: FileImage, title: "Crystal clear", desc: "Lossless PNG at 300 DPI, no compression artifacts", color: "from-pink-500 to-rose-500" },
                { icon: Download, title: "Grab them all", desc: "Download individually or as a tidy ZIP bundle", color: "from-amber-500 to-orange-500" },
              ].map(({ icon: Icon, title, desc, color }) => (
                <div key={title} className="bg-card border border-card-border rounded-xl p-4 flex flex-col gap-2.5 hover-elevate">
                  <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center", color)}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {appState === "uploading" && (
          <div className="flex flex-col items-center gap-8 pt-16">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-pink-500/15 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">Working on it...</h2>
              <p className="text-sm text-muted-foreground">
                Turning <span className="font-medium text-foreground">{selectedFile?.name}</span> into beautiful PNGs
              </p>
            </div>
            <div className="w-full max-w-sm flex flex-col gap-2.5">
              <Progress value={uploadProgress} className="h-2.5 rounded-full" data-testid="progress-conversion" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="font-medium">
                  {uploadProgress < 30
                    ? "Uploading your file..."
                    : uploadProgress < 80
                    ? "Rendering each slide..."
                    : "Almost done!"}
                </span>
                <span className="font-bold text-primary">{Math.round(uploadProgress)}%</span>
              </div>
            </div>
          </div>
        )}

        {appState === "done" && result && (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-primary/8 to-pink-500/5 rounded-2xl p-5 border border-primary/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center shadow-sm">
                  <PartyPopper className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {result.totalSlides} slide{result.totalSlides !== 1 ? "s" : ""} ready!
                  </h2>
                  <p className="text-xs text-muted-foreground">{result.originalFilename}</p>
                </div>
              </div>
              <Button onClick={downloadAll} data-testid="button-download-all" className="shrink-0 rounded-full shadow-sm">
                <Archive className="w-4 h-4 mr-2" />
                Download all as ZIP
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {result.slides.map((slide) => (
                <div
                  key={slide.slideNumber}
                  data-testid={`card-slide-${slide.slideNumber}`}
                  className="group bg-card border border-card-border rounded-xl flex flex-col hover-elevate transition-all duration-200"
                >
                  <div
                    className="relative bg-muted aspect-[4/3] cursor-pointer overflow-hidden rounded-t-xl"
                    onClick={() => openLightbox(slide.slideNumber)}
                  >
                    <img
                      src={slide.url}
                      alt={`Slide ${slide.slideNumber}`}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      data-testid={`img-slide-${slide.slideNumber}`}
                    />
                    <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors duration-200 flex items-center justify-center">
                      <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-md" />
                    </div>
                  </div>
                  <div className="px-3 py-2.5 flex items-center justify-between gap-1">
                    <span className="text-xs text-muted-foreground font-semibold">
                      Slide {slide.slideNumber}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-full"
                      onClick={() => downloadSlide(slide)}
                      data-testid={`button-download-slide-${slide.slideNumber}`}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t py-4 text-center text-xs text-muted-foreground relative z-10">
        Made with care by Lindsay
      </footer>

      {lightboxSlide !== null && currentLightboxSlide && result && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center"
          onClick={closeLightbox}
          data-testid="lightbox-overlay"
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors p-2.5 rounded-full bg-white/10 hover:bg-white/20"
            onClick={closeLightbox}
            data-testid="button-lightbox-close"
          >
            <X className="w-5 h-5" />
          </button>

          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors p-2.5 rounded-full bg-white/10 hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); prevSlide(); }}
            data-testid="button-lightbox-prev"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div
            className="max-w-5xl max-h-[85vh] px-16 flex flex-col items-center gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentLightboxSlide.url}
              alt={`Slide ${lightboxSlide}`}
              className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl"
              data-testid="img-lightbox"
            />
            <div className="flex items-center gap-4">
              <span className="text-white/60 text-sm font-medium">
                Slide {lightboxSlide} of {result.totalSlides}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => downloadSlide(currentLightboxSlide)}
                data-testid="button-lightbox-download"
                className="rounded-full"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download this slide
              </Button>
            </div>
          </div>

          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors p-2.5 rounded-full bg-white/10 hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); nextSlide(); }}
            data-testid="button-lightbox-next"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}
