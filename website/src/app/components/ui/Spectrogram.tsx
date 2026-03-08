import { useRef, useEffect } from "react";

interface SpectrogramProps {
    audioData: Float32Array;
    sampleRate?: number;
}

export function Spectrogram({ audioData, sampleRate = 44100 }: SpectrogramProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current || !audioData || audioData.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d")!;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = rect.height;

        // FFT parameters
        const fftSize = 512;
        const hopSize = 256;
        const numFrames = Math.floor((audioData.length - fftSize) / hopSize);
        const numBins = fftSize / 2;

        if (numFrames <= 0) {
            ctx.fillStyle = "#171717";
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = "#525252";
            ctx.font = "12px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Audio too short for spectrogram", w / 2, h / 2);
            return;
        }

        // Hann window
        const hannWindow = new Float32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
            hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
        }

        // Compute magnitudes for each frame (simple DFT approximation)
        const magnitudes: Float32Array[] = [];

        for (let frame = 0; frame < numFrames; frame++) {
            const start = frame * hopSize;
            const frameData = new Float32Array(fftSize);

            for (let i = 0; i < fftSize; i++) {
                frameData[i] = (audioData[start + i] || 0) * hannWindow[i];
            }

            // Compute magnitude spectrum using real FFT approximation
            const mags = new Float32Array(numBins);
            for (let k = 0; k < numBins; k++) {
                let re = 0, im = 0;
                // Only compute a subset of bins for performance
                for (let n = 0; n < fftSize; n++) {
                    const angle = (2 * Math.PI * k * n) / fftSize;
                    re += frameData[n] * Math.cos(angle);
                    im -= frameData[n] * Math.sin(angle);
                }
                mags[k] = Math.sqrt(re * re + im * im) / fftSize;
            }
            magnitudes.push(mags);
        }

        // Find global min/max for normalization
        let globalMax = 0;
        for (const mags of magnitudes) {
            for (let i = 0; i < mags.length; i++) {
                const db = 20 * Math.log10(Math.max(mags[i], 1e-10));
                if (db > globalMax) globalMax = db;
            }
        }
        const dbFloor = globalMax - 60; // 60dB dynamic range

        // Color map: dark purple → indigo → cyan → yellow
        const colorMap = (normalized: number): [number, number, number] => {
            const t = Math.max(0, Math.min(1, normalized));
            if (t < 0.25) {
                const s = t / 0.25;
                return [Math.round(20 + s * 40), Math.round(10 + s * 10), Math.round(40 + s * 60)];
            } else if (t < 0.5) {
                const s = (t - 0.25) / 0.25;
                return [Math.round(60 + s * 40), Math.round(20 + s * 60), Math.round(100 + s * 60)];
            } else if (t < 0.75) {
                const s = (t - 0.5) / 0.25;
                return [Math.round(100 - s * 60), Math.round(80 + s * 120), Math.round(160 + s * 40)];
            } else {
                const s = (t - 0.75) / 0.25;
                return [Math.round(40 + s * 215), Math.round(200 + s * 55), Math.round(200 - s * 160)];
            }
        };

        // Draw spectrogram
        const colWidth = w / numFrames;
        const rowHeight = h / numBins;

        for (let frame = 0; frame < numFrames; frame++) {
            for (let bin = 0; bin < numBins; bin++) {
                const db = 20 * Math.log10(Math.max(magnitudes[frame][bin], 1e-10));
                const normalized = (db - dbFloor) / (globalMax - dbFloor);
                const [r, g, b] = colorMap(normalized);

                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                // Flip Y so low frequencies are at the bottom
                ctx.fillRect(
                    frame * colWidth,
                    h - (bin + 1) * rowHeight,
                    Math.ceil(colWidth) + 1,
                    Math.ceil(rowHeight) + 1
                );
            }
        }

        // Draw frequency axis labels
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "left";

        const freqLabels = [0, 1000, 2000, 4000, 8000];
        const maxFreq = sampleRate / 2;
        for (const freq of freqLabels) {
            if (freq > maxFreq) continue;
            const y = h - (freq / maxFreq) * h;
            ctx.fillText(`${freq >= 1000 ? `${freq / 1000}k` : freq}Hz`, 4, y - 2);

            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

    }, [audioData, sampleRate]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-32 sm:h-40 rounded-xl"
            style={{ imageRendering: "auto" }}
        />
    );
}
